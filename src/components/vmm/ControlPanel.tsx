'use client';

import { useState } from 'react';
import {
  MousePointerClick, Mic, Eye, RotateCcw, AlertCircle,
  Square, Circle, Palette, Crosshair,
  Image as ImageIcon, Sun, Activity, Dna, SlidersHorizontal, ZoomIn, Monitor,
  Camera, Focus, Rotate3d, Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LightSlider, ToggleRow, StatusPill, type VrmStatus } from './controls';
import {
  CAMERA, ZOOM,
  type LightingConfig, type AdjustConfig,
  type ToneMappingMode,
} from '@/lib/vrm/constants';

const TONE_MAPPINGS: { value: ToneMappingMode; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'aces', label: 'ACES' },
  { value: 'agx', label: 'AgX' },
  { value: 'linear', label: 'Linear' },
  { value: 'none', label: 'None' },
];

interface ControlPanelProps {
  vrmName: string;
  vrmStatus: VrmStatus;
  vrmError: string | null;
  gazeEnabled: boolean;
  captureOutside: boolean;
  globalTracking: boolean;
  micEnabled: boolean;
  autoBlinkEnabled: boolean;
  randomEyesEnabled: boolean;
  randomEyesIntensity: number;
  idleSwayEnabled: boolean;
  idleSwayIntensity: number;
  greenScreen: boolean;
  chromaColor: string;
  hasBackground: boolean;
  micLevel: number;
  micReady: boolean;
  micError: string | null;
  isRecording: boolean;
  recordingSec: number;
  lighting: LightingConfig;
  adjust: AdjustConfig;
  zoom: number;
  fov: number;
  orthographic: boolean;
  onGazeToggle: (v: boolean) => void;
  onCaptureOutsideToggle: (v: boolean) => void;
  onGlobalTrackingToggle: (v: boolean) => void;
  onMicToggle: (v: boolean) => void;
  onAutoBlinkToggle: (v: boolean) => void;
  onRandomEyesToggle: (v: boolean) => void;
  onRandomEyesIntensityChange: (v: number) => void;
  onIdleSwayToggle: (v: boolean) => void;
  onIdleSwayIntensityChange: (v: number) => void;
  onGreenScreenToggle: (v: boolean) => void;
  onChromaColorChange: (c: string) => void;
  onLightingChange: (l: LightingConfig) => void;
  onAdjustChange: (a: AdjustConfig) => void;
  onZoomChange: (z: number) => void;
  onFovChange: (f: number) => void;
  onOrthographicToggle: (v: boolean) => void;
  onResetView: () => void;
  onPickBackground: () => void;
  onClearBackground: () => void;
  onRecordToggle: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function ControlPanel(props: ControlPanelProps) {
  const {
    vrmName, vrmStatus, vrmError,
    gazeEnabled, captureOutside, globalTracking, micEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity, greenScreen, chromaColor, hasBackground,
    micLevel, micReady, micError,
    isRecording, recordingSec,
    lighting, adjust, zoom,
    fov, orthographic,
    onGazeToggle, onCaptureOutsideToggle, onGlobalTrackingToggle, onMicToggle, onAutoBlinkToggle, onRandomEyesToggle, onRandomEyesIntensityChange, onIdleSwayToggle, onIdleSwayIntensityChange, onGreenScreenToggle, onChromaColorChange,
    onLightingChange, onAdjustChange, onZoomChange,
    onFovChange, onOrthographicToggle, onResetView,
    onPickBackground, onClearBackground, onRecordToggle,
  } = props;

  const [activeTab, setActiveTab] = useState<'tracking' | 'motion' | 'scene' | 'camera' | 'lighting' | 'adjust'>('tracking');

  return (
    <div className="window w-[430px] max-w-[calc(100vw-2rem)]">
      <div className="title-bar">
        <div className="title-bar-text">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Options — {vrmName}</span>
        </div>
        <div className="title-bar-controls">
          <button type="button" aria-label="Minimize" />
          <button type="button" aria-label="Maximize" />
        </div>
      </div>

      <div className="window-body space-y-2">
        {(vrmError || micError) && (
          <div className="text-[11px] text-[#800000] bg-[#ffe6e6] border border-[#b82e2e] p-1.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-tight">{vrmError || micError}</span>
          </div>
        )}

        <menu role="tablist" aria-label="Options Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tracking'}
            onClick={() => setActiveTab('tracking')}
          >
            Track
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'motion'}
            onClick={() => setActiveTab('motion')}
          >
            Motion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'scene'}
            onClick={() => setActiveTab('scene')}
          >
            Scene
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'camera'}
            onClick={() => setActiveTab('camera')}
          >
            Camera
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'lighting'}
            onClick={() => setActiveTab('lighting')}
          >
            Light
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'adjust'}
            onClick={() => setActiveTab('adjust')}
          >
            Color
          </button>
        </menu>

        {activeTab === 'tracking' && (
          <article role="tabpanel" className="space-y-2 max-h-[380px] overflow-y-auto">
            <fieldset>
              <legend>Mouse &amp; Eye Gaze</legend>
              <ToggleRow
                icon={<MousePointerClick className="w-3.5 h-3.5" />}
                label="Gaze Tracking"
                description="Head + eyes follow mouse. Off = forward."
                checked={gazeEnabled}
                onCheckedChange={onGazeToggle}
              />
              {gazeEnabled && (
                <ToggleRow
                  icon={<Monitor className="w-3.5 h-3.5" />}
                  label="Global Tracking"
                  description="Follow cursor even outside the window."
                  checked={globalTracking}
                  onCheckedChange={onGlobalTrackingToggle}
                  indent
                />
              )}
              {gazeEnabled && !globalTracking && (
                <ToggleRow
                  icon={<Crosshair className="w-3.5 h-3.5" />}
                  label="Capture Outside"
                  description="Pointer lock: click canvas, Esc to exit."
                  checked={captureOutside}
                  onCheckedChange={onCaptureOutsideToggle}
                  indent
                />
              )}
            </fieldset>

            <fieldset>
              <legend>Autonomous Eye Saccades</legend>
              <ToggleRow
                icon={<Dna className="w-3.5 h-3.5" />}
                label="Random Eyes"
                description="Organic micro-movements, overrides mouse."
                checked={randomEyesEnabled}
                onCheckedChange={onRandomEyesToggle}
              />
              {randomEyesEnabled && (
                <div className="pl-4 pt-1">
                  <LightSlider
                    label="Saccade Radius"
                    value={randomEyesIntensity}
                    min={0.01}
                    max={0.3}
                    step={0.01}
                    decimals={2}
                    onChange={onRandomEyesIntensityChange}
                  />
                </div>
              )}
            </fieldset>

            <p className="text-[10px] text-[#555555] leading-snug">
              Global Tracking reads the system cursor. On Wayland the app relaunches on X11 (XWayland) so it works; opt out with MAGICIAN_NO_XWAYLAND=1.
            </p>
          </article>
        )}

        {activeTab === 'motion' && (
          <article role="tabpanel" className="space-y-2 max-h-[380px] overflow-y-auto">
            <fieldset>
              <legend>Voice &amp; Facial Animation</legend>
              <ToggleRow
                icon={<Mic className="w-3.5 h-3.5" />}
                label="LipSync (Mic)"
                description="Mouth open from mic amplitude."
                checked={micEnabled}
                onCheckedChange={onMicToggle}
              />
              <ToggleRow
                icon={<Eye className="w-3.5 h-3.5" />}
                label="Auto Blink"
                description="Random blinks every 3–12s."
                checked={autoBlinkEnabled}
                onCheckedChange={onAutoBlinkToggle}
              />
            </fieldset>

            <fieldset>
              <legend>Body Breathing</legend>
              <ToggleRow
                icon={<Activity className="w-3.5 h-3.5" />}
                label="Idle Sway"
                description="Natural breathing and body movement."
                checked={idleSwayEnabled}
                onCheckedChange={onIdleSwayToggle}
              />
              {idleSwayEnabled && (
                <div className="pl-4 pt-1">
                  <LightSlider
                    label="Sway Amount"
                    value={idleSwayIntensity}
                    min={0.005}
                    max={0.1}
                    step={0.005}
                    decimals={3}
                    onChange={onIdleSwayIntensityChange}
                  />
                </div>
              )}
            </fieldset>

            {micEnabled && (
              <fieldset>
                <legend>Microphone Level</legend>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#444444]">Input amplitude</span>
                  <span className={cn('text-[10px] font-bold', micReady ? 'text-[#005500]' : 'text-[#b56b00]')}>
                    {micReady ? 'Live' : micError ? 'Error' : 'Starting…'}
                  </span>
                </div>
                <progress max={100} value={Math.round(micLevel * 100)} className="w-full" />
              </fieldset>
            )}
          </article>
        )}

        {activeTab === 'scene' && (
          <article role="tabpanel" className="space-y-2">
            <fieldset>
              <legend>Background &amp; Chroma Key</legend>
              <ToggleRow
                icon={<Palette className="w-3.5 h-3.5" />}
                label="Chroma Screen"
                description="Solid key background for OBS. Pick any color."
                checked={greenScreen}
                onCheckedChange={onGreenScreenToggle}
              />
              {greenScreen && (
                <div className="ml-5 my-1 p-1.5 bg-white border border-[#7f9db9] flex items-center justify-between" data-no-drag>
                  <span className="text-[11px] text-[#000000]">Key color</span>
                  <input
                    type="color"
                    value={chromaColor}
                    onChange={(e) => onChromaColorChange(e.target.value)}
                    className="h-5 w-10 border border-[#7f9db9] bg-transparent cursor-pointer"
                    aria-label="Chroma key color"
                  />
                </div>
              )}
              <ToggleRow
                icon={<ImageIcon className="w-3.5 h-3.5" />}
                label="Custom Background"
                description="Import image as background."
                checked={hasBackground}
                onCheckedChange={(v) => (v ? onPickBackground() : onClearBackground())}
              />
            </fieldset>

            <fieldset>
              <legend>Video Capture</legend>
              <button
                type="button"
                onClick={onRecordToggle}
                className="w-full flex items-center justify-center gap-1.5 font-bold"
              >
                {isRecording ? (
                  <>
                    <Square className="w-3.5 h-3.5 text-[#c41e3a] fill-current" />
                    <span>Stop Recording · {formatDuration(recordingSec)}</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-3.5 h-3.5 text-[#c41e3a] fill-current" />
                    <span>Record Screen (.webm)</span>
                  </>
                )}
              </button>
            </fieldset>
          </article>
        )}

        {activeTab === 'camera' && (
          <article role="tabpanel" className="space-y-2 max-h-[380px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              <fieldset>
                <legend className="flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" /> Zoom
                </legend>
                <LightSlider
                  label="Zoom"
                  value={zoom}
                  min={ZOOM.MIN}
                  max={ZOOM.MAX}
                  step={0.05}
                  onChange={onZoomChange}
                />
                <p className="text-[10px] text-[#555555] leading-snug mt-1">
                  Dolly: moves the camera closer/farther without changing the lens.
                </p>
              </fieldset>

              <fieldset>
                <legend className="flex items-center gap-1">
                  <Focus className="w-3 h-3" /> Field of View
                </legend>
                <LightSlider
                  label="FOV"
                  value={fov}
                  min={CAMERA.FOV_MIN}
                  max={CAMERA.FOV_MAX}
                  step={1}
                  unit="°"
                  onChange={onFovChange}
                />
                <p className="text-[10px] text-[#555555] leading-snug mt-1">
                  Lens angle: lower = tighter, higher = wider.
                </p>
              </fieldset>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <fieldset>
                <legend className="flex items-center gap-1">
                  <Camera className="w-3 h-3" /> Projection
                </legend>
                <ToggleRow
                  icon={<Gauge className="w-3.5 h-3.5" />}
                  label="Orthographic"
                  description="Parallel projection, no perspective distortion."
                  checked={orthographic}
                  onCheckedChange={onOrthographicToggle}
                />
              </fieldset>

              <fieldset>
                <legend className="flex items-center gap-1">
                  <Rotate3d className="w-3 h-3" /> Rotation
                </legend>
                <p className="text-[10px] text-[#444444] leading-snug mb-2">
                  <strong>Ctrl</strong> + left-drag rotates model. Middle-drag moves it.
                </p>
                <button
                  type="button"
                  onClick={onResetView}
                  className="w-full flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset view</span>
                </button>
              </fieldset>
            </div>
          </article>
        )}

        {activeTab === 'lighting' && (
          <article role="tabpanel" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <fieldset>
                <legend className="flex items-center gap-1">
                  <Sun className="w-3 h-3" /> Front / Key
                </legend>
                <LightSlider
                  label="Intensity"
                  value={lighting.front}
                  min={0}
                  max={3}
                  step={0.05}
                  onChange={(v) => onLightingChange({ ...lighting, front: v })}
                />
                <LightSlider
                  label="Direction"
                  value={lighting.frontAngle}
                  min={-180}
                  max={180}
                  step={5}
                  unit="°"
                  onChange={(v) => onLightingChange({ ...lighting, frontAngle: v })}
                />
              </fieldset>

              <fieldset>
                <legend className="flex items-center gap-1">
                  <Sun className="w-3 h-3" /> Top / Fill
                </legend>
                <LightSlider
                  label="Intensity"
                  value={lighting.top}
                  min={0}
                  max={3}
                  step={0.05}
                  onChange={(v) => onLightingChange({ ...lighting, top: v })}
                />
                <LightSlider
                  label="Direction"
                  value={lighting.topAngle}
                  min={-180}
                  max={180}
                  step={5}
                  unit="°"
                  onChange={(v) => onLightingChange({ ...lighting, topAngle: v })}
                />
              </fieldset>
            </div>

            <fieldset>
              <legend>Orbit Direction</legend>
              <p className="text-[10px] text-[#444444] leading-snug mb-2">
                Direction orbits each light around the avatar (0° = straight in front).
              </p>
              <button
                type="button"
                onClick={() => onLightingChange({ ...lighting, frontAngle: 0, topAngle: 0 })}
                className="w-full flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset light direction</span>
              </button>
            </fieldset>
          </article>
        )}

        {activeTab === 'adjust' && (
          <article role="tabpanel" className="space-y-2 max-h-[380px] overflow-y-auto">
            <fieldset>
              <legend>Color Filter (100% = Neutral)</legend>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <LightSlider
                    label="Brightness"
                    value={adjust.brightness}
                    min={0}
                    max={2}
                    step={0.01}
                    percent
                    onChange={(v) => onAdjustChange({ ...adjust, brightness: v })}
                  />
                </div>
                <div>
                  <LightSlider
                    label="Saturation"
                    value={adjust.saturation}
                    min={0}
                    max={2}
                    step={0.01}
                    percent
                    onChange={(v) => onAdjustChange({ ...adjust, saturation: v })}
                  />
                </div>
                <div>
                  <LightSlider
                    label="Contrast"
                    value={adjust.contrast}
                    min={0}
                    max={2}
                    step={0.01}
                    percent
                    onChange={(v) => onAdjustChange({ ...adjust, contrast: v })}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Hue &amp; Temperature</legend>
              <LightSlider
                label="Hue"
                value={adjust.hue}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={(v) => onAdjustChange({ ...adjust, hue: v })}
              />
              <LightSlider
                label="Temperature"
                value={adjust.temperature}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => onAdjustChange({ ...adjust, temperature: v })}
              />
            </fieldset>

            <fieldset>
              <legend>Exposure &amp; Tone Mapping</legend>
              <LightSlider
                label="Exposure"
                value={adjust.exposure}
                min={0}
                max={2}
                step={0.01}
                percent
                onChange={(v) => onAdjustChange({ ...adjust, exposure: v })}
              />
              <div className="grid grid-cols-5 gap-1 pt-1">
                {TONE_MAPPINGS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onAdjustChange({ ...adjust, toneMapping: t.value })}
                    className={cn(
                      'xp-compact-btn text-[10px]',
                      adjust.toneMapping === t.value && 'active font-bold',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => onAdjustChange({
                brightness: 1, saturation: 1, contrast: 1, hue: 0,
                temperature: 0, exposure: 1, toneMapping: 'neutral',
              })}
              className="w-full flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset all to neutral (100%)</span>
            </button>
          </article>
        )}
      </div>

      <div className="status-bar">
        <p className="status-bar-field flex items-center gap-1">
          <StatusPill status={vrmStatus} error={vrmError} />
        </p>
        <p className="status-bar-field">FOV: {fov}° · Zoom: {zoom.toFixed(2)}x</p>
      </div>
    </div>
  );
}
