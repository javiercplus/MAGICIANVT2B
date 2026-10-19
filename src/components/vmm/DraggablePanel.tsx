'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  minDx: number;
  maxDx: number;
  minDy: number;
  maxDy: number;
}

// Elements that should keep receiving their own pointer interaction instead of
// starting a panel drag. Everything else (headers, backgrounds, labels around
// sliders...) acts as a drag handle.
const INTERACTIVE = 'button,input,select,textarea,a,label,[role="slider"],[role="switch"],[role="tab"],[data-no-drag]';

interface DraggablePanelProps {
  children: React.ReactNode;
  className?: string;
}

export function DraggablePanel({ children, className }: DraggablePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE)) return;

    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: pos.x,
      y: pos.y,
      minDx: 8 - rect.left,
      maxDx: window.innerWidth - 8 - rect.right,
      minDy: 8 - rect.top,
      maxDy: window.innerHeight - 8 - rect.bottom,
    };

    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const nextX = clamp(drag.x + (e.clientX - drag.startX), drag.x + drag.minDx, drag.x + drag.maxDx);
    const nextY = clamp(drag.y + (e.clientY - drag.startY), drag.y + drag.minDy, drag.y + drag.maxDy);
    setPos({ x: nextX, y: nextY });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    ref.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, touchAction: 'none' }}
      className={cn('cursor-grab active:cursor-grabbing select-none', className)}
    >
      {children}
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
