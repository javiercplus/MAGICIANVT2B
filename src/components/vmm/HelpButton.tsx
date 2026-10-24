'use client';

import { useState } from 'react';
import {
  HelpCircle, MousePointer2, Move, ZoomIn, Upload, CircleDot, Sun, SlidersHorizontal, Rotate3d, Wind, Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS: { icon: React.ReactNode; title: string; description: string }[] = [
  {
    icon: <Move className="w-3.5 h-3.5" />,
    title: 'Move panels',
    description: 'Drag the VRM model and Options windows by their title bar or background to reposition them.',
  },
  {
    icon: <Move className="w-3.5 h-3.5" />,
    title: 'Move avatar',
    description: 'Middle-click drag on the canvas to reposition the avatar.',
  },
  {
    icon: <Rotate3d className="w-3.5 h-3.5" />,
    title: 'Rotate model',
    description: 'Hold Ctrl and left-drag over the canvas to rotate the avatar. Use Reset view in the Camera tab to return to the front.',
  },
  {
    icon: <ZoomIn className="w-3.5 h-3.5" />,
    title: 'Zoom',
    description: 'Scroll the mouse wheel over the canvas, or use the separate Zoom slider in the Camera tab.',
  },
  {
    icon: <Camera className="w-3.5 h-3.5" />,
    title: 'Camera',
    description: 'Camera tab: zoom dollies the camera, while field of view changes the lens angle. Orthographic projection is also available.',
  },
  {
    icon: <Wind className="w-3.5 h-3.5" />,
    title: 'Wind',
    description: 'VRM model → Wind tab: breeze on hair, skirt and ribbons. Strength, direction and gusts are adjustable.',
  },
  {
    icon: <MousePointer2 className="w-3.5 h-3.5" />,
    title: 'Gaze tracking',
    description: 'The avatar follows your mouse. Enable "Capture Outside" to keep tracking when the pointer leaves the window (Esc to exit).',
  },
  {
    icon: <Upload className="w-3.5 h-3.5" />,
    title: 'Load an avatar',
    description: 'Drag & drop a .vrm file anywhere, or open VRM model (shirt button, top right) and use Open .vrm.',
  },
  {
    icon: <CircleDot className="w-3.5 h-3.5" />,
    title: 'Record',
    description: 'Record screen captures the avatar canvas to a .webm file.',
  },
  {
    icon: <Sun className="w-3.5 h-3.5" />,
    title: 'Light',
    description: 'Adjust front/top intensity and orbit each light with its Direction control.',
  },
  {
    icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
    title: 'Color',
    description: 'Brightness, saturation, contrast, hue, temperature and tone mapping. 100% is neutral.',
  },
];

interface HelpButtonProps {
  className?: string;
}

export function HelpButton({ className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Help"
        title="Help"
        onClick={() => setOpen(true)}
        className={cn('xp-icon-btn', className)}
      >
        <HelpCircle className="w-4 h-4 text-[#003399]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="window w-[440px] max-w-[calc(100vw-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="title-bar">
              <div className="title-bar-text">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Help — MagicianVT2b Controls</span>
              </div>
              <div className="title-bar-controls">
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} />
              </div>
            </div>

            <div className="window-body space-y-2 max-h-[75vh] overflow-y-auto">
              <fieldset>
                <legend>How to interact with the avatar viewer</legend>
                <ul className="tree-view space-y-1.5 max-h-[55vh] overflow-y-auto">
                  {ITEMS.map((item) => (
                    <li key={item.title} className="py-1 border-b border-[#ece9d8] last:border-none">
                      <div className="flex items-start gap-2">
                        <span className="text-[#003399] mt-0.5 shrink-0">{item.icon}</span>
                        <div>
                          <div className="font-bold text-[#000000]">{item.title}</div>
                          <div className="text-[11px] text-[#333333] leading-snug">{item.description}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <div className="flex justify-end pt-1">
                <button type="button" onClick={() => setOpen(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
