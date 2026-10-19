'use client';

import { useEffect, useState, type CSSProperties } from 'react';

// The Electron window is frameless with `titleBarOverlay`, so the OS draws the
// close/minimize/maximize buttons over the top-right (Windows/Linux) or the
// traffic lights over the top-left (macOS). This component reserves the matching
// strip and marks it as a drag region so the window can still be moved.
function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  const req = (window as unknown as { require?: (moduleName: string) => unknown }).require;
  if (!req) return false;
  try {
    return !!req('electron');
  } catch {
    return false;
  }
}

export function WindowTitleBar() {
  const [electron, setElectron] = useState(false);

  useEffect(() => {
    setElectron(isElectron());
  }, []);

  if (!electron) return null;

  return (
    <div
      className="h-9 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      aria-hidden
    />
  );
}
