'use client';

import { Github, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  status: string;
}

export function Header({ status }: HeaderProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-md shadow-lg shadow-black/30">
      <div className="flex items-center justify-center w-9 h-9">
        <img src="/logo.svg" alt="Logo" className="w-9 h-9 object-contain" />
      </div>
      <div className="leading-tight">
        <h1 className="text-sm font-semibold text-zinc-100">MagicianVT2b</h1>
        <p className="text-[10px] text-zinc-400">VRM avatar · web app</p>
      </div>
      <Badge variant="outline" className="ml-2 text-[10px] border-zinc-700 text-zinc-400">{status}</Badge>
      
      <div className="flex items-center gap-1.5 ml-1 pl-3 border-l border-zinc-800/80">
        <a href="https://github.com/javiercplus/MAGICIANVT2B" target="_blank" rel="noopener noreferrer" 
           className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-md transition-colors" 
           title="GitHub Repository">
          <Github className="w-4 h-4" />
        </a>
        <a href="https://ko-fi.com/javiercplus" target="_blank" rel="noopener noreferrer" 
           className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors" 
           title="Support on Ko-fi">
          <Heart className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
