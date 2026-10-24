'use client';

import { useId, useState } from 'react';
import { Cpu, Gauge, MonitorCog } from 'lucide-react';
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

function RangeField({ label, value, min, max, step, unit, decimals = 2, onChange }: RangeFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1 py-0.5" data-no-drag>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] text-[#000000]">{label}</label>
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
            className="w-16 text-right font-mono tabular-nums"
          />
          {unit && <span className="text-[10px] text-[#444444]">{unit}</span>}
        </div>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function SwitchRow({
  label, description, checked, onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="py-1 px-1 hover:bg-[#e8e5d5] rounded-sm" data-no-drag>
      <div className="field-row">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <label htmlFor={id} className="font-semibold text-[#000000] cursor-pointer">{label}</label>
      </div>
      <p className="text-[10px] text-[#555555] leading-tight mt-0.5 ml-5">{description}</p>
    </div>
  );
}

function StatRow({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 bg-white border border-[#7f9db9]">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-[#000000]">{label}</div>
        {hint && <div className="text-[10px] text-[#555555] leading-tight">{hint}</div>}
      </div>
      <span className={cn('text-xs font-bold font-mono tabular-nums', warn ? 'text-[#b56b00]' : 'text-[#005500]')}>
        {value}
      </span>
    </div>
  );
}

export function OptimizationPanel({ config, telemetry, onChange, onClose }: OptimizationPanelProps) {
  const [activeTab, setActiveTab] = useState<'render' | 'vrm' | 'telemetry'>('render');

  const set = <K extends keyof OptimizationConfig>(key: K, value: OptimizationConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <div className="window w-[390px] max-w-[calc(100vw-2rem)]">
      <div className="title-bar">
        <div className="title-bar-text">
          <Gauge className="w-3.5 h-3.5" />
          <span>Performance &amp; Optimization</span>
        </div>
        <div className="title-bar-controls">
          <button type="button" aria-label="Minimize" />
          <button type="button" aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body">
        <menu role="tablist" aria-label="Optimization Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'render'}
            onClick={() => setActiveTab('render')}
            className="flex items-center gap-1"
          >
            <MonitorCog className="w-3 h-3" /> Render
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vrm'}
            onClick={() => setActiveTab('vrm')}
            className="flex items-center gap-1"
          >
            <Cpu className="w-3 h-3" /> VRM Boost
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'telemetry'}
            onClick={() => setActiveTab('telemetry')}
            className="flex items-center gap-1"
          >
            <Gauge className="w-3 h-3" /> Telemetry
          </button>
        </menu>

        {activeTab === 'render' && (
          <article role="tabpanel" className="space-y-2">
            <fieldset>
              <legend>Frame Rate</legend>
              <RangeField
                label="FPS limit"
                value={config.fpsLimit}
                min={15}
                max={60}
                step={1}
                onChange={(v) => set('fpsLimit', v)}
              />
              <p className="text-[10px] text-[#555555] leading-snug mt-1">
                Caps the render loop; frames over budget are skipped.
              </p>
            </fieldset>

            <fieldset>
              <legend>Resolution &amp; Antialiasing</legend>
              <RangeField
                label="Render resolution"
                value={config.renderScale}
                min={0.25}
                max={1}
                step={0.05}
                unit={`${Math.round(config.renderScale * 100)}%`}
                onChange={(v) => set('renderScale', v)}
              />
              <SwitchRow
                label="FXAA"
                description="Light post-AA that hides edge aliasing when internal res is low."
                checked={config.antiAlias}
                onCheckedChange={(v) => set('antiAlias', v)}
              />
              <SwitchRow
                label="MSAA 4x"
                description="Multisampling on the post-processing render targets. Crisper edges."
                checked={config.msaa}
                onCheckedChange={(v) => set('msaa', v)}
              />
            </fieldset>

            <fieldset>
              <legend>Device Pixel Ratio</legend>
              <RangeField
                label="Pixel ratio"
                value={config.pixelRatio}
                min={0.5}
                max={1.5}
                step={0.05}
                onChange={(v) => set('pixelRatio', v)}
              />
              <p className="text-[10px] text-[#555555] leading-snug mt-1">renderer.setPixelRatio()</p>
            </fieldset>
          </article>
        )}

        {activeTab === 'vrm' && (
          <article role="tabpanel" className="space-y-2">
            <fieldset>
              <legend>Spring-Bone Physics</legend>
              <RangeField
                label={`Physics quality (${PHYSICS_LABELS[config.physicsQuality === 'low' ? 0 : config.physicsQuality === 'medium' ? 1 : 2].toUpperCase()})`}
                value={config.physicsQuality === 'low' ? 0 : config.physicsQuality === 'medium' ? 1 : 2}
                min={0}
                max={2}
                step={1}
                onChange={(v) => set('physicsQuality', PHYSICS_LABELS[Math.round(v)])}
              />
              <p className="text-[10px] text-[#555555] leading-snug mt-1">
                Throttles the spring-bone solver (low = 10 Hz, medium = 20 Hz, high = every frame).
              </p>
            </fieldset>

            <fieldset>
              <legend>Solver &amp; Shader Boost</legend>
              <SwitchRow
                label="Morph optimization"
                description="Skip expression solving (morphTargetInfluences) when face weights don't change."
                checked={config.morphOptimization}
                onCheckedChange={(v) => set('morphOptimization', v)}
              />
              <SwitchRow
                label="MToon low-power"
                description="Swap expensive MToon materials for MeshLambertMaterial. Reversible, live."
                checked={config.mtoonLowPower}
                onCheckedChange={(v) => set('mtoonLowPower', v)}
              />
            </fieldset>
          </article>
        )}

        {activeTab === 'telemetry' && (
          <article role="tabpanel" className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase tracking-wider text-[#555555]">Live · 500 ms</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#e6ffe6] border border-[#2b8a2b] text-[#005500]">
                {telemetry.fps} FPS
              </span>
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
            <p className="text-[10px] text-[#555555] leading-snug pt-1">
              If GPU textures only grow when you swap avatars, textures from the previous model are not being disposed.
            </p>
          </article>
        )}
      </div>

      <div className="status-bar">
        <p className="status-bar-field">FPS: {telemetry.fps}</p>
        <p className="status-bar-field">Draw Calls: {telemetry.calls}</p>
        <p className="status-bar-field">Scale: {Math.round(config.renderScale * 100)}%</p>
      </div>
    </div>
  );
}
