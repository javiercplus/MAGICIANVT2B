'use client';

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  status: string;
}

export function Header({ status }: HeaderProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-md shadow-lg shadow-black/30">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="leading-tight">
        <h1 className="text-sm font-semibold text-zinc-100">MagicianVT2b</h1>
        <p className="text-[10px] text-zinc-400">VRM avatar · web app</p>
      </div>
      <Badge variant="outline" className="ml-2 text-[10px] border-zinc-700 text-zinc-400">{status}</Badge>
    </div>
  );
}
