'use client';

import { useEffect, useRef, useState } from 'react';
import { LuBluetooth, LuRadio, LuSignalHigh, LuWifi } from 'react-icons/lu';

interface HeroPhoneProps {
  videoUrl: string;
  posterUrl?: string;
}

export function HeroPhone({
  videoUrl,
  posterUrl,
}: HeroPhoneProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  useEffect(() => {
    function handleMouseMove(e: MouseEvent): void {
      const node = rootRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / Math.max(window.innerWidth, 1);
      const dy = (e.clientY - cy) / Math.max(window.innerHeight, 1);
      const ry = Math.max(-10, Math.min(10, dx * 20));
      const rx = Math.max(-10, Math.min(10, -dy * 20));
      setTilt({ rx, ry });
    }
    function handleLeave(): void {
      setTilt({ rx: 0, ry: 0 });
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="home-hero-illustration"
      className="relative mx-auto flex w-full max-w-sm items-center justify-center py-4 animate-fade-up [animation-delay:320ms]"
      style={{ perspective: '1400px' }}
    >
      <span
        aria-hidden
        className="absolute h-80 w-80 rounded-full bg-sensu-100/60"
        style={{ filter: 'blur(40px)' }}
      />
      <span
        aria-hidden
        className="absolute h-56 w-56 rounded-full bg-sensu-200/50"
        style={{ filter: 'blur(20px)' }}
      />

      <div
        className="relative w-60 sm:w-64"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          aria-hidden
          className="absolute -right-1 top-24 h-14 w-1 rounded-r-sm bg-zinc-700/90 shadow-[inset_-1px_0_0_rgba(0,0,0,0.4)]"
        />
        <div
          aria-hidden
          className="absolute -left-1 top-16 h-8 w-1 rounded-l-sm bg-zinc-700/90 shadow-[inset_1px_0_0_rgba(0,0,0,0.4)]"
        />
        <div
          aria-hidden
          className="absolute -left-1 top-28 h-10 w-1 rounded-l-sm bg-zinc-700/90 shadow-[inset_1px_0_0_rgba(0,0,0,0.4)]"
        />

        <div className="relative aspect-[9/19] rounded-[2.5rem] bg-zinc-900 p-2 shadow-[0_30px_60px_rgba(15,23,42,0.25)]">
          <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-zinc-900">
            <video
              key={videoUrl}
              src={videoUrl}
              poster={posterUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              data-testid="home-hero-phone-video"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Top status bar — sits on a soft scrim so the time / signal /
                wifi / battery icons stay legible regardless of what frame
                of the video is showing behind them. */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent px-4 pt-1.5 pb-3 text-[10px] font-medium text-white"
            >
              <span className="tabular-nums">9:41</span>
              <span className="flex items-center gap-1">
                <LuSignalHigh aria-hidden className="h-3 w-3" />
                <LuWifi aria-hidden className="h-3 w-3" />
                <LuBluetooth aria-hidden className="h-3 w-3 text-sky-300" />
                <span className="ml-0.5 inline-flex items-center gap-0.5">
                  <span className="relative inline-block h-2.5 w-5 rounded-sm border border-white p-[1px]">
                    <span className="block h-full w-[80%] rounded-[1px] bg-emerald-400" />
                    <span
                      aria-hidden
                      className="absolute -right-[3px] top-1/2 h-1 w-px -translate-y-1/2 rounded-r bg-white"
                    />
                  </span>
                  <span className="text-[9px] tabular-nums">80%</span>
                </span>
              </span>
            </div>
            {/* Android-style soft navigation — back / home / recents — on
                a matching bottom scrim. */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-around bg-gradient-to-t from-black/55 to-transparent px-8 pt-3 pb-2"
            >
              <span
                className="h-0 w-0"
                style={{
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderRight: '7px solid rgba(255,255,255,0.9)',
                }}
              />
              <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white/90" />
              <span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-white/90" />
            </div>
            {/* Speaker / sensor notch. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-1.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-black/70"
            />
          </div>
        </div>
      </div>

      <div className="absolute right-2 top-16 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-zinc-100 sm:right-0">
        <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
        Call Center 24/7
      </div>
      <div className="absolute bottom-20 left-2 flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-[0_8px_24px_rgba(244,63,94,0.18)] ring-1 ring-rose-200 sm:left-0">
        <LuRadio aria-hidden className="h-3 w-3 text-rose-500" />
        SOS instantáneo
      </div>
    </div>
  );
}
