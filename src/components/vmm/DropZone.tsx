'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileBox } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        'flex flex-col items-center justify-center text-center transition-all',
        'border-2 border-dashed rounded-xl',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        isDragging
          ? 'border-violet-400 bg-violet-500/10'
          : 'border-zinc-700 bg-zinc-900/40 backdrop-blur-sm',
        overlay ? 'p-8 max-w-md mx-auto' : 'p-12 w-full h-full',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full mb-4',
          'bg-violet-500/15 text-violet-300',
          overlay ? 'w-10 h-10' : 'w-16 h-16'
        )}
      >
        {overlay ? (
          <Upload className="w-5 h-5" />
        ) : (
          <FileBox className="w-8 h-8" />
        )}
      </div>

      <h3
        className={cn(
          'font-semibold text-zinc-100',
          overlay ? 'text-base' : 'text-xl mb-2'
        )}
      >
        {overlay ? 'Drop to replace avatar' : 'Drop a .vrm file here'}
      </h3>

      {!overlay && (
        <p className="text-sm text-zinc-400 mb-6 max-w-sm">
          Drag-and-drop a VRM 0.x or VRM 1.0 file, or pick one from disk.
          Everything runs locally in your browser.
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

      <Button
        type="button"
        variant="default"
        size={overlay ? 'sm' : 'default'}
        onClick={() => inputRef.current?.click()}
        className="bg-violet-600 hover:bg-violet-500 text-white"
      >
        <Upload className="w-4 h-4 mr-2" />
        Choose .vrm file
      </Button>
    </div>
  );
}
