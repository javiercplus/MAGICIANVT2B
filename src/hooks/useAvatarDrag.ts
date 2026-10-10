'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DRAG } from '@/lib/vrm/constants';

interface UseAvatarDragResult {
  offsetRef: React.RefObject<THREE.Vector3>;
  isDraggingRef: React.RefObject<boolean>;
}

export function useAvatarDrag(): UseAvatarDragResult {
  const offsetRef = useRef(new THREE.Vector3(0, 0, 0));
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
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
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.contains(e.target as Node)) {
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

  return { offsetRef, isDraggingRef };
}
