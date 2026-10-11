'use client';

import { HelpCircle, MousePointer2, Move, ZoomIn, Upload, CircleDot, Sun, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const ITEMS: { icon: React.ReactNode; title: string; description: string }[] = [
  {
    icon: <Move className="w-4 h-4" />,
    title: 'Move avatar',
    description: 'Middle-click drag on the canvas to reposition the avatar.',
  },
  {
    icon: <ZoomIn className="w-4 h-4" />,
    title: 'Zoom',
    description: 'Scroll the mouse wheel over the canvas, or use the Zoom slider in the Scene tab.',
  },
  {
    icon: <MousePointer2 className="w-4 h-4" />,
    title: 'Gaze tracking',
    description: 'The avatar follows your mouse. Enable "Capture Outside" to keep tracking when the pointer leaves the window (Esc to exit).',
  },
  {
    icon: <Upload className="w-4 h-4" />,
    title: 'Load an avatar',
    description: 'Drag & drop a .vrm file anywhere, or use Open .vrm in the Avatar tab.',
  },
  {
    icon: <CircleDot className="w-4 h-4" />,
    title: 'Record',
    description: 'Record screen captures the avatar canvas to a .webm file.',
  },
  {
    icon: <Sun className="w-4 h-4" />,
    title: 'Light',
    description: 'Adjust the front and top light intensity.',
  },
  {
    icon: <SlidersHorizontal className="w-4 h-4" />,
    title: 'Adjust',
    description: 'Fine-tune brightness, saturation and contrast of the render.',
  },
];

interface HelpButtonProps {
  className?: string;
}

export function HelpButton({ className }: HelpButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Help"
          title="Help"
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg',
            'bg-zinc-900/80 border border-zinc-700 backdrop-blur-md',
            'text-zinc-300 hover:text-white hover:bg-zinc-800',
            'shadow-lg shadow-black/30 transition-all',
            className
          )}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 bg-zinc-900/95 border-zinc-700 text-zinc-100 backdrop-blur-md shadow-2xl shadow-black/40"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">Controls</h4>
            <p className="text-[11px] text-zinc-400">How to interact with the avatar viewer.</p>
          </div>
          <ul className="space-y-2.5">
            {ITEMS.map((item) => (
              <li key={item.title} className="flex items-start gap-2.5">
                <span className="flex items-center justify-center rounded-md w-6 h-6 shrink-0 mt-0.5 bg-zinc-800/60 text-violet-300">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-100">{item.title}</p>
                  <p className="text-[11px] text-zinc-400 leading-snug">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
