import L from "leaflet";
import { LayerGroup, Marker, Polyline, Tooltip } from "react-leaflet";
import type { VesselProxy } from "@/types/portwatch";
import { asLatLng, colorForVesselSource } from "./mapUtils";

function vesselIcon(vessel: VesselProxy) {
  const color = colorForVesselSource(vessel.source);
  return L.divIcon({
    className: "pw-vessel-leaflet-icon",
    html: `<span class="pw-vessel-glyph" style="--vessel-color:${color}; transform:rotate(${vessel.heading}deg)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function wake(vessel: VesselProxy): [number, number][] {
  const heading = (vessel.heading * Math.PI) / 180;
  const length = Math.min(0.18, 0.035 + vessel.speedKnots * 0.008);
  return [
    asLatLng(vessel.location),
    [
      vessel.location.lat - Math.cos(heading) * length,
      vessel.location.lon - Math.sin(heading) * length,
    ],
  ];
}

export function VesselProxyLayer({
  vessels,
  visible,
}: {
  vessels: VesselProxy[];
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {vessels.map((vessel) => {
        const color = colorForVesselSource(vessel.source);
        return (
          <LayerGroup key={vessel.id}>
            <Polyline
              positions={wake(vessel)}
              pathOptions={{
                color,
                opacity: 0.42,
                weight: 1,
                dashArray: "3 5",
              }}
            />
            <Marker
              position={asLatLng(vessel.location)}
              icon={vesselIcon(vessel)}
            >
              <Tooltip
                className="pw-port-tooltip"
                direction="top"
                offset={[0, -8]}
              >
                <div className="pw-tooltip-card">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--color-cyan)]">
                      {vessel.vesselType}
                    </span>
                    <span>{vessel.source}</span>
                  </div>
                  <div>{vessel.id}</div>
                  <div className="grid grid-cols-[72px_48px] gap-x-2 tabular-nums">
                    <span>SPD</span>
                    <b>{vessel.speedKnots}kt</b>
                    <span>HDG</span>
                    <b>{vessel.heading}</b>
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
