'use client';

import { Github, Heart } from 'lucide-react';

interface HeaderProps {
  status: string;
}

export function Header({ status }: HeaderProps) {
  return (
    <div className="window" style={{ width: 290 }}>
      <div className="title-bar">
        <div className="title-bar-text">
          <img src="/logo.svg" alt="Logo" className="w-3.5 h-3.5 object-contain" />
          <span>MagicianVT2b.exe</span>
        </div>
        <div className="title-bar-controls">
          <button type="button" aria-label="Minimize" />
          <button type="button" aria-label="Maximize" />
        </div>
      </div>

      <div className="window-body flex items-center justify-between gap-2 my-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo.svg" alt="Logo" className="w-7 h-7 object-contain shrink-0" />
          <div className="leading-tight min-w-0">
            <div className="font-bold text-[12px] text-[#003399] truncate">MagicianVT2b</div>
            <div className="text-[10px] text-[#444444] truncate">VRM Avatar &amp; VMC Studio</div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" data-no-drag>
          <a
            href="https://github.com/javiercplus/MAGICIANVT2B"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Repository"
          >
            <button type="button" className="xp-compact-btn flex items-center gap-1">
              <Github className="w-3 h-3" />
              <span>GitHub</span>
            </button>
          </a>
          <a
            href="https://ko-fi.com/javiercplus"
            target="_blank"
            rel="noopener noreferrer"
            title="Support on Ko-fi"
          >
            <button type="button" className="xp-compact-btn flex items-center gap-1">
              <Heart className="w-3 h-3 text-[#c41e3a]" />
            </button>
          </a>
        </div>
      </div>

      <div className="status-bar">
        <p className="status-bar-field">{status}</p>
        <p className="status-bar-field" style={{ flexGrow: 0 }}>XP Luna</p>
      </div>
    </div>
  );
}
