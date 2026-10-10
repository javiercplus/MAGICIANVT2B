'use client';

import { useEffect, useRef } from 'react';
import { computeGazeTarget } from '@/lib/vrm/gazeMath';
import type { GazeTarget } from '@/lib/vrm/constants';

interface ElectronCursorPos {
  x: number;
  y: number;
  windowFocused?: boolean;
}

interface ElectronCursorAPI {
  getGlobalCursor?: () => Promise<ElectronCursorPos | null>;
  setGlobalTracking?: (enabled: boolean) => void;
  onGlobalCursor?: (callback: (pos: ElectronCursorPos | null) => void) => () => void;
}

interface UseGazeTrackingOptions {
  enabled: boolean;
  captureOutside?: boolean;
  globalTracking?: boolean;
}

export function useGazeTracking(options: UseGazeTrackingOptions) {
  const { enabled, captureOutside = false, globalTracking = false } = options;
  const desiredRef = useRef<GazeTarget>({ x: 0, y: 0 });
  const currentRef = useRef<GazeTarget>({ x: 0, y: 0 });
  const hasMouseRef = useRef(false);
  const virtualMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const electronApi = (window as unknown as { electronAPI?: ElectronCursorAPI }).electronAPI;
    const canPush = !!(electronApi?.setGlobalTracking && electronApi?.onGlobalCursor);
    const canPoll = !!electronApi?.getGlobalCursor;
    const useGlobal = globalTracking && (canPush || canPoll);

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
      if (!enabled || useGlobal || document.pointerLockElement) return;
      hasMouseRef.current = false;
      resetToForward();
    };
    const onBlur = () => {
      if (!enabled || useGlobal || document.pointerLockElement) return;
      hasMouseRef.current = false;
      resetToForward();
    };
    const onPointerLockChange = () => {
      if (!document.pointerLockElement) virtualMouseRef.current = { x: 0, y: 0 };
    };
    const onCanvasClick = () => {
      if (!enabled || useGlobal || !captureOutside || document.pointerLockElement) return;
      const canvas = document.querySelector('canvas');
      (canvas as HTMLElement | null)?.requestPointerLock?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    const canvas = document.querySelector('canvas');
    canvas?.addEventListener('click', onCanvasClick);

    const applyGlobal = (pos: ElectronCursorPos | null) => {
      if (!pos) return;
      hasMouseRef.current = true;
      updateFromAbsolute(pos.x, pos.y);
    };

    let rafId = 0;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    if (enabled && useGlobal && canPush && electronApi?.setGlobalTracking && electronApi?.onGlobalCursor) {
      unsubscribe = electronApi.onGlobalCursor(applyGlobal);
      electronApi.setGlobalTracking(true);
    } else if (enabled && useGlobal && canPoll && electronApi?.getGlobalCursor) {
      const getGlobalCursor = electronApi.getGlobalCursor;
      const pollGlobal = async () => {
        if (cancelled) return;
        try {
          applyGlobal(await getGlobalCursor());
        } catch {
          // ignore transient IPC errors
        }
        if (!cancelled) rafId = requestAnimationFrame(pollGlobal);
      };
      rafId = requestAnimationFrame(pollGlobal);
    }

    if (!enabled) resetToForward();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      unsubscribe?.();
      if (canPush) electronApi?.setGlobalTracking?.(false);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas?.removeEventListener('click', onCanvasClick);
      hasMouseRef.current = false;
    };
  }, [enabled, captureOutside, globalTracking]);

  return { desiredRef, currentRef, hasMouseRef };
}
