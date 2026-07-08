import L from "leaflet";
import { useEffect, useState } from "react";
import { LayerGroup, Marker, Polyline, Tooltip } from "react-leaflet";
import type { VesselProxy } from "@/types/portwatch";

const vesselColor = {
  CONT: "#7dd3fc",
  TANKER: "#ffb347",
  BULK: "#7ef0b4",
  LNG: "#c58cff",
  OTHER: "#9ff7ff",
} as const;

function movedPosition(
  vessel: VesselProxy,
  tick: number,
  index: number,
): [number, number] {
  const heading = (vessel.heading * Math.PI) / 180;
  const drift = Math.sin(tick * 0.55 + index * 0.7) * 0.035;
  return [
    vessel.location.lat + Math.cos(heading) * drift,
    vessel.location.lon + Math.sin(heading) * drift,
  ];
}

function wake(
  position: [number, number],
  heading: number,
  speed: number,
): [number, number][] {
  const radians = (heading * Math.PI) / 180;
  const length = Math.min(0.34, 0.1 + speed * 0.01);
  return [
    position,
    [
      position[0] - Math.cos(radians) * length,
      position[1] - Math.sin(radians) * length,
    ],
  ];
}

function vesselIcon(vessel: VesselProxy) {
  const color = vesselColor[vessel.vesselType];
  const sourceClass =
    vessel.source === "SAR"
      ? "sar"
      : vessel.source === "AIS_SAR"
        ? "fused"
        : "ais";
  return L.divIcon({
    className: "pw-radar-vessel-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <span class="pw-radar-vessel ${sourceClass}" style="--vessel-color:${color}; --vessel-heading:${vessel.heading}deg">
        <i></i>
      </span>
    `,
  });
}

export function VesselProxyLayer({
  vessels,
  visible,
}: {
  vessels: VesselProxy[];
  visible: boolean;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1200);
    return () => window.clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <LayerGroup>
      {vessels.map((vessel, index) => {
        const position = movedPosition(vessel, tick, index);
        const color = vesselColor[vessel.vesselType];
        return (
          <LayerGroup key={vessel.id}>
            <Polyline
              positions={wake(position, vessel.heading, vessel.speedKnots)}
              pathOptions={{
                color,
                opacity: 0.46,
                weight: 1.1,
                dashArray: "2 6",
                className: "pw-vessel-wake-line",
              }}
            />
            <Marker position={position} icon={vesselIcon(vessel)}>
              <Tooltip
                className="pw-port-tooltip"
                direction="top"
                offset={[0, -12]}
              >
                <div className="pw-tooltip-card">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--color-cyan)]">
                      {vessel.vesselType}
                    </span>
                    <span>{vessel.source}</span>
                  </div>
                  <div>{vessel.id}</div>
                  <div className="grid grid-cols-[82px_54px] gap-x-2 tabular-nums">
                    <span>SPEED</span>
                    <b>{vessel.speedKnots}kt</b>
                    <span>HEADING</span>
                    <b>{vessel.heading}</b>
                    <span>DEST</span>
                    <b>{vessel.destinationPortCode ?? "IND"}</b>
                    <span>CONF</span>
                    <b>{Math.round(vessel.confidence * 100)}%</b>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
