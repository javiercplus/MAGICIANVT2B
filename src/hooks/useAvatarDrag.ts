'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CAMERA, DEFAULT_MODEL_ROTATION, DRAG, type ModelRotation } from '@/lib/vrm/constants';

interface UseAvatarDragResult {
  offsetRef: React.RefObject<THREE.Vector3>;
  rotationRef: React.RefObject<ModelRotation>;
  isDraggingRef: React.RefObject<boolean>;
  resetView: () => void;
}

type DragMode = 'move' | 'rotate' | null;

export function useAvatarDrag(): UseAvatarDragResult {
  const offsetRef = useRef(new THREE.Vector3(0, 0, 0));
  const rotationRef = useRef<ModelRotation>({ ...DEFAULT_MODEL_ROTATION });
  const isDraggingRef = useRef(false);
  const modeRef = useRef<DragMode>(null);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0, rx: 0, ry: 0 });

  const resetView = useCallback(() => {
    offsetRef.current.set(0, 0, 0);
    rotationRef.current.x = 0;
    rotationRef.current.y = 0;
  }, []);

  useEffect(() => {
    const canvas = () => document.querySelector('canvas');

    const onMouseDown = (e: MouseEvent) => {
      const el = canvas();
      const onCanvas = !!el && el.contains(e.target as Node);

      // Ctrl + left drag rotates the model.
      if (e.button === 0 && e.ctrlKey && onCanvas) {
        e.preventDefault();
        modeRef.current = 'rotate';
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          ox: 0,
          oy: 0,
          rx: rotationRef.current.x,
          ry: rotationRef.current.y,
        };
        if (el) el.style.cursor = 'grabbing';
        return;
      }

      // Middle drag repositions the avatar.
      if (e.button !== 1) return;
      e.preventDefault();
      modeRef.current = 'move';
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
        rx: 0,
        ry: 0,
      };
      if (el) el.style.cursor = 'move';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (modeRef.current === 'move') {
        offsetRef.current.x = dragStartRef.current.ox + dx * DRAG.SENSITIVITY;
        offsetRef.current.y = dragStartRef.current.oy - dy * DRAG.SENSITIVITY;
        return;
      }

      if (modeRef.current === 'rotate') {
        const nextX = dragStartRef.current.rx + dy * CAMERA.ROTATE_SENSITIVITY;
        rotationRef.current.x = THREE.MathUtils.clamp(
          nextX, -CAMERA.PITCH_LIMIT_RAD, CAMERA.PITCH_LIMIT_RAD,
        );
        rotationRef.current.y = dragStartRef.current.ry + dx * CAMERA.ROTATE_SENSITIVITY;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      if (e.button !== 0 && e.button !== 1) return;
      if (modeRef.current === 'move' && e.button !== 1) return;
      if (modeRef.current === 'rotate' && e.button !== 0) return;
      modeRef.current = null;
      isDraggingRef.current = false;
      const el = canvas();
      if (el) el.style.cursor = '';
    };

    const onContextMenu = (e: MouseEvent) => {
      const el = canvas();
      if (el && el.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('auxclick', onAuxClick);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('auxclick', onAuxClick);
    };
  }, []);

  return { offsetRef, rotationRef, isDraggingRef, resetView };
}
