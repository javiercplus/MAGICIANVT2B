'use client';

import {
  Upload, RotateCcw, Save, AlertCircle, Sparkles, Wand2, Dna, X, Shirt, Wind,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { LightSlider, StatusPill, type VrmStatus } from './controls';
import {
  DEFAULT_MTOON, DEFAULT_WIND,
  type MToonConfig, type ShaderConfig, type ShaderPreset, type WindConfig,
} from '@/lib/vrm/constants';

const SHADER_PRESETS: { value: ShaderPreset; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'hologram', label: 'Hologram' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'glow', label: 'Glow' },
  { value: 'scanline', label: 'Scanline' },
  { value: 'outline', label: 'Outline' },
  { value: 'chromatic', label: 'Chromatic' },
  { value: 'pixel', label: 'Pixel' },
];

interface AvatarPanelProps {
  vrmName: string;
  vrmStatus: VrmStatus;
  vrmError: string | null;
  mtoon: MToonConfig;
  shader: ShaderConfig;
  wind: WindConfig;
  onMtoonChange: (m: MToonConfig) => void;
  onShaderChange: (s: ShaderConfig) => void;
  onWindChange: (w: WindConfig) => void;
  onPickFile: () => void;
  onResetVRM: () => void;
  onSaveConfig: () => void;
  onClose: () => void;
}

