'use client';

import { useId } from 'react';
import { AlertCircle, CircleCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VrmStatus = 'idle' | 'loading' | 'loaded' | 'error';

export function StatusPill({ status, error }: { status: VrmStatus; error?: string | null }) {
  if (status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[#fff8dc] border border-[#b59b3b] text-[#5c4800]">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading…
      </span>
    );
  }
  if (status === 'error' || error) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[#ffe6e6] border border-[#b82e2e] text-[#800000]">
        <AlertCircle className="w-3 h-3" /> Error
      </span>
    );
  }
  if (status === 'loaded') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[#e6ffe6] border border-[#2b8a2b] text-[#005500]">
        <CircleCheck className="w-3 h-3" /> Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-[#ece9d8] border border-[#7f9db9] text-[#333333]">
      Idle
    </span>
  );
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
  const id = useId();
  const display = percent
    ? `${Math.round(value * 100)}%`
    : `${Number.isInteger(step) ? value : value.toFixed(decimals)}${unit ?? ''}`;
  return (
    <div className="space-y-0.5 py-0.5" data-no-drag>
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-[11px] text-[#000000] select-none">{label}</label>
        <span className="text-[11px] font-mono text-[#003399] tabular-nums">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export interface ToggleRowProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accentClass?: string;
  indent?: boolean;
}

export function ToggleRow({
  icon, label, description, checked, onCheckedChange, indent,
}: ToggleRowProps) {
  const id = useId();
  return (
    <div
      className={cn(
        'py-1 px-1.5 rounded-sm hover:bg-[#e8e5d5] transition-colors',
        indent && 'ml-5 border-l-2 border-[#b5b2a3] pl-2.5',
      )}
      data-no-drag
    >
      <div className="field-row">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <label htmlFor={id} className="font-medium text-[#000000] cursor-pointer flex items-center gap-1.5">
          {icon && <span className="text-[#003399] inline-flex items-center">{icon}</span>}
          <span>{label}</span>
        </label>
      </div>
      {description && (
        <p className="text-[10px] text-[#555555] leading-tight mt-0.5 ml-5">{description}</p>
      )}
    </div>
  );
}
