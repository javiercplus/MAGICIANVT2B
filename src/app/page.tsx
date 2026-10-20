'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Loader2, Gauge, Shirt, Radio } from 'lucide-react';
import { VRMScene } from '@/components/vmm/VRMScene';
import { ControlPanel } from '@/components/vmm/ControlPanel';
import { AvatarPanel } from '@/components/vmm/AvatarPanel';
import { DraggablePanel } from '@/components/vmm/DraggablePanel';
import { OptimizationPanel } from '@/components/vmm/OptimizationPanel';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/vmm/Header';
import { DropZone } from '@/components/vmm/DropZone';
import { HideControlsButton } from '@/components/vmm/HideControlsButton';
import { WindowResizeHandles } from '@/components/vmm/WindowResizeHandles';
import { WindowTitleBar } from '@/components/vmm/WindowTitleBar';
import { HelpButton } from '@/components/vmm/HelpButton';
import { useGazeTracking } from '@/hooks/useGazeTracking';
import { useLipSync } from '@/hooks/useLipSync';
import { useScreenRecording } from '@/hooks/useScreenRecording';
import { useAvatarDrag } from '@/hooks/useAvatarDrag';
import { cn } from '@/lib/utils';
import { DEFAULT_LIGHTING, DEFAULT_ADJUST, DEFAULT_SHADER, DEFAULT_OPTIMIZATION, DEFAULT_WIND, DEFAULT_MTOON, matchFaceEmotion, CAMERA, GREEN_SCREEN, ZOOM, type LightingConfig, type AdjustConfig, type ShaderConfig, type OptimizationConfig, type Telemetry, type WindConfig, type MToonConfig, type CameraHome, type FacePreset, type ShaderPreset } from '@/lib/vrm/constants';
import type { LoadVRMResult } from '@/lib/vrm/loadVRM';
import { saveVrmToIndexedDB, loadVrmFromIndexedDB, saveConfig, loadConfig } from '@/lib/storage';

type VrmStatus = 'idle' | 'loading' | 'loaded' | 'error';

const DEFAULT_VRM_URL = '/models/default.vrm';
const DEFAULT_VRM_NAME = 'VRM1 Constraint Twist Sample · Pixiv';

