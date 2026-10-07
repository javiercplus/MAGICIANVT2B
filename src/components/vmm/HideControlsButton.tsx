'use client';

import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HideControlsButtonProps {
  hidden: boolean;
  onToggle: () => void;
  className?: string;
}

// Floating button that toggles visibility of all UI chrome (header,
// control panel, footer). Stays visible itself so the user can bring
// the controls back. Positioned in the top-right corner by default.
export function HideControlsButton({ hidden, onToggle, className }: HideControlsButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={hidden ? 'Show controls' : 'Hide controls'}
      title={hidden ? 'Show controls' : 'Hide controls'}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg',
        'bg-zinc-900/80 border border-zinc-700 backdrop-blur-md',
        'text-zinc-300 hover:text-white hover:bg-zinc-800',
        'shadow-lg shadow-black/30 transition-all',
        'z-50',
        className
      )}
    >
      {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
    </button>
  );
}
