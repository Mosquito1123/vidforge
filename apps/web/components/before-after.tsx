"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type BeforeAfterType = "image" | "video";

export type BeforeAfterProps = {
  before: string;
  after: string;
  beforeType?: BeforeAfterType;
  afterType?: BeforeAfterType;
  beforeLabel?: string;
  afterLabel?: string;
  initial?: number; // 0..100
  className?: string;
};

function detectType(src: string): BeforeAfterType {
  const path = src.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/.test(path)) return "video";
  if (src.startsWith("data:video") || src.startsWith("blob:video")) return "video";
  // best-effort for blob urls without extension: treat as image by default
  return "image";
}

function Media({
  src,
  type,
}: {
  src: string;
  type: BeforeAfterType;
}) {
  if (type === "video") {
    return (
      <video
        src={src}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      draggable={false}
    />
  );
}

export function BeforeAfter({
  before,
  after,
  beforeType,
  afterType,
  beforeLabel = "Before",
  afterLabel = "After",
  initial = 50,
  className,
}: BeforeAfterProps) {
  const bt = beforeType ?? detectType(before);
  const at = afterType ?? detectType(after);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState(() => Math.min(100, Math.max(0, initial)));
  const [dragging, setDragging] = React.useState(false);

  const updateFromClientX = React.useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  // Pointer drag handlers
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, updateFromClientX]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 1 : 5;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPos((p) => Math.max(0, p - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPos((p) => Math.min(100, p + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      setPos(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setPos(100);
    }
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (t) updateFromClientX(t.clientX);
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (t) updateFromClientX(t.clientX);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-lg border bg-black select-none aspect-video",
        className,
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      {/* Before (full) */}
      <div className="absolute inset-0">
        <Media src={before} type={bt} />
      </div>
      {/* After (clipped to right of divider) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <Media src={after} type={at} />
      </div>

      {/* Divider + handle */}
      <div
        className="absolute top-0 bottom-0 z-20 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{ left: `${pos}%` }}
        aria-hidden="true"
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Comparison slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(true);
          updateFromClientX(e.clientX);
        }}
        className={cn(
          "absolute top-1/2 z-30 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-black/60 text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-white",
          dragging && "scale-110",
        )}
        style={{ left: `${pos}%` }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3L2 8L5 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 3L14 8L11 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Labels */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
        {beforeLabel}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
        {afterLabel}
      </div>
    </div>
  );
}

export default BeforeAfter;