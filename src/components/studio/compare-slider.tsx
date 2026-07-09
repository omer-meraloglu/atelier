"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";

/**
 * Before/after reveal. The whole surface is a (visually hidden) range input,
 * so dragging anywhere — or arrow keys — moves the divide.
 */
export function CompareSlider({
  beforeUrl,
  beforeAlt,
  afterUrl,
  afterAlt,
}: {
  beforeUrl: string;
  beforeAlt: string;
  afterUrl: string;
  afterAlt: string;
}) {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const onChange = useCallback((value: number) => {
    setPct(Math.min(100, Math.max(0, value)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden border hairline bg-card"
    >
      {/* after (result) fills the stage */}
      <Image
        src={afterUrl}
        alt={afterAlt}
        width={900}
        height={1200}
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="w-full object-contain"
        priority
      />

      {/* before (source), clipped from the left */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        aria-hidden
      >
        <Image
          src={beforeUrl}
          alt={beforeAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover"
        />
      </div>

      {/* divider */}
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-bone mix-blend-difference"
        style={{ left: `${pct}%` }}
        aria-hidden
      >
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border hairline bg-bone px-1.5 py-0.5 text-[0.5625rem] font-medium uppercase tracking-[0.14em] text-ink">
          Drag
        </span>
      </div>

      {/* labels */}
      <span className="pointer-events-none absolute top-3 left-3 bg-ink/60 px-2 py-0.5 text-[0.5625rem] uppercase tracking-[0.14em] text-bone">
        Before
      </span>
      <span className="pointer-events-none absolute top-3 right-3 bg-ink/60 px-2 py-0.5 text-[0.5625rem] uppercase tracking-[0.14em] text-bone">
        After
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Compare before and after"
        className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}
