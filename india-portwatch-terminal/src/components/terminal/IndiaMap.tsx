import { lazy, Suspense, useEffect, useState } from "react";

const RealMap = lazy(() => import("./RealMap"));

export function IndiaMap({
  focus,
  overlay,
}: {
  focus?: string;
  showWeather?: boolean;
  showVessels?: boolean;
  overlay?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#0a1420] overflow-hidden">
      {mounted ? (
        <Suspense fallback={<MapSkeleton />}>
          <RealMap focus={focus} />
        </Suspense>
      ) : (
        <MapSkeleton />
      )}

      {/* Scanlines + vignette overlay for terminal feel — pointer-events none so map stays interactive */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-40" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, oklch(0 0 0 / 0.55) 100%)" }}
      />

      {/* Corner reticles */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          ["top-2 left-2", "border-l border-t"],
          ["top-2 right-2", "border-r border-t"],
          ["bottom-2 left-2", "border-l border-b"],
          ["bottom-2 right-2", "border-r border-b"],
        ].map(([pos, b], i) => (
          <div key={i} className={`absolute ${pos} h-4 w-4 ${b} border-[var(--color-cyan)]/60`} />
        ))}
      </div>

      {/* HUD strips */}
      <div className="absolute top-2 right-2 z-[400] text-[9px] tracking-widest uppercase text-[var(--color-muted-foreground)] bg-[var(--color-background)]/80 border border-[var(--color-line)] px-2 py-1 pointer-events-none">
        PROJ: WEB-MERC · TILE: CARTO-DARK · AIS+SAR+IMD · Δ {tick}s
      </div>
      <div className="absolute bottom-2 left-2 z-[400] flex flex-wrap items-center gap-2 text-[9px] tracking-widest uppercase text-[var(--color-muted-foreground)] bg-[var(--color-background)]/80 border border-[var(--color-line)] px-2 py-1 pointer-events-none">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-mint)]" /> Normal</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-amber)]" /> Congested</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-red)] animate-blink" /> Severe</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-purple)]" /> Low conf</span>
        <span className="opacity-60">| cyan=cont · amber=tanker · mint=bulk · purple=LNG</span>
      </div>

      {overlay}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="absolute inset-0 grid-bg flex items-center justify-center">
      <div className="text-[10px] tracking-widest text-[var(--color-muted-foreground)] animate-pulse">ACQUIRING TILE STREAM…</div>
    </div>
  );
}
