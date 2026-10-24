'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileBox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  /** Visible when true (e.g., no VRM currently loaded or user is dragging). */
  visible: boolean;
  /** Compact overlay style (used when a VRM is already loaded but user is dragging a new one). */
  overlay?: boolean;
  onFile: (file: File) => void;
  className?: string;
}

/**
 * Drag-and-drop / file-picker zone for .vrm files.
 * Used both as the "no avatar yet" full-screen prompt and as a drag overlay.
 */
export function DropZone({ visible, overlay, onFile, className }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = Array.from(files).find((f) =>
        f.name.toLowerCase().endsWith('.vrm')
      );
      if (file) onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        'window transition-all',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        overlay ? 'max-w-md mx-auto' : 'w-full max-w-md mx-auto',
        className
      )}
    >
      <div className="title-bar">
        <div className="title-bar-text">
          <FileBox className="w-3.5 h-3.5" />
          <span>{overlay ? 'Replace VRM Avatar' : 'Open VRM Avatar'}</span>
        </div>
        <div className="title-bar-controls">
          <button type="button" aria-label="Help" />
        </div>
      </div>

      <div className="window-body text-center space-y-3 p-3">
        <fieldset className={cn(isDragging && 'bg-[#e1ecff] border-[#0050ee]')}>
          <legend>VRM Model File (.vrm)</legend>
          <div className="flex flex-col items-center justify-center py-4 space-y-2">
            <Upload className="w-7 h-7 text-[#003399]" />
            <div className="font-bold text-[12px] text-[#000000]">
              {overlay ? 'Drop to replace avatar' : 'Drop a .vrm file here'}
            </div>
            {!overlay && (
              <p className="text-[11px] text-[#444444] max-w-xs">
                Drag-and-drop a VRM 0.x or VRM 1.0 file, or pick one from disk.
                Everything runs locally.
              </p>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".vrm"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="pt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Browse .vrm…</span>
              </button>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
