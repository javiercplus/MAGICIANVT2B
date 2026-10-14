'use client';

import { Cpu, Gauge, MonitorCog, Sparkles, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { OptimizationConfig, PhysicsQuality, Telemetry } from '@/lib/vrm/constants';

interface OptimizationPanelProps {
  config: OptimizationConfig;
  telemetry: Telemetry;
  onChange: (config: OptimizationConfig) => void;
  onClose: () => void;
}

const PHYSICS_LABELS: PhysicsQuality[] = ['low', 'medium', 'high'];

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
}

// Slider + numeric input: every control is finely adjustable, not a binary toggle.
function RangeField({ label, value, min, max, step, unit, decimals = 2, onChange }: RangeFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-300">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number.isInteger(step) ? value : Number(value.toFixed(decimals))}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChange(Math.min(max, Math.max(min, n)));
            }}
            className="w-16 bg-zinc-900/70 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-100 tabular-nums text-right focus:outline-none focus:border-violet-500/60"
          />
          {unit && <span className="text-[10px] text-zinc-500">{unit}</span>}
        </div>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} className="h-1.5" />
    </div>
  );
}

function SwitchRow({
  label, description, checked, onCheckedChange, accentClass,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accentClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg p-2 hover:bg-zinc-800/40 transition-colors">
      <div className={cn('flex items-center justify-center rounded-md w-7 h-7 shrink-0 mt-0.5',
        checked ? accentClass ?? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800/60 text-zinc-500')}>
        <Sparkles className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <Label htmlFor={`opt-${label}`} className="text-sm font-medium text-zinc-100 cursor-pointer">{label}</Label>
        <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">{description}</p>
      </div>
      <Switch id={`opt-${label}`} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function StatRow({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-2 bg-zinc-800/30 border border-zinc-800">
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-300">{label}</p>
        {hint && <p className="text-[10px] text-zinc-500 leading-tight">{hint}</p>}
      </div>
      <span className={cn('text-sm font-semibold tabular-nums', warn ? 'text-amber-300' : 'text-emerald-300')}>
        {value}
      </span>
    </div>
  );
}

export function OptimizationPanel({ config, telemetry, onChange, onClose }: OptimizationPanelProps) {
  const set = <K extends keyof OptimizationConfig>(key: K, value: OptimizationConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <Card className={cn(
      'w-[380px] max-w-[calc(100vw-2rem)] bg-zinc-900/90 border-zinc-800',
      'backdrop-blur-md shadow-2xl shadow-black/40 text-zinc-100',
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-violet-300" />
            <CardTitle className="text-sm font-semibold tracking-wide text-zinc-200">Optimization</CardTitle>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-100" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <Tabs defaultValue="render" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-800/60 h-8">
            <TabsTrigger value="render" className="text-[10px] uppercase tracking-wider">
              <MonitorCog className="w-3 h-3 mr-1" />Render
            </TabsTrigger>
            <TabsTrigger value="vrm" className="text-[10px] uppercase tracking-wider">
              <Cpu className="w-3 h-3 mr-1" />VRM
            </TabsTrigger>
            <TabsTrigger value="telemetry" className="text-[10px] uppercase tracking-wider">
              <Gauge className="w-3 h-3 mr-1" />Stats
            </TabsTrigger>
          </TabsList>

          {/* ================= PESTAÑA 1: RENDERIZADO ================= */}
          <TabsContent value="render" className="mt-3 space-y-3">
            <div className="space-y-3 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
              <RangeField
                label="FPS limit"
                value={config.fpsLimit}
                min={15}
                max={60}
                step={1}
                onChange={(v) => set('fpsLimit', v)}
              />
              <p className="text-[10px] text-zinc-500 leading-snug">
                Caps the render loop; frames over budget are skipped.
              </p>
            </div>

            <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
              <RangeField
                label="Render resolution"
                value={config.renderScale}
                min={0.25}
                max={1}
                step={0.05}
                unit={`${Math.round(config.renderScale * 100)}%`}
                onChange={(v) => set('renderScale', v)}
              />
              {/* NOTE: this scales the composer's internal WebGLRenderTarget only;
                  the canvas CSS size is untouched, so the Electron UI stays sharp. */}
              <SwitchRow
                label="FXAA"
                description="Light post-AA that hides edge aliasing when internal res is low. No MSAA cost."
                checked={config.antiAlias}
                onCheckedChange={(v) => set('antiAlias', v)}
                accentClass="bg-sky-500/20 text-sky-300"
              />
            </div>

            <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
              <RangeField
                label="Pixel ratio"
                value={config.pixelRatio}
                min={0.5}
                max={1.5}
                step={0.05}
                onChange={(v) => set('pixelRatio', v)}
              />
              <p className="text-[10px] text-zinc-500 leading-snug">renderer.setPixelRatio()</p>
            </div>
          </TabsContent>

          {/* ================= PESTAÑA 2: VRM BOOST ================= */}
          <TabsContent value="vrm" className="mt-3 space-y-3">
            <div className="space-y-3 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
              <RangeField
                label={`Physics quality (${PHYSICS_LABELS[config.physicsQuality === 'low' ? 0 : config.physicsQuality === 'medium' ? 1 : 2].toUpperCase()})`}
                value={config.physicsQuality === 'low' ? 0 : config.physicsQuality === 'medium' ? 1 : 2}
                min={0}
                max={2}
                step={1}
                onChange={(v) => set('physicsQuality', PHYSICS_LABELS[Math.round(v)])}
              />
              <p className="text-[10px] text-zinc-500 leading-snug">
                Throttles the spring-bone solver (low = 10 Hz, medium = 20 Hz, high = every frame).
                Backs off further when the avatar is idle.
              </p>
            </div>

            <SwitchRow
              label="Morph optimization"
              description="Skip expression solving (morphTargetInfluences) when face weights don't change."
              checked={config.morphOptimization}
              onCheckedChange={(v) => set('morphOptimization', v)}
              accentClass="bg-fuchsia-500/20 text-fuchsia-300"
            />

            <SwitchRow
              label="MToon low-power"
              description="Swap expensive MToon materials for MeshLambertMaterial. Reversible, live."
              checked={config.mtoonLowPower}
              onCheckedChange={(v) => set('mtoonLowPower', v)}
              accentClass="bg-amber-500/20 text-amber-300"
            />
          </TabsContent>

          {/* ================= PESTAÑA 3: TELEMETRÍA ================= */}
          <TabsContent value="telemetry" className="mt-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Live · 500 ms</span>
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                {telemetry.fps} FPS
              </Badge>
            </div>
            <StatRow label="FPS (real)" value={`${telemetry.fps}`} hint="Rendered frames per second" />
            <StatRow
              label="GPU textures"
              value={`${telemetry.textures}`}
              hint="renderer.info.memory.textures — rising on reloads = leak"
              warn={false}
            />
            <StatRow label="Draw calls" value={`${telemetry.calls}`} hint="renderer.info.render.calls" />
            <StatRow label="Geometries" value={`${telemetry.geometries}`} hint="renderer.info.memory.geometries" />
            <Separator className="bg-zinc-800" />
            <p className="text-[10px] text-zinc-500 leading-snug">
              If GPU textures only grow when you swap avatars, textures from the previous model are
              not being disposed.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
