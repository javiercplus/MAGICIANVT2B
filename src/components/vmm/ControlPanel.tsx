'use client';

import {
  MousePointerClick, Mic, Eye, RotateCcw, AlertCircle,
  Square, Circle, Palette, Crosshair,
  Image as ImageIcon, Sun, Activity, Dna, SlidersHorizontal, ZoomIn, Monitor,
  Camera, Focus, Rotate3d, Gauge,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <Card className={cn(
      'w-[440px] max-w-[calc(100vw-2rem)] bg-zinc-900/85 border-zinc-800',
      'backdrop-blur-md shadow-2xl shadow-black/40 text-zinc-100'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold tracking-wide text-zinc-200">Options</CardTitle>
          <StatusPill status={vrmStatus} error={vrmError} />
        </div>
        <p className="text-xs text-zinc-400 truncate" title={vrmName}>{vrmName}</p>
        {(vrmError || micError) && (
          <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/40 rounded-md p-1.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-tight">{vrmError || micError}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <Tabs defaultValue="tracking" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-zinc-800/60 h-8">
            <TabsTrigger value="tracking" className="text-[9px] px-0 uppercase tracking-wider">Track</TabsTrigger>
            <TabsTrigger value="motion" className="text-[9px] px-0 uppercase tracking-wider">Motion</TabsTrigger>
            <TabsTrigger value="scene" className="text-[9px] px-0 uppercase tracking-wider">Scene</TabsTrigger>
            <TabsTrigger value="camera" className="text-[9px] px-0 uppercase tracking-wider">Camera</TabsTrigger>
            <TabsTrigger value="lighting" className="text-[9px] px-0 uppercase tracking-wider">Light</TabsTrigger>
            <TabsTrigger value="adjust" className="text-[9px] px-0 uppercase tracking-wider">Color</TabsTrigger>
          </TabsList>

          <TabsContent value="tracking" className="mt-3 space-y-3">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1 pr-1">
                <ToggleRow icon={<MousePointerClick className="w-4 h-4" />}
                  label="Gaze Tracking" description="Head + eyes follow mouse. Off = forward."
                  checked={gazeEnabled} onCheckedChange={onGazeToggle} accentClass="bg-violet-500/20 text-violet-300" />
                {gazeEnabled && (
                  <ToggleRow icon={<Monitor className="w-3.5 h-3.5" />}
                    label="Global Tracking" description="Follow cursor even outside the window."
                    checked={globalTracking} onCheckedChange={onGlobalTrackingToggle}
                    accentClass="bg-emerald-500/20 text-emerald-300" indent />
                )}
                {gazeEnabled && !globalTracking && (
                  <ToggleRow icon={<Crosshair className="w-3.5 h-3.5" />}
                    label="Capture Outside" description="Pointer lock: click canvas, Esc to exit."
                    checked={captureOutside} onCheckedChange={onCaptureOutsideToggle}
                    accentClass="bg-indigo-500/20 text-indigo-300" indent />
                )}
                <ToggleRow icon={<Dna className="w-4 h-4" />}
                  label="Random Eyes" description="Organic micro-movements, overrides mouse."
                  checked={randomEyesEnabled} onCheckedChange={onRandomEyesToggle} accentClass="bg-sky-500/20 text-sky-300" />
                {randomEyesEnabled && (
                  <div className="ml-11 mr-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800/60">
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
              </div>
            </ScrollArea>
            <p className="text-[10px] text-zinc-500 leading-snug">
              Global Tracking reads the system cursor. On Wayland the app relaunches on X11 (XWayland) so it works; opt out with MAGICIAN_NO_XWAYLAND=1.
            </p>
          </TabsContent>

          <TabsContent value="motion" className="mt-3 space-y-3">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1 pr-1">
                <ToggleRow icon={<Mic className="w-4 h-4" />}
                  label="LipSync (Mic)" description="Mouth open from mic amplitude."
                  checked={micEnabled} onCheckedChange={onMicToggle} accentClass="bg-fuchsia-500/20 text-fuchsia-300" />
                <ToggleRow icon={<Eye className="w-4 h-4" />}
                  label="Auto Blink" description="Random blinks every 3–12s."
                  checked={autoBlinkEnabled} onCheckedChange={onAutoBlinkToggle} accentClass="bg-emerald-500/20 text-emerald-300" />
                <ToggleRow icon={<Activity className="w-4 h-4" />}
                  label="Idle Sway" description="Natural breathing and body movement."
                  checked={idleSwayEnabled} onCheckedChange={onIdleSwayToggle} accentClass="bg-amber-500/20 text-amber-300" />
                {idleSwayEnabled && (
                  <div className="ml-11 mr-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800/60">
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
              </div>
            </ScrollArea>

            {micEnabled && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Mic level</span>
                  <span className={cn('text-[10px]', micReady ? 'text-zinc-400' : 'text-amber-400')}>
                    {micReady ? 'Live' : micError ? 'Error' : 'Starting…'}
                  </span>
                </div>
                <Progress value={Math.round(micLevel * 100)} className="h-1.5 bg-zinc-800" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="scene" className="mt-3 space-y-2">
            <div className="space-y-1">
              <ToggleRow icon={<Palette className="w-4 h-4" />}
                label="Chroma Screen" description="Solid key background for OBS. Pick any color."
                checked={greenScreen} onCheckedChange={onGreenScreenToggle} accentClass="bg-emerald-500/20 text-emerald-300" />
              {greenScreen && (
                <div className="ml-11 mr-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Key color</span>
                  <input
                    type="color"
                    value={chromaColor}
                    onChange={(e) => onChromaColorChange(e.target.value)}
                    className="h-6 w-10 rounded border border-zinc-700 bg-transparent cursor-pointer"
                    aria-label="Chroma key color"
                  />
                </div>
              )}
              <ToggleRow icon={<ImageIcon className="w-4 h-4" />}
                label="Custom Background" description="Import image as background."
                checked={hasBackground} onCheckedChange={(v) => v ? onPickBackground() : onClearBackground()}
                accentClass="bg-sky-500/20 text-sky-300" />
            </div>
            <Button type="button" size="sm" onClick={onRecordToggle}
              className={cn('w-full justify-center font-medium',
                isRecording ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-rose-600/80 hover:bg-rose-500 text-white')}>
              {isRecording ? (
                <><Square className="w-3.5 h-3.5 mr-1.5 fill-current" />Stop · {formatDuration(recordingSec)}</>
              ) : (
                <><Circle className="w-3 h-3 mr-1.5 fill-current" />Record screen</>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="camera" className="mt-3 space-y-2">
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2 pr-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <ZoomIn className="w-3.5 h-3.5 text-violet-300" />Zoom
                    </div>
                    <LightSlider
                      label="Zoom"
                      value={zoom}
                      min={ZOOM.MIN}
                      max={ZOOM.MAX}
                      step={0.05}
                      onChange={onZoomChange}
                    />
                    <p className="text-[10px] text-zinc-500 leading-snug">
                      Dolly: moves the camera closer/farther without changing the lens.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Focus className="w-3.5 h-3.5 text-amber-300" />Field of view
                    </div>
                    <LightSlider
                      label="FOV"
                      value={fov}
                      min={CAMERA.FOV_MIN}
                      max={CAMERA.FOV_MAX}
                      step={1}
                      unit="°"
                      onChange={onFovChange}
                    />
                    <p className="text-[10px] text-zinc-500 leading-snug">
                      Lens angle: lower = tighter, higher = wider. Does not move the camera.
                      {orthographic && ' In ortho it sets the base framing.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Camera className="w-3.5 h-3.5 text-sky-300" />Projection
                    </div>
                    <ToggleRow icon={<Gauge className="w-3.5 h-3.5" />}
                      label="Orthographic"
                      description="Parallel projection, no perspective distortion."
                      checked={orthographic} onCheckedChange={onOrthographicToggle}
                      accentClass="bg-sky-500/20 text-sky-300" />
                  </div>

                  <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Rotate3d className="w-3.5 h-3.5 text-emerald-300" />Rotation
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-snug">
                      <span className="text-zinc-300">Ctrl</span> + left-drag over the canvas rotates
                      the model. Middle-drag moves it.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onResetView}
                      className="w-full h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset view
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="lighting" className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                  <Sun className="w-3.5 h-3.5 text-amber-300" />Front / key
                </div>
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
              </div>

              <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                  <Sun className="w-3.5 h-3.5 text-sky-300" />Top / fill
                </div>
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
              </div>
            </div>

            <div className="rounded-lg p-2 bg-zinc-800/30 border border-zinc-800 space-y-1">
              <p className="text-[10px] text-zinc-500 leading-snug">
                Direction orbits each light around the avatar (0° = straight in front).
                Negative values move it to the viewer&apos;s right, positive to the left.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onLightingChange({ ...lighting, frontAngle: 0, topAngle: 0 })}
                className="w-full h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset light direction
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="adjust" className="mt-3 space-y-2">
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2 pr-1">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Color filter</span>
                  <span className="text-[10px] text-zinc-500">100% = neutral</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-200">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300 shrink-0" />Bright.
                    </div>
                    <LightSlider
                      label="Amount"
                      value={adjust.brightness}
                      min={0}
                      max={2}
                      step={0.01}
                      percent
                      onChange={(v) => onAdjustChange({ ...adjust, brightness: v })}
                    />
                  </div>

                  <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-200">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-fuchsia-300 shrink-0" />Satur.
                    </div>
                    <LightSlider
                      label="Amount"
                      value={adjust.saturation}
                      min={0}
                      max={2}
                      step={0.01}
                      percent
                      onChange={(v) => onAdjustChange({ ...adjust, saturation: v })}
                    />
                  </div>

                  <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-200">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-sky-300 shrink-0" />Contrast
                    </div>
                    <LightSlider
                      label="Amount"
                      value={adjust.contrast}
                      min={0}
                      max={2}
                      step={0.01}
                      percent
                      onChange={(v) => onAdjustChange({ ...adjust, contrast: v })}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                    <Palette className="w-3.5 h-3.5 text-violet-300" />Hue &amp; temperature
                  </div>
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
                </div>

                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                    <Sun className="w-3.5 h-3.5 text-orange-300" />Exposure &amp; tone mapping
                  </div>
                  <LightSlider
                    label="Exposure"
                    value={adjust.exposure}
                    min={0}
                    max={2}
                    step={0.01}
                    percent
                    onChange={(v) => onAdjustChange({ ...adjust, exposure: v })}
                  />
                  <div className="grid grid-cols-5 gap-1">
                    {TONE_MAPPINGS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => onAdjustChange({ ...adjust, toneMapping: t.value })}
                        className={cn(
                          'text-[9px] py-1 rounded border transition-colors',
                          adjust.toneMapping === t.value
                            ? 'bg-violet-600/30 border-violet-500/50 text-violet-100'
                            : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Tone mapping is applied once after the 3D pass, so MToon colors are not
                    double-mapped. Neutral keeps skin and clothing colors closest to the source.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAdjustChange({
                    brightness: 1, saturation: 1, contrast: 1, hue: 0,
                    temperature: 0, exposure: 1, toneMapping: 'neutral',
                  })}
                  className="w-full h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset all to neutral (100%)
                </Button>

                <p className="text-[10px] text-zinc-500 leading-snug">
                  Color adjustments apply to the rendered avatar and are included in recordings.
                </p>
              </div>
            </ScrollArea>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
}
