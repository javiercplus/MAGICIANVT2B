'use client';

export function Footer() {
  return (
    <footer className="mt-auto bg-zinc-950/80 border-t border-zinc-800 backdrop-blur-md">
      <div className="px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
        <p className="flex items-center gap-1.5 flex-wrap justify-center">
          <span className="text-zinc-400 font-medium">MagicianVT2b</span>
          <span className="opacity-50">·</span>
          <span>VRM avatar viewer</span>
          <span className="opacity-50">·</span>
          <span>Runs natively on Linux (no Wine)</span>
          <span className="opacity-50">·</span>
          <span>100% offline</span>
        </p>
        <p className="flex items-center gap-1.5">
          <span>Three.js · @pixiv/three-vrm · Next.js 16</span>
        </p>
      </div>
    </footer>
  );
}
