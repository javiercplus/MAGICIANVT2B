'use client';

import { HelpCircle, MousePointer2, Move, ZoomIn, Upload, CircleDot, Sun, SlidersHorizontal, Rotate3d, Wind, Camera } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ITEMS: { icon: React.ReactNode; title: string; description: string }[] = [
  {
    icon: <Move className="w-4 h-4" />,
    title: 'Move panels',
    description: 'Drag the VRM model and Options panels by their background or header to reposition them.',
  },
  {
    icon: <Move className="w-4 h-4" />,
    title: 'Move avatar',
    description: 'Middle-click drag on the canvas to reposition the avatar.',
  },
  {
    icon: <Rotate3d className="w-4 h-4" />,
    title: 'Rotate model',
    description: 'Hold Ctrl and left-drag over the canvas to rotate the avatar. Use Reset view in the Camera tab to return to the front.',
  },
  {
    icon: <ZoomIn className="w-4 h-4" />,
    title: 'Zoom',
    description: 'Scroll the mouse wheel over the canvas, or use the separate Zoom slider in the Camera tab.',
  },
  {
    icon: <Camera className="w-4 h-4" />,
    title: 'Camera',
    description: 'Camera tab: zoom dollies the camera, while field of view changes the lens angle. Orthographic projection is also available.',
  },
  {
    icon: <Wind className="w-4 h-4" />,
    title: 'Wind',
    description: 'VRM model → Wind tab: breeze on hair, skirt and ribbons. Strength, direction and gusts are adjustable.',
  },
  {
    icon: <MousePointer2 className="w-4 h-4" />,
    title: 'Gaze tracking',
    description: 'The avatar follows your mouse. Enable "Capture Outside" to keep tracking when the pointer leaves the window (Esc to exit).',
  },
  {
    icon: <Upload className="w-4 h-4" />,
    title: 'Load an avatar',
    description: 'Drag & drop a .vrm file anywhere, or open VRM model (shirt button, top right) and use Open .vrm.',
  },
  {
    icon: <CircleDot className="w-4 h-4" />,
    title: 'Record',
    description: 'Record screen captures the avatar canvas to a .webm file.',
  },
  {
    icon: <Sun className="w-4 h-4" />,
    title: 'Light',
    description: 'Adjust front/top intensity and orbit each light with its Direction control.',
  },
  {
    icon: <SlidersHorizontal className="w-4 h-4" />,
    title: 'Color',
    description: 'Brightness, saturation, contrast, hue, temperature and tone mapping. 100% is neutral.',
  },
];

interface HelpButtonProps {
  className?: string;
}

export function HelpButton({ className }: HelpButtonProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
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
      </DialogTrigger>
      <DialogContent
        className={cn(
          'max-h-[82vh] overflow-y-auto',
          'bg-zinc-900/95 border-zinc-700 text-zinc-100',
          'backdrop-blur-md shadow-2xl shadow-black/50',
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-zinc-100">Controls</DialogTitle>
          <DialogDescription className="text-[11px] text-zinc-400">
            How to interact with the avatar viewer.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
