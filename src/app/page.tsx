'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Loader2 } from 'lucide-react';
import { VRMScene } from '@/components/vmm/VRMScene';
import { ControlPanel } from '@/components/vmm/ControlPanel';
import { Header } from '@/components/vmm/Header';
import { DropZone } from '@/components/vmm/DropZone';
import { HideControlsButton } from '@/components/vmm/HideControlsButton';
import { useGazeTracking } from '@/hooks/useGazeTracking';
import { useLipSync } from '@/hooks/useLipSync';
import { useScreenRecording } from '@/hooks/useScreenRecording';
import { useAvatarDrag } from '@/hooks/useAvatarDrag';
import { cn } from '@/lib/utils';
import { DEFAULT_LIGHTING, type LightingConfig } from '@/lib/vrm/constants';
import type { LoadVRMResult } from '@/lib/vrm/loadVRM';
import { saveVrmToIndexedDB, loadVrmFromIndexedDB, saveConfig, loadConfig } from '@/lib/storage';

type VrmStatus = 'idle' | 'loading' | 'loaded' | 'error';

const DEFAULT_VRM_URL = '/models/default.vrm';
const DEFAULT_VRM_NAME = 'VRM1 Constraint Twist Sample · Pixiv';

export default function Page() {
  const [vrmUrl, setVrmUrl] = useState<string | null>(DEFAULT_VRM_URL);
  const [vrmName, setVrmName] = useState<string>(DEFAULT_VRM_NAME);
  const [vrmStatus, setVrmStatus] = useState<VrmStatus>('idle');
  const [vrmError, setVrmError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ name?: string; authors?: string[] } | null>(null);

  const [gazeEnabled, setGazeEnabled] = useState(true);
  const [captureOutside, setCaptureOutside] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [autoBlinkEnabled, setAutoBlinkEnabled] = useState(true);
  const [idleSwayEnabled, setIdleSwayEnabled] = useState(true);
  const [idleSwayIntensity, setIdleSwayIntensity] = useState(0.02);
  const [greenScreen, setGreenScreen] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [lighting, setLighting] = useState<LightingConfig>(DEFAULT_LIGHTING);

  const [isDragging, setIsDragging] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);

  const { desiredRef, currentRef } = useGazeTracking({ enabled: gazeEnabled, captureOutside });
  const { mouthValueRef, level, isReady: micReady, error: micError } = useLipSync(micEnabled);
  const { isRecording, durationSec: recordingSec, start: startRecording, stop: stopRecording, error: recordingError } = useScreenRecording();
  const { offsetRef: avatarOffsetRef } = useAvatarDrag();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  const prevBgUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gazeEnabled && captureOutside) {
      setCaptureOutside(false);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [gazeEnabled, captureOutside]);

  useEffect(() => {
    if (!vrmUrl) { setVrmStatus('idle'); return; }
    setVrmStatus('loading');
    setVrmError(null);
  }, [vrmUrl]);

  useEffect(() => {
    const config = loadConfig();
    if (config) {
      if (config.gazeEnabled !== undefined) setGazeEnabled(config.gazeEnabled);
      if (config.captureOutside !== undefined) setCaptureOutside(config.captureOutside);
      if (config.micEnabled !== undefined) setMicEnabled(config.micEnabled);
      if (config.autoBlinkEnabled !== undefined) setAutoBlinkEnabled(config.autoBlinkEnabled);
      if (config.idleSwayEnabled !== undefined) setIdleSwayEnabled(config.idleSwayEnabled);
      if (config.idleSwayIntensity !== undefined) setIdleSwayIntensity(config.idleSwayIntensity);
      if (config.greenScreen !== undefined) setGreenScreen(config.greenScreen);
      if (config.lighting !== undefined) setLighting(config.lighting);
    }
    loadVrmFromIndexedDB().then((data) => {
      if (data) {
        const url = URL.createObjectURL(data.blob);
        if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = url;
        setVrmUrl(url);
        setVrmName(data.name);
        setMeta(null);
      }
    });
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      setVrmError('Please select a .vrm file');
      setVrmStatus('error');
      return;
    }
    const url = URL.createObjectURL(file);
    if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
    prevBlobUrlRef.current = url;
    setVrmUrl(url);
    setVrmName(file.name);
    setMeta(null);
  }, []);

  const handleBackgroundFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    if (prevBgUrlRef.current) URL.revokeObjectURL(prevBgUrlRef.current);
    prevBgUrlRef.current = url;
    setBackgroundImageUrl(url);
  }, []);

  const handleClearBackground = useCallback(() => {
    if (prevBgUrlRef.current) {
      URL.revokeObjectURL(prevBgUrlRef.current);
      prevBgUrlRef.current = null;
    }
    setBackgroundImageUrl(null);
  }, []);

  const handleLoaded = useCallback((result: LoadVRMResult) => {
    setVrmStatus('loaded');
    setVrmError(null);
    if (result.meta) {
      setMeta({
        name: result.meta.name,
        authors: result.meta.authors ? [...result.meta.authors] : undefined,
      });
    }
  }, []);

  const handleError = useCallback((err: Error) => {
    setVrmStatus('error');
    setVrmError(err.message);
  }, []);

  const handleResetVRM = useCallback(() => {
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }
    setVrmUrl(DEFAULT_VRM_URL);
    setVrmName(DEFAULT_VRM_NAME);
    setMeta(null);
  }, []);

  useEffect(() => {
    let dragDepth = 0;
    const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragDepth++;
      setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setIsDragging(false);
    };
    const onDragOver = (e: DragEvent) => { if (isFileDrag(e)) e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth = 0;
      setIsDragging(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.vrm'));
        if (file) handleFile(file);
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFile]);

  const handlePickFile = useCallback(() => fileInputRef.current?.click(), []);
  const handlePickBackground = useCallback(() => bgInputRef.current?.click(), []);
  const handleRecordToggle = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const handleSaveConfig = useCallback(async () => {
    saveConfig({
      gazeEnabled, captureOutside, micEnabled, autoBlinkEnabled, idleSwayEnabled, idleSwayIntensity, greenScreen, lighting
    });
    if (vrmUrl && vrmUrl !== DEFAULT_VRM_URL) {
      try {
        const res = await fetch(vrmUrl);
        const blob = await res.blob();
        await saveVrmToIndexedDB(blob, vrmName);
      } catch (e) {
        console.error('Failed to save VRM blob', e);
      }
    }
  }, [gazeEnabled, captureOutside, micEnabled, autoBlinkEnabled, idleSwayEnabled, idleSwayIntensity, greenScreen, lighting, vrmUrl, vrmName]);

  const displayVrmName = meta?.name || vrmName;
  const headerStatus = vrmStatus === 'loaded'
    ? (micEnabled ? (micReady ? 'Avatar · Mic live' : 'Avatar · Mic starting…') : 'Avatar ready')
    : vrmStatus === 'loading' ? 'Loading avatar…'
    : vrmStatus === 'error' ? 'Avatar error'
    : 'Drop a .vrm file';
  const effectiveVrmError = vrmError || recordingError;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <main className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          <VRMScene
            vrmUrl={vrmUrl} gazeEnabled={gazeEnabled} autoBlinkEnabled={autoBlinkEnabled}
            idleSwayEnabled={idleSwayEnabled} idleSwayIntensity={idleSwayIntensity}
            gazeDesiredRef={desiredRef} gazeCurrentRef={currentRef}
            mouthValueRef={mouthValueRef} avatarOffsetRef={avatarOffsetRef}
            greenScreen={greenScreen} backgroundImageUrl={backgroundImageUrl}
            lighting={lighting}
            onLoaded={handleLoaded} onError={handleError}
          />
        </div>

        {vrmStatus === 'loading' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 bg-zinc-900/60 backdrop-blur-sm rounded-xl px-6 py-4 border border-zinc-800">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              <p className="text-xs text-zinc-400">Loading VRM…</p>
            </div>
          </div>
        )}

        {gazeEnabled && captureOutside && !document.pointerLockElement && (
          <div className="absolute inset-0 z-10 flex items-end justify-center pb-24 pointer-events-none">
            <div className="bg-violet-900/80 border border-violet-500/50 text-violet-100 text-xs px-3 py-2 rounded-lg backdrop-blur-sm">
              Click the canvas to engage pointer lock · Press Esc to exit
            </div>
          </div>
        )}

        <div className="absolute top-4 right-4 z-50">
          <HideControlsButton
            hidden={controlsHidden}
            onToggle={() => setControlsHidden((v) => !v)}
          />
        </div>

        <div className={cn(
          'absolute top-4 left-4 z-10 transition-all duration-300',
          controlsHidden && 'opacity-0 pointer-events-none -translate-x-4'
        )}>
          <Header status={headerStatus} />
        </div>

        <div className={cn(
          'absolute top-4 right-16 z-20 transition-all duration-300',
          controlsHidden && 'opacity-0 pointer-events-none translate-x-4'
        )}>
          <ControlPanel
            vrmName={displayVrmName} vrmStatus={vrmStatus} vrmError={effectiveVrmError}
            gazeEnabled={gazeEnabled} captureOutside={captureOutside}
            micEnabled={micEnabled} autoBlinkEnabled={autoBlinkEnabled}
            idleSwayEnabled={idleSwayEnabled} idleSwayIntensity={idleSwayIntensity}
            greenScreen={greenScreen} hasBackground={!!backgroundImageUrl}
            micLevel={level} micReady={micReady} micError={micError}
            isRecording={isRecording} recordingSec={recordingSec}
            lighting={lighting}
            onGazeToggle={setGazeEnabled} onCaptureOutsideToggle={setCaptureOutside}
            onMicToggle={setMicEnabled} onAutoBlinkToggle={setAutoBlinkEnabled}
            onIdleSwayToggle={setIdleSwayEnabled} onIdleSwayIntensityChange={setIdleSwayIntensity}
            onGreenScreenToggle={setGreenScreen}
            onLightingChange={setLighting}
            onPickFile={handlePickFile} onResetVRM={handleResetVRM}
            onPickBackground={handlePickBackground} onClearBackground={handleClearBackground}
            onRecordToggle={handleRecordToggle}
            onSaveConfig={handleSaveConfig}
          />
        </div>

        {isDragging && (
          <div className="absolute inset-0 z-30 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-8">
            <DropZone visible overlay onFile={handleFile} className="w-full max-w-md" />
          </div>
        )}

        {!vrmUrl && !isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-8">
            <div className="w-full max-w-md"><DropZone visible onFile={handleFile} /></div>
          </div>
        )}
      </main>

      <input ref={fileInputRef} type="file" accept=".vrm" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }} />
      <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleBackgroundFile(file);
          e.target.value = '';
        }} />
    </div>
  );
}
