'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Telemetry } from '@/lib/vrm/constants';
import { renderStats } from '@/lib/vrm/renderStats';

// Emits live telemetry to the Optimization Panel. Runs at priority 2 so it
// executes after PostFX (priority 1), reading renderer.info once the frame has
// been submitted. Draw calls accumulate across composer passes because PostFX
// disables renderer.info.autoReset.
export function TelemetryProbe({
  intervalMs,
  onSample,
}: {
  intervalMs: number;
  onSample: (t: Telemetry) => void;
}) {
  const { gl } = useThree();
  const acc = useRef(0);

  useFrame((_, delta) => {
    acc.current += delta;
    const interval = intervalMs / 1000;
    if (acc.current < interval) return;

    const fps = renderStats.frames / acc.current;
    renderStats.frames = 0;
    acc.current = 0;

    onSample({
      fps: Math.round(fps),
      textures: gl.info.memory.textures,
      calls: gl.info.render.calls,
      geometries: gl.info.memory.geometries,
    });
  }, 2);

  return null;
}

// Applies the renderer pixel ratio live (renderer.setPixelRatio) through R3F's
// setDpr, so the change takes effect without remounting the Canvas.
export function RenderSettings({ pixelRatio }: { pixelRatio: number }) {
  const setDpr = useThree((state) => state.setDpr);

  useEffect(() => {
    setDpr(pixelRatio);
  }, [pixelRatio, setDpr]);

  return null;
}
