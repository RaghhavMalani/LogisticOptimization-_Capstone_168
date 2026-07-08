import { Circle, CircleMarker, LayerGroup, Tooltip } from "react-leaflet";
import type { PortOperationalSnapshot } from "@/services/portService";
import type { SARSignal } from "@/types/portwatch";
import { asLatLng } from "./mapUtils";

export function SARLayer({
  ports,
  signals,
  visible,
}: {
  ports: PortOperationalSnapshot[];
  signals: SARSignal[];
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <LayerGroup>
      {signals.map((signal) => {
        const port = ports.find((item) => item.code === signal.portCode);
        if (!port) return null;
        const center = asLatLng(port.location);
        const color = signal.confidence < 0.65 ? "#c58cff" : "#7dd3fc";
        return (
          <LayerGroup key={signal.sceneId}>
            <Circle
              center={center}
              radius={42000 + signal.anchorageCount * 1800}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.035,
                opacity: 0.58,
                weight: 1.2,
                dashArray: "2 6",
              }}
            />
            <CircleMarker
              center={center}
              radius={3}
              pathOptions={{
                color: "#edf7ff",
                fillColor: color,
                fillOpacity: 0.9,
                opacity: 0.9,
                weight: 1,
              }}
            >
              <Tooltip className="pw-port-tooltip" direction="top">
                <div className="pw-tooltip-card">
                  <div className="text-[var(--color-cyan)]">
                    SAR {port.short}
                  </div>
                  <div>
                    {signal.vesselDetections} detections ·{" "}
                    {signal.anchorageCount} anchorage
                  </div>
                  <div>
                    {signal.sarOnly} SAR-only · confidence{" "}
                    {signal.confidence.toFixed(2)}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
