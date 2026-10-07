'use client';

import { useEffect, useRef } from 'react';
import { computeGazeTarget } from '@/lib/vrm/gazeMath';
import type { GazeTarget } from '@/lib/vrm/constants';

interface UseGazeTrackingOptions {
  enabled: boolean;
  // When true, request pointer lock on canvas click so the mouse can be
  // tracked outside the browser window. User must click to engage (browser
  // security). Esc to exit.
  captureOutside?: boolean;
}

// Returns two refs the avatar reads in useFrame:
//   desiredRef  - gaze target from most recent mousemove (or pointer lock delta)
//   currentRef  - smoothed value; avatar lerps toward desiredRef each frame
//
// Behavior:
//   enabled=false              -> avatar looks straight forward (gaze=0,0)
//   enabled=true (no lock)    -> follow mouse; reset to forward when leaving window
//   captureOutside=true        -> click canvas to engage pointer lock; movementX/Y
//                                accumulate into virtual mouse position
export function useGazeTracking(options: UseGazeTrackingOptions) {
  const { enabled, captureOutside = false } = options;
  const desiredRef = useRef<GazeTarget>({ x: 0, y: 0 });
  const currentRef = useRef<GazeTarget>({ x: 0, y: 0 });
  const hasMouseRef = useRef(false);
  const virtualMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const updateFromAbsolute = (clientX: number, clientY: number) => {
      desiredRef.current = computeGazeTarget(
        clientX, clientY, window.innerWidth, window.innerHeight
      );
    };
    const updateFromVirtual = () => {
      const fakeX = window.innerWidth * 0.5 + virtualMouseRef.current.x;
      const fakeY = window.innerHeight * 0.5 + virtualMouseRef.current.y;
      desiredRef.current = computeGazeTarget(
        fakeX, fakeY, window.innerWidth, window.innerHeight
      );
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!enabled) return;
      hasMouseRef.current = true;
      if (document.pointerLockElement) {
        const sensitivity = 2.0;
        virtualMouseRef.current.x += e.movementX * sensitivity;
        virtualMouseRef.current.y += e.movementY * sensitivity;
        const maxX = window.innerWidth * 0.5 * 2;
        const maxY = window.innerHeight * 0.5 * 2;
        virtualMouseRef.current.x = Math.max(-maxX, Math.min(maxX, virtualMouseRef.current.x));
        virtualMouseRef.current.y = Math.max(-maxY, Math.min(maxY, virtualMouseRef.current.y));
        updateFromVirtual();
      } else {
        virtualMouseRef.current.x = e.clientX - window.innerWidth * 0.5;
        virtualMouseRef.current.y = e.clientY - window.innerHeight * 0.5;
        updateFromAbsolute(e.clientX, e.clientY);
      }
    };

    const resetToForward = () => { desiredRef.current = { x: 0, y: 0 }; };
    const onMouseLeave = () => {
      if (!enabled || document.pointerLockElement) return;
      hasMouseRef.current = false;
      resetToForward();
    };
    const onBlur = () => {
      if (!enabled || document.pointerLockElement) return;
      hasMouseRef.current = false;
      resetToForward();
    };
    const onPointerLockChange = () => {
      if (!document.pointerLockElement) virtualMouseRef.current = { x: 0, y: 0 };
    };
    const onCanvasClick = () => {
      if (!enabled || !captureOutside || document.pointerLockElement) return;
      const canvas = document.querySelector('canvas');
      (canvas as HTMLElement | null)?.requestPointerLock?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    const canvas = document.querySelector('canvas');
    canvas?.addEventListener('click', onCanvasClick);

    if (!enabled) resetToForward();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas?.removeEventListener('click', onCanvasClick);
      hasMouseRef.current = false;
    };
  }, [enabled, captureOutside]);

  return { desiredRef, currentRef, hasMouseRef };
}
