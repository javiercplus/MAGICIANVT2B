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
      aria-label={hidden ? 'Show options' : 'Hide options'}
      title={hidden ? 'Show options (all controls)' : 'Hide options (all controls)'}
      className={cn('xp-icon-btn z-50', className)}
    >
      {hidden ? (
        <Eye className="w-4 h-4 text-[#005500]" />
      ) : (
        <EyeOff className="w-4 h-4 text-[#333333]" />
      )}
    </button>
  );
}