// Pick the single expression that best represents an emotion/state. Prefers
// custom face-control states ("ALL_*", "Fcl_*", "FC_*") over standard presets,
// so we set exactly one state at 100% instead of stacking several (which could
// open the mouth more than intended).
function pickExpressionForPreset(names: string[], preset: FacePreset): string | null {
  const candidates = names.filter((n) => matchFaceEmotion(n) === preset);
  if (candidates.length === 0) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const score = (n: string) => {
    const s = norm(n);
    let v = 0;
    if (s.includes('all')) v += 4;
    if (s.startsWith('fc') || s.includes('fcl')) v += 3;
    return v - n.length * 0.01;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

export default function Page() {
  const [vrmUrl, setVrmUrl] = useState<string | null>(DEFAULT_VRM_URL);
  const [vrmName, setVrmName] = useState<string>(DEFAULT_VRM_NAME);
  const [vrmStatus, setVrmStatus] = useState<VrmStatus>('idle');
  const [vrmError, setVrmError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ name?: string; authors?: string[] } | null>(null);

  const [gazeEnabled, setGazeEnabled] = useState(true);
  const [captureOutside, setCaptureOutside] = useState(false);
  const [globalTracking, setGlobalTracking] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [autoBlinkEnabled, setAutoBlinkEnabled] = useState(true);
  const [randomEyesEnabled, setRandomEyesEnabled] = useState(false);
  const [randomEyesIntensity, setRandomEyesIntensity] = useState(0.15);
  const [idleSwayEnabled, setIdleSwayEnabled] = useState(true);
  const [idleSwayIntensity, setIdleSwayIntensity] = useState(0.02);
  const [greenScreen, setGreenScreen] = useState(false);
  const [chromaColor, setChromaColor] = useState<string>(GREEN_SCREEN.COLOR);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [lighting, setLighting] = useState<LightingConfig>(DEFAULT_LIGHTING);
  const [adjust, setAdjust] = useState<AdjustConfig>(DEFAULT_ADJUST);
  const [shader, setShader] = useState<ShaderConfig>(DEFAULT_SHADER);
  const [optimization, setOptimization] = useState<OptimizationConfig>(DEFAULT_OPTIMIZATION);
  const [mtoon, setMtoon] = useState<MToonConfig>(DEFAULT_MTOON);
  const [wind, setWind] = useState<WindConfig>(DEFAULT_WIND);
  const [expressionNames, setExpressionNames] = useState<string[]>([]);
  const [faceWeights, setFaceWeights] = useState<Record<string, number>>({});
  const [fov, setFov] = useState<number>(CAMERA.FOV_DEFAULT);
  const [orthographic, setOrthographic] = useState(false);
  const [telemetry, setTelemetry] = useState<Telemetry>({ fps: 0, textures: 0, calls: 0, geometries: 0 });
  const [optPanelOpen, setOptPanelOpen] = useState(false);
  const [avatarPanelOpen, setAvatarPanelOpen] = useState(true);
  const [vmcEnabled, setVmcEnabled] = useState(false);
  const [zoom, setZoom] = useState<number>(ZOOM.DEFAULT);

  const [isDragging, setIsDragging] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);

  const { desiredRef, currentRef } = useGazeTracking({ enabled: gazeEnabled, captureOutside, globalTracking });
  const { mouthValueRef, level, isReady: micReady, error: micError } = useLipSync(micEnabled);
  const { isRecording, durationSec: recordingSec, start: startRecording, stop: stopRecording, error: recordingError } = useScreenRecording();
  const { offsetRef: avatarOffsetRef, rotationRef, resetView } = useAvatarDrag();
  const cameraHomeRef = useRef<CameraHome | null>(null);

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
      if (config.globalTracking !== undefined) setGlobalTracking(config.globalTracking);
      if (config.micEnabled !== undefined) setMicEnabled(config.micEnabled);
      if (config.autoBlinkEnabled !== undefined) setAutoBlinkEnabled(config.autoBlinkEnabled);
      if (config.randomEyesEnabled !== undefined) setRandomEyesEnabled(config.randomEyesEnabled);
      if (config.randomEyesIntensity !== undefined) setRandomEyesIntensity(config.randomEyesIntensity);
      if (config.idleSwayEnabled !== undefined) setIdleSwayEnabled(config.idleSwayEnabled);
      if (config.idleSwayIntensity !== undefined) setIdleSwayIntensity(config.idleSwayIntensity);
      if (config.greenScreen !== undefined) setGreenScreen(config.greenScreen);
      if (typeof config.chromaColor === 'string') setChromaColor(config.chromaColor);
      if (config.lighting !== undefined) {
        const l = config.lighting;
        if (l && typeof l === 'object') {
          setLighting({
            ...DEFAULT_LIGHTING,
            ...l,
            front: typeof l.front === 'number' ? l.front : DEFAULT_LIGHTING.front,
            top: typeof l.top === 'number' ? l.top : DEFAULT_LIGHTING.top,
            frontAngle: typeof l.frontAngle === 'number' ? l.frontAngle : 0,
            topAngle: typeof l.topAngle === 'number' ? l.topAngle : 0,
          });
        }
      }
      if (config.adjust !== undefined) {
        const a = config.adjust;
        if (a && typeof a === 'object') {
          setAdjust({
            ...DEFAULT_ADJUST,
            ...a,
            // Old configs only had brightness/saturation/contrast; keep any
            // missing color controls neutral.
            brightness: typeof a.brightness === 'number' ? a.brightness : 1,
            saturation: typeof a.saturation === 'number' ? a.saturation : 1,
            contrast: typeof a.contrast === 'number' ? a.contrast : 1,
          });
        }
      }
      if (config.shader !== undefined) {
        const s = config.shader;
        if (s && typeof s === 'object') {
          const merged = { ...DEFAULT_SHADER, ...s };
          // Migrate old single-effect config (`preset`) to the new multi-select
          // `effects` array.
          if (!Array.isArray(merged.effects)) {
            const legacyPreset = (s as { preset?: string }).preset;
            merged.effects = legacyPreset && legacyPreset !== 'off'
              ? [legacyPreset as ShaderPreset]
              : [];
          }
          // Old configs used a low bloom threshold that made white and the
          // custom background glow. Bump them to the new emissive-only range.
          if (typeof merged.bloomThreshold === 'number' && merged.bloomThreshold < 1) {
            merged.bloomThreshold = DEFAULT_SHADER.bloomThreshold;
          }
          setShader(merged);
        }
      }
      if (config.optimization !== undefined) {
        const o = config.optimization;
        if (o && typeof o === 'object') {
          setOptimization({ ...DEFAULT_OPTIMIZATION, ...o });
        }
      }
      if (config.mtoon !== undefined) {
        const m = config.mtoon;
        if (m && typeof m === 'object') {
          setMtoon({ ...DEFAULT_MTOON, ...m });
        }
      }
      if (config.wind !== undefined) {
        const w = config.wind;
        if (w && typeof w === 'object') {
          setWind({ ...DEFAULT_WIND, ...w });
        }
      }
      if (typeof config.fov === 'number') {
        setFov(Math.min(Math.max(config.fov, CAMERA.FOV_MIN), CAMERA.FOV_MAX));
      }
      if (typeof config.orthographic === 'boolean') {
        setOrthographic(config.orthographic);
      }
      if (typeof config.zoom === 'number') {
        setZoom(Math.min(Math.max(config.zoom, ZOOM.MIN), ZOOM.MAX));
      }
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
    // Face tab only exposes emotion/state blend shapes (no vowels/blink/look).
    const allNames = (result.vrm.expressionManager?.expressions ?? []).map((e) => e.expressionName);
    const emotionNames = allNames.filter((n) => matchFaceEmotion(n) !== null);
    setExpressionNames(emotionNames);
    // Neutral starts at 100% when the model has a neutral state; otherwise the
    // base face (all weights 0) is already neutral.
    const neutralName = pickExpressionForPreset(emotionNames, 'neutral');
    const initial: Record<string, number> = {};
    for (const name of emotionNames) initial[name] = name === neutralName ? 1 : 0;
    setFaceWeights(initial);
  }, []);

  const handleError = useCallback((err: Error) => {
    setVrmStatus('error');
    setVrmError(err.message);
  }, []);

  const handleFaceWeightChange = useCallback((name: string, value: number) => {
    setFaceWeights((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFacePreset = useCallback((preset: FacePreset) => {
    setFaceWeights(() => {
      // Exclusive state: exactly one expression at 100%, all others at 0.
      // This avoids stacking emotions (which used to open the mouth more).
      let target = pickExpressionForPreset(expressionNames, preset);
      if (!target && preset === 'fun') {
        target = pickExpressionForPreset(expressionNames, 'happy');
      }
      const next: Record<string, number> = {};
      for (const name of expressionNames) next[name] = name === target ? 1 : 0;
      return next;
    });
  }, [expressionNames]);

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

  const handleGlobalTrackingToggle = useCallback((v: boolean) => {
    setGlobalTracking(v);
    // Global tracking works everywhere, so pointer lock is redundant.
    if (v && captureOutside) {
      setCaptureOutside(false);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [captureOutside]);

  const handleSaveConfig = useCallback(async () => {
    saveConfig({
      gazeEnabled, captureOutside, globalTracking, micEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity, greenScreen, chromaColor, lighting, adjust, shader, optimization, mtoon, wind, fov, orthographic, zoom
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
  }, [gazeEnabled, captureOutside, globalTracking, micEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity, greenScreen, chromaColor, lighting, adjust, shader, optimization, mtoon, wind, fov, orthographic, zoom, vrmUrl, vrmName]);

  const displayVrmName = meta?.name || vrmName;
  const headerStatus = vrmStatus === 'loaded'
    ? (micEnabled ? (micReady ? 'Avatar · Mic live' : 'Avatar · Mic starting…') : 'Avatar ready')
    : vrmStatus === 'loading' ? 'Loading avatar…'
    : vrmStatus === 'error' ? 'Avatar error'
    : 'Drop a .vrm file';
  const effectiveVrmError = vrmError || recordingError;

  return (
    <div className="relative flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <WindowResizeHandles />
      <WindowTitleBar />
      <main className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          <VRMScene
            vrmUrl={vrmUrl} gazeEnabled={gazeEnabled} autoBlinkEnabled={autoBlinkEnabled}
            randomEyesEnabled={randomEyesEnabled} randomEyesIntensity={randomEyesIntensity}
            idleSwayEnabled={idleSwayEnabled} idleSwayIntensity={idleSwayIntensity}
            gazeDesiredRef={desiredRef} gazeCurrentRef={currentRef}
            mouthValueRef={mouthValueRef} avatarOffsetRef={avatarOffsetRef}
            faceWeights={faceWeights}
            rotationRef={rotationRef}
            cameraHomeRef={cameraHomeRef}
            greenScreen={greenScreen} chromaColor={chromaColor} backgroundImageUrl={backgroundImageUrl}
            lighting={lighting}
            adjust={adjust}
            shader={shader}
            optimization={optimization}
            mtoon={mtoon}
            wind={wind}
            zoom={zoom}
            fov={fov}
            orthographic={orthographic}
            vmcEnabled={vmcEnabled}
            onZoomChange={setZoom}
            onTelemetry={optPanelOpen ? setTelemetry : undefined}
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

        {gazeEnabled && captureOutside && !globalTracking && !document.pointerLockElement && (
          <div className="absolute inset-0 z-10 flex items-end justify-center pb-24 pointer-events-none">
            <div className="bg-violet-900/80 border border-violet-500/50 text-violet-100 text-xs px-3 py-2 rounded-lg backdrop-blur-sm">
              Click the canvas to engage pointer lock · Press Esc to exit
            </div>
          </div>
        )}

        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
          <div className={cn('flex flex-col gap-2', controlsHidden && 'hidden')}>
            <HelpButton />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setAvatarPanelOpen((v) => !v)}
              title="VRM model (model, MToon, effects)"
              className={cn(
                'h-9 w-9 bg-zinc-900/85 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800',
                avatarPanelOpen && 'text-violet-300 border-violet-500/50',
              )}
            >
              <Shirt className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setVmcEnabled((v) => !v)}
              title="VMC output (send tracking to VTube Studio via UDP)"
              className={cn(
                'h-9 w-9 bg-zinc-900/85 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800',
                vmcEnabled && 'text-emerald-300 border-emerald-500/50',
              )}
            >
              <Radio className="w-4 h-4" />
            </Button>
          </div>
          <HideControlsButton
            hidden={controlsHidden}
            onToggle={() => setControlsHidden((v) => !v)}
          />
          <div className={cn('flex flex-col gap-2', controlsHidden && 'hidden')}>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setOptPanelOpen((v) => !v)}
              title="Optimization panel"
              className={cn(
                'h-9 w-9 bg-zinc-900/85 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800',
                optPanelOpen && 'text-violet-300 border-violet-500/50',
              )}
            >
              <Gauge className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {optPanelOpen && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
            <OptimizationPanel
              config={optimization}
              telemetry={telemetry}
              onChange={setOptimization}
              onClose={() => setOptPanelOpen(false)}
            />
          </div>
        )}

        <div className={cn(
          'absolute top-4 left-4 z-10 transition-all duration-300',
          controlsHidden && 'opacity-0 pointer-events-none -translate-x-4'
        )}>
          <Header status={headerStatus} />
        </div>

        <div className={cn(
          'absolute top-24 left-4 z-30 transition-all duration-300',
          (!avatarPanelOpen || controlsHidden) && 'opacity-0 pointer-events-none'
        )}>
          <DraggablePanel>
            <AvatarPanel
              vrmName={displayVrmName} vrmStatus={vrmStatus} vrmError={vrmError}
              mtoon={mtoon} shader={shader}
              onMtoonChange={setMtoon} onShaderChange={setShader}
              wind={wind} onWindChange={setWind}
              expressionNames={expressionNames} faceWeights={faceWeights}
              onFaceWeightChange={handleFaceWeightChange} onFacePreset={handleFacePreset}
              onPickFile={handlePickFile} onResetVRM={handleResetVRM}
              onSaveConfig={handleSaveConfig}
              onClose={() => setAvatarPanelOpen(false)}
            />
          </DraggablePanel>
        </div>

        <div className={cn(
          'absolute top-4 right-16 z-20 transition-all duration-300',
          controlsHidden && 'opacity-0 pointer-events-none'
        )}>
          <DraggablePanel>
            <ControlPanel
            vrmName={displayVrmName} vrmStatus={vrmStatus} vrmError={effectiveVrmError}
            gazeEnabled={gazeEnabled} captureOutside={captureOutside} globalTracking={globalTracking}
            micEnabled={micEnabled} autoBlinkEnabled={autoBlinkEnabled}
            randomEyesEnabled={randomEyesEnabled} randomEyesIntensity={randomEyesIntensity}
            idleSwayEnabled={idleSwayEnabled} idleSwayIntensity={idleSwayIntensity}
            greenScreen={greenScreen} chromaColor={chromaColor} hasBackground={!!backgroundImageUrl}
            micLevel={level} micReady={micReady} micError={micError}
            isRecording={isRecording} recordingSec={recordingSec}
            lighting={lighting}
            adjust={adjust}
            zoom={zoom}
            fov={fov}
            orthographic={orthographic}
            onGazeToggle={setGazeEnabled} onCaptureOutsideToggle={setCaptureOutside}
            onGlobalTrackingToggle={handleGlobalTrackingToggle}
            onMicToggle={setMicEnabled} onAutoBlinkToggle={setAutoBlinkEnabled}
            onRandomEyesToggle={setRandomEyesEnabled} onRandomEyesIntensityChange={setRandomEyesIntensity}
            onIdleSwayToggle={setIdleSwayEnabled} onIdleSwayIntensityChange={setIdleSwayIntensity}
            onGreenScreenToggle={setGreenScreen}
            onChromaColorChange={setChromaColor}
            onLightingChange={setLighting}
            onAdjustChange={setAdjust}
            onZoomChange={setZoom}
            onFovChange={setFov}
            onOrthographicToggle={setOrthographic}
            onResetView={resetView}
            onPickBackground={handlePickBackground} onClearBackground={handleClearBackground}
            onRecordToggle={handleRecordToggle}
          />
          </DraggablePanel>
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