export function AvatarPanel({
  vrmName, vrmStatus, vrmError, mtoon, shader, wind,
  onMtoonChange, onShaderChange, onWindChange, onPickFile, onResetVRM, onSaveConfig, onClose,
}: AvatarPanelProps) {
  return (
    <Card className={cn(
      'w-[430px] max-w-[calc(100vw-2rem)] bg-zinc-900/90 border-zinc-800',
      'backdrop-blur-md shadow-2xl shadow-black/50 text-zinc-100',
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center rounded-md w-7 h-7 bg-violet-500/20 text-violet-300 shrink-0">
              <Shirt className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold tracking-wide text-zinc-200">VRM model</CardTitle>
              <p className="text-[11px] text-zinc-400 truncate" title={vrmName}>{vrmName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={vrmStatus} error={vrmError} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close VRM model"
              className="w-7 h-7 rounded-md bg-zinc-800/70 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {vrmError && (
          <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/40 rounded-md p-1.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-tight">{vrmError}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <Tabs defaultValue="avatar" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-zinc-800/60 h-8">
            <TabsTrigger value="avatar" className="text-[9px] uppercase tracking-wider">Model</TabsTrigger>
            <TabsTrigger value="mtoon" className="text-[9px] uppercase tracking-wider">MToon</TabsTrigger>
            <TabsTrigger value="effects" className="text-[9px] uppercase tracking-wider">Effects</TabsTrigger>
            <TabsTrigger value="wind" className="text-[9px] uppercase tracking-wider">Wind</TabsTrigger>
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
              <Save className="w-3.5 h-3.5 mr-1.5" />Save Config &amp; Avatar
            </Button>

            <div className="rounded-lg p-2 bg-zinc-800/30 border border-zinc-800 space-y-1">
              <p className="text-[11px] text-zinc-400 leading-snug">
                Drag a <span className="text-zinc-200">.vrm</span> anywhere in the window, or use
                <span className="text-zinc-200"> Open .vrm</span>.
              </p>
              <p className="text-[10px] text-zinc-500 leading-snug">
                Middle-drag moves the avatar. Ctrl + left-drag rotates it.
                Both are reset from Camera → Reset view.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="mtoon" className="mt-3 space-y-2">
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-2 pr-1">
                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Dna className="w-3.5 h-3.5 text-emerald-300" />MToon look
                    </div>
                    <Switch
                      checked={mtoon.enabled}
                      onCheckedChange={(v) => onMtoonChange({ ...mtoon, enabled: v })}
                    />
                  </div>

                  {mtoon.enabled && (
                    <>
                      <LightSlider
                        label="Toon shading"
                        value={mtoon.toony}
                        min={0}
                        max={1}
                        step={0.01}
                        percent
                        onChange={(v) => onMtoonChange({ ...mtoon, toony: v })}
                      />
                      <LightSlider
                        label="GI equalization"
                        value={mtoon.gi}
                        min={0}
                        max={1}
                        step={0.01}
                        percent
                        onChange={(v) => onMtoonChange({ ...mtoon, gi: v })}
                      />
                      <LightSlider
                        label="Shade shift"
                        value={mtoon.shadingShift}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(v) => onMtoonChange({ ...mtoon, shadingShift: v })}
                      />
                      <LightSlider
                        label="Color boost"
                        value={mtoon.colorBoost}
                        min={0}
                        max={2}
                        step={0.01}
                        percent
                        onChange={(v) => onMtoonChange({ ...mtoon, colorBoost: v })}
                      />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <LightSlider
                          label="Rim light"
                          value={mtoon.rim}
                          min={0}
                          max={1}
                          step={0.01}
                          percent
                          onChange={(v) => onMtoonChange({ ...mtoon, rim: v })}
                        />
                        <LightSlider
                          label="Rim power"
                          value={mtoon.rimPower}
                          min={1}
                          max={8}
                          step={0.1}
                          onChange={(v) => onMtoonChange({ ...mtoon, rimPower: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Rim color</span>
                        <input
                          type="color"
                          value={mtoon.rimColor}
                          onChange={(e) => onMtoonChange({ ...mtoon, rimColor: e.target.value })}
                          className="h-6 w-10 rounded border border-zinc-700 bg-transparent cursor-pointer"
                          aria-label="Rim color"
                        />
                      </div>
                    </>
                  )}

                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Applied to every MToon material. Color textures are read as sRGB and materials
                    do not tone map twice, so skin and fabric keep their source colors.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onMtoonChange({ ...DEFAULT_MTOON })}
                      className="h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200 text-[10px]"
                    >
                      Recommended
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onMtoonChange({ ...mtoon, enabled: false })}
                      className="h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200 text-[10px]"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />Model values
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="effects" className="mt-3 space-y-2">
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-2 pr-1">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Preset</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SHADER_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => onShaderChange({
                          ...shader,
                          preset: p.value,
                          intensity: p.value === 'off' ? shader.intensity : Math.max(shader.intensity, 0.05),
                        })}
                        className={cn(
                          'text-[10px] py-1.5 rounded-md border transition-colors',
                          shader.preset === p.value
                            ? 'bg-violet-600/30 border-violet-500/50 text-violet-100'
                            : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Sparkles className="w-3.5 h-3.5 text-violet-300" />Effect
                    </div>
                    <input
                      type="color"
                      value={shader.color}
                      onChange={(e) => onShaderChange({ ...shader, color: e.target.value })}
                      className="h-6 w-10 rounded border border-zinc-700 bg-transparent cursor-pointer"
                      aria-label="Effect color"
                    />
                  </div>
                  <LightSlider
                    label={shader.preset === 'outline' ? 'Outline width' : 'Intensity'}
                    value={shader.intensity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => onShaderChange({ ...shader, intensity: v })}
                  />
                  {(shader.preset === 'hologram' || shader.preset === 'scanline') && (
                    <LightSlider
                      label="Scanline density"
                      value={shader.scanline}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => onShaderChange({ ...shader, scanline: v })}
                    />
                  )}
                  {shader.preset === 'dissolve' && (
                    <LightSlider
                      label="Dissolve"
                      value={shader.dissolve}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => onShaderChange({ ...shader, dissolve: v })}
                    />
                  )}
                </div>

                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                    <Wand2 className="w-3.5 h-3.5 text-amber-300" />Bloom
                  </div>
                  <LightSlider
                    label="Strength"
                    value={shader.bloom}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={(v) => onShaderChange({ ...shader, bloom: v })}
                  />
                  <LightSlider
                    label="Radius"
                    value={shader.bloomRadius}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => onShaderChange({ ...shader, bloomRadius: v })}
                  />
                  <LightSlider
                    label="Threshold"
                    value={shader.bloomThreshold}
                    min={0}
                    max={3}
                    step={0.05}
                    onChange={(v) => onShaderChange({ ...shader, bloomThreshold: v })}
                  />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="wind" className="mt-3 space-y-2">
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-2 pr-1">
                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Wind className="w-3.5 h-3.5 text-cyan-300" />Wind
                    </div>
                    <Switch
                      checked={wind.enabled}
                      onCheckedChange={(v) => onWindChange({ ...wind, enabled: v })}
                    />
                  </div>

                  {wind.enabled && (
                    <>
                      <LightSlider
                        label="Strength"
                        value={wind.strength}
                        min={0}
                        max={3}
                        step={0.05}
                        onChange={(v) => onWindChange({ ...wind, strength: v })}
                      />
                      <LightSlider
                        label="Direction"
                        value={wind.direction}
                        min={0}
                        max={360}
                        step={1}
                        unit="°"
                        onChange={(v) => onWindChange({ ...wind, direction: v })}
                      />
                      <LightSlider
                        label="Gusts"
                        value={wind.gusts}
                        min={0}
                        max={1}
                        step={0.05}
                        percent
                        onChange={(v) => onWindChange({ ...wind, gusts: v })}
                      />
                    </>
                  )}

                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Breeze on hair, skirt and ribbons, driven by the VRM spring bones.
                    It needs Physics quality Medium/High in the optimization panel.
                    Direction is world-space (0° = right, 90° = away from camera).
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onWindChange({ ...DEFAULT_WIND, enabled: wind.enabled })}
                    className="w-full h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset wind
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
