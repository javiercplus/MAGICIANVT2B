'use client';

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/lib/utils';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface ElectronIpcRenderer {
  send: (channel: string, ...args: unknown[]) => void;
}

// The app runs both in the browser (web build) and inside Electron. We only
// render the resize handles when the Electron ipcRenderer is available, and we
// access it through window.require so bundlers never try to resolve 'electron'.
function getIpcRenderer(): ElectronIpcRenderer | null {
  if (typeof window === 'undefined') return null;
  const req = (window as unknown as {
    require?: (moduleName: string) => { ipcRenderer?: ElectronIpcRenderer };
  }).require;
  if (!req) return null;
  try {
    return req('electron')?.ipcRenderer ?? null;
  } catch {
    return null;
  }
}

const subscribe = () => () => {};

const HANDLES: Array<{ dir: ResizeDir; className: string }> = [
  { dir: 'n', className: 'top-0 left-4 right-4 h-2 cursor-ns-resize' },
  { dir: 's', className: 'bottom-0 left-4 right-4 h-2 cursor-ns-resize' },
  { dir: 'w', className: 'left-0 top-4 bottom-4 w-2 cursor-ew-resize' },
  { dir: 'e', className: 'right-0 top-4 bottom-4 w-2 cursor-ew-resize' },
  { dir: 'nw', className: 'top-0 left-0 w-4 h-4 cursor-nwse-resize' },
  { dir: 'ne', className: 'top-0 right-0 w-4 h-4 cursor-nesw-resize' },
  { dir: 'sw', className: 'bottom-0 left-0 w-4 h-4 cursor-nesw-resize' },
  { dir: 'se', className: 'bottom-0 right-0 w-4 h-4 cursor-nwse-resize' },
];

// Invisible edge/corner grabbers that let the user resize the frameless
// Electron window. A subtle frame highlights while the edges are hovered or
// dragged so the window bounds (and the resize affordance) are discoverable.
export function WindowResizeHandles() {
  const ipc = useSyncExternalStore(
    subscribe,
    getIpcRenderer,
    () => null
  );
  const [hovering, setHovering] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const end = () => {
      getIpcRenderer()?.send('window-resize-end');
      setActive(false);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('blur', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('blur', end);
    };
  }, [active]);

  const handlePointerDown = useCallback(
    (dir: ResizeDir) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setActive(true);
      ipcRenderer.send('window-resize-start', dir);
    },
    []
  );

  if (!ipc) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-hidden>
      <div
        className={cn(
          'absolute inset-0 border-2 rounded-sm transition-colors duration-150',
          active
            ? 'border-violet-400'
            : hovering
              ? 'border-violet-400'
              : 'border-violet-500/70'
        )}
      />
      {HANDLES.map(({ dir, className }) => (
        <div
          key={dir}
          onPointerDown={handlePointerDown(dir)}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
          className={cn('absolute pointer-events-auto touch-none', className)}
        />
      ))}
    </div>
  );
}
