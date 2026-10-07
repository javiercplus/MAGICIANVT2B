'use client';

import { useEffect, useRef, useState } from 'react';
import { LIPSYNC } from '@/lib/vrm/constants';

interface UseLipSyncResult {
  mouthValueRef: React.RefObject<number>;
  level: number;
  isReady: boolean;
  error: string | null;
}

// Microphone amplitude -> mouth-open value (0..1).
// Uses Web Audio API RMS -> dB mapping ported from VMagicMirror's lipsync
// volume range (-40..-20 dB, clamp min 0.3). Simpler than OVRLipSync visemes
// but matches the original feel for the speech-driven mouth-open case.
export function useLipSync(enabled: boolean): UseLipSyncResult {
  const mouthValueRef = useRef(0);
  const [level, setLevel] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { mouthValueRef.current = 0; return; }

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let lastUiUpdate = 0;
    let cancelled = false;

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
        if (cancelled) return;

        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (!analyser || cancelled) return;
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length);
          const db = 20 * Math.log10(Math.max(rms, 1e-6));
          let factor = 0;
          if (db > LIPSYNC.DB_MIN) {
            factor = (db - LIPSYNC.DB_MIN) / (LIPSYNC.DB_MAX - LIPSYNC.DB_MIN);
            factor = Math.max(LIPSYNC.VOLUME_FACTOR_CLAMP_MIN, Math.min(1, factor));
          }
          mouthValueRef.current = factor;
          const now = performance.now();
          if (now - lastUiUpdate > 100) {
            lastUiUpdate = now;
            setLevel(factor);
          }
          rafId = requestAnimationFrame(tick);
        };
        tick();
        setIsReady(true);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : err?.message || 'Could not access microphone';
        setError(msg);
        setIsReady(false);
      }
    }
    setup();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      source?.disconnect();
      analyser?.disconnect();
      audioCtx?.close();
      stream?.getTracks().forEach((t) => t.stop());
      mouthValueRef.current = 0;
      setLevel(0);
      setIsReady(false);
    };
  }, [enabled]);

  return { mouthValueRef, level, isReady, error };
}
