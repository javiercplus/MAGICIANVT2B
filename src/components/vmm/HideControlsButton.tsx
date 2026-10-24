'use client';

import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HideControlsButtonProps {
  hidden: boolean;
  onToggle: () => void;
  className?: string;
}

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
