'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DRAG } from '@/lib/vrm/constants';

interface UseAvatarDragResult {
  /** Avatar offset in world units; the avatar reads this each frame. */
  offsetRef: React.RefObject<THREE.Vector3>;
  /** True while the user is actively middle-mouse-dragging. */
  isDraggingRef: React.RefObject<boolean>;
}

// Middle-mouse-button drag to translate the avatar in world space.
// Left/right drag = move avatar on screen X; up/down = move on screen Y.
// Pressing the middle button also disables pointer lock if active.
export function useAvatarDrag(): UseAvatarDragResult {
  const offsetRef = useRef(new THREE.Vector3(0, 0, 0));
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // 1 = middle button
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
      // Prevent page from auto-scrolling on middle-click
      const canvas = document.querySelector('canvas');
      if (canvas) canvas.style.cursor = 'move';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      offsetRef.current.x = dragStartRef.current.ox + dx * DRAG.SENSITIVITY;
      offsetRef.current.y = dragStartRef.current.oy - dy * DRAG.SENSITIVITY;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 1) return;
      isDraggingRef.current = false;
      const canvas = document.querySelector('canvas');
      if (canvas) canvas.style.cursor = '';
    };

    const onContextMenu = (e: MouseEvent) => {
      // Suppress the browser's middle-click auto-scroll cursor on the canvas
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    // Disable middle-click auto-scroll on the canvas
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

  return { offsetRef, isDraggingRef };
}
