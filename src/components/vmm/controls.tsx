'use client';

import { AlertCircle, CircleCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export type VrmStatus = 'idle' | 'loading' | 'loaded' | 'error';

export function StatusPill({ status, error }: { status: VrmStatus; error?: string | null }) {
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

export interface LightSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  percent?: boolean;
  onChange: (v: number) => void;
}

export function LightSlider({
  label, value, min, max, step, unit, decimals = 2, percent, onChange,
}: LightSliderProps) {
  const display = percent
    ? `${Math.round(value * 100)}%`
    : `${Number.isInteger(step) ? value : value.toFixed(decimals)}${unit ?? ''}`;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className="text-[11px] text-zinc-300 tabular-nums">{display}</span>
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

export interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accentClass?: string;
  indent?: boolean;
}

export function ToggleRow({
  icon, label, description, checked, onCheckedChange, accentClass, indent,
}: ToggleRowProps) {
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
