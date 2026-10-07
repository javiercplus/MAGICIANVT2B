'use client';

import {
  MousePointerClick, Mic, Eye, Upload, RotateCcw, AlertCircle,
  Loader2, CircleCheck, Square, Circle, Palette, Crosshair,
  Image as ImageIcon, Sun, RotateCw, Save, Activity, Dna,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { LightingConfig, LightConfig } from '@/lib/vrm/constants';

interface ControlPanelProps {
  vrmName: string;
  vrmStatus: 'idle' | 'loading' | 'loaded' | 'error';
  vrmError: string | null;
  gazeEnabled: boolean;
  captureOutside: boolean;
  micEnabled: boolean;
  autoBlinkEnabled: boolean;
  randomEyesEnabled: boolean;
  randomEyesIntensity: number;
  idleSwayEnabled: boolean;
  idleSwayIntensity: number;
  greenScreen: boolean;
  hasBackground: boolean;
  micLevel: number;
  micReady: boolean;
  micError: string | null;
  isRecording: boolean;
  recordingSec: number;
  lighting: LightingConfig;
  onGazeToggle: (v: boolean) => void;
  onCaptureOutsideToggle: (v: boolean) => void;
  onMicToggle: (v: boolean) => void;
  onAutoBlinkToggle: (v: boolean) => void;
  onRandomEyesToggle: (v: boolean) => void;
  onRandomEyesIntensityChange: (v: number) => void;
  onIdleSwayToggle: (v: boolean) => void;
  onIdleSwayIntensityChange: (v: number) => void;
  onGreenScreenToggle: (v: boolean) => void;
  onLightingChange: (l: LightingConfig) => void;
  onPickFile: () => void;
  onResetVRM: () => void;
  onPickBackground: () => void;
  onClearBackground: () => void;
  onRecordToggle: () => void;
  onSaveConfig: () => void;
}

function StatusPill({ status, error }: { status: ControlPanelProps['vrmStatus']; error?: string | null }) {
  if (status === 'loading') return (
    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
      <Loader2 className="w-3 h-3 mr-1 animate-spin" />Loading
    </Badge>
  );
  if (status === 'error' || error) return (
    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40">
      <AlertCircle className="w-3 h-3 mr-1" />Error
    </Badge>
  );
  if (status === 'loaded') return (
    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
      <CircleCheck className="w-3 h-3 mr-1" />Loaded
    </Badge>
  );
  return <Badge className="bg-zinc-700/40 text-zinc-400 border-zinc-600/40">Idle</Badge>;
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accentClass?: string;
  indent?: boolean;
}

function ToggleRow({ icon, label, description, checked, onCheckedChange, accentClass, indent }: ToggleRowProps) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg p-2 hover:bg-zinc-800/40 transition-colors', indent && 'ml-8')}>
      <div className={cn('flex items-center justify-center rounded-md w-7 h-7 shrink-0 mt-0.5',
        checked ? accentClass ?? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800/60 text-zinc-500')}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <Label htmlFor={`toggle-${label}`} className="text-sm font-medium text-zinc-100 cursor-pointer">{label}</Label>
        <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">{description}</p>
      </div>
      <Switch id={`toggle-${label}`} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface LightSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
}

function LightSlider({ label, value, min, max, step, unit, decimals = 2, onChange }: LightSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className="text-[11px] text-zinc-300 tabular-nums">
          {Number.isInteger(step) ? value : value.toFixed(decimals)}{unit ?? ''}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="h-1.5"
      />
    </div>
  );
}

function LightSection({
  name, icon, light, onChange,
}: {
  name: string;
  icon: React.ReactNode;
  light: LightConfig;
  onChange: (l: LightConfig) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
        {icon}
        {name}
      </div>
      <LightSlider
        label="Angle"
        value={light.angle}
        min={0}
        max={360}
        step={1}
        unit="°"
        onChange={(v) => onChange({ ...light, angle: v })}
      />
      <LightSlider
        label="Intensity"
        value={light.intensity}
        min={0}
        max={3}
        step={0.05}
        onChange={(v) => onChange({ ...light, intensity: v })}
      />
    </div>
  );
}

export function ControlPanel(props: ControlPanelProps) {
  const {
    vrmName, vrmStatus, vrmError,
    gazeEnabled, captureOutside, micEnabled, autoBlinkEnabled, randomEyesEnabled, randomEyesIntensity, idleSwayEnabled, idleSwayIntensity, greenScreen, hasBackground,
    micLevel, micReady, micError,
    isRecording, recordingSec,
    lighting,
    onGazeToggle, onCaptureOutsideToggle, onMicToggle, onAutoBlinkToggle, onRandomEyesToggle, onRandomEyesIntensityChange, onIdleSwayToggle, onIdleSwayIntensityChange, onGreenScreenToggle,
    onLightingChange,
    onPickFile, onResetVRM, onPickBackground, onClearBackground, onRecordToggle, onSaveConfig,
  } = props;

  return (
    <Card className={cn(
      'w-[300px] max-w-[calc(100vw-2rem)] bg-zinc-900/85 border-zinc-800',
      'backdrop-blur-md shadow-2xl shadow-black/40 text-zinc-100'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold tracking-wide text-zinc-200">Avatar</CardTitle>
          <StatusPill status={vrmStatus} error={vrmError} />
        </div>
        <p className="text-xs text-zinc-400 truncate" title={vrmName}>{vrmName}</p>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <Tabs defaultValue="avatar" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-zinc-800/60 h-8">
            <TabsTrigger value="avatar" className="text-[10px] uppercase tracking-wider">Avatar</TabsTrigger>
            <TabsTrigger value="motion" className="text-[10px] uppercase tracking-wider">Motion</TabsTrigger>
            <TabsTrigger value="scene" className="text-[10px] uppercase tracking-wider">Scene</TabsTrigger>
            <TabsTrigger value="lighting" className="text-[10px] uppercase tracking-wider">Light</TabsTrigger>
          </TabsList>

          <TabsContent value="avatar" className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onPickFile}
                className="bg-violet-600/20 border-violet-500/40 hover:bg-violet-600/40 hover:text-white text-violet-100">
                <Upload className="w-3.5 h-3.5 mr-1.5" />Open .vrm
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onResetVRM}
                className="bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Sample
              </Button>
            </div>
            
            <Button type="button" variant="outline" size="sm" onClick={onSaveConfig}
              className="w-full bg-emerald-600/20 border-emerald-500/40 hover:bg-emerald-600/40 hover:text-white text-emerald-100">
              <Save className="w-3.5 h-3.5 mr-1.5" />Save Config & Avatar
            </Button>

            <p className="text-[11px] text-zinc-500 leading-snug">
              Drag a .vrm anywhere, or <span className="text-zinc-300">Open .vrm</span>.
              Middle-click drag to move avatar.
            </p>

            <Button type="button" size="sm" onClick={onRecordToggle}
              className={cn('w-full justify-center font-medium',
                isRecording ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-rose-600/80 hover:bg-rose-500 text-white')}>
              {isRecording ? (
                <><Square className="w-3.5 h-3.5 mr-1.5 fill-current" />Stop · {formatDuration(recordingSec)}</>
              ) : (
                <><Circle className="w-3 h-3 mr-1.5 fill-current" />Record screen</>
              )}
            </Button>

            {(vrmError || micError) && (
              <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/40 rounded-md p-2 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="leading-tight">{vrmError || micError}</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="motion" className="mt-3 space-y-3">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1 pr-1">
                <ToggleRow icon={<MousePointerClick className="w-4 h-4" />}
                  label="Gaze Tracking" description="Head + eyes follow mouse. Off = forward."
                  checked={gazeEnabled} onCheckedChange={onGazeToggle} accentClass="bg-violet-500/20 text-violet-300" />
                {gazeEnabled && (
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
                label="Green Screen" description="Chroma-key background for OBS."
                checked={greenScreen} onCheckedChange={onGreenScreenToggle} accentClass="bg-emerald-500/20 text-emerald-300" />
              <ToggleRow icon={<ImageIcon className="w-4 h-4" />}
                label="Custom Background" description="Import image as background."
                checked={hasBackground} onCheckedChange={(v) => v ? onPickBackground() : onClearBackground()}
                accentClass="bg-sky-500/20 text-sky-300" />
            </div>
          </TabsContent>

          <TabsContent value="lighting" className="mt-3 space-y-2">
            <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                <Sun className="w-3.5 h-3.5" />Ambient
              </div>
              <LightSlider
                label="Intensity"
                value={lighting.ambient}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => onLightingChange({ ...lighting, ambient: v })}
              />
            </div>

            <LightSection name="Key" icon={<Sun className="w-3.5 h-3.5 text-amber-300" />}
              light={lighting.key}
              onChange={(l) => onLightingChange({ ...lighting, key: l })} />
            <LightSection name="Fill" icon={<Sun className="w-3.5 h-3.5 text-sky-300" />}
              light={lighting.fill}
              onChange={(l) => onLightingChange({ ...lighting, fill: l })} />
            <LightSection name="Rim" icon={<Sun className="w-3.5 h-3.5 text-violet-300" />}
              light={lighting.rim}
              onChange={(l) => onLightingChange({ ...lighting, rim: l })} />
            <LightSection name="Back" icon={<RotateCw className="w-3.5 h-3.5 text-zinc-300" />}
              light={lighting.back}
              onChange={(l) => onLightingChange({ ...lighting, back: l })} />

            <p className="text-[10px] text-zinc-500 leading-snug pt-1">
              Angle: 0° = front, 90° = right, 180° = back, 270° = left.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
