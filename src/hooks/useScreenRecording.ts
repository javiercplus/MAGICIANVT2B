'use client';

import { useCallback, useRef, useState } from 'react';

interface UseScreenRecordingResult {
  isRecording: boolean;
  durationSec: number;
  start: () => Promise<void>;
  stop: () => void;
  error: string | null;
}

// Records the avatar canvas via MediaRecorder + canvas.captureStream.
// Output is a .webm (or .mp4 on Safari) auto-downloaded on stop.
// Works in Chromium / Firefox / Safari 14+ / Electron.
export function useScreenRecording(): UseScreenRecordingResult {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const pickMimeType = (): string | null => {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    for (const t of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    }
    return null;
  };

  const start = useCallback(async () => {
    setError(null);
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('No canvas found to record');
      if (typeof (canvas as HTMLCanvasElement).captureStream !== 'function') {
        throw new Error('canvas.captureStream is not supported in this browser');
      }
      const stream = (canvas as HTMLCanvasElement).captureStream(30);
      streamRef.current = stream;
      const mimeType = pickMimeType();
      if (!mimeType) throw new Error('No supported video MIME type found');

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = mimeType.split(';')[0];
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const a = document.createElement('a');
        a.href = url;
        a.download = `magicianvt2b-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        chunksRef.current = [];
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setDurationSec(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setDurationSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Could not start recording');
      setIsRecording(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, durationSec, start, stop, error };
}
