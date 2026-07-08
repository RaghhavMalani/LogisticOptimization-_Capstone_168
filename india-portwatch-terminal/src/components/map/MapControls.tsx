import type { MapLayerVisibility } from "./types";

const controls: Array<{ key: keyof MapLayerVisibility; label: string }> = [
  { key: "ports", label: "PORTS" },
  { key: "vessels", label: "AIS/SAR" },
  { key: "weather", label: "WX" },
  { key: "routes", label: "ROUTES" },
  { key: "alerts", label: "ALERTS" },
  { key: "sar", label: "SAR" },
];

export function MapControls({
  layers,
  onToggle,
}: {
  layers: MapLayerVisibility;
  onToggle: (key: keyof MapLayerVisibility) => void;
}) {
  return (
    <div className="absolute top-12 left-3 z-30 flex flex-col gap-1 border border-[var(--color-cyan)]/25 bg-[oklch(0.10_0.02_240_/_0.72)] backdrop-blur px-1.5 py-1.5">
      {controls.map((control) => {
        const active = layers[control.key];
        return (
          <button
            key={control.key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(control.key)}
            className={
              "min-w-[58px] px-1.5 py-0.5 text-[8px] tracking-[0.16em] border transition-colors " +
              (active
                ? "border-[var(--color-cyan)] text-[var(--color-cyan)] bg-[oklch(0.82_0.18_195_/_0.10)]"
                : "border-[var(--color-line)] text-[var(--color-muted-foreground)] bg-[oklch(0.12_0.02_240_/_0.65)]")
            }
          >
            {control.label}
          </button>
        );
      })}
    </div>
  );
}
