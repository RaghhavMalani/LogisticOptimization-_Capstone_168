import { MapContainer, TileLayer, Polyline, Polygon, Circle, Tooltip, LayerGroup, Rectangle } from "react-leaflet";

// Chennai Port approximate area
const CENTER: [number, number] = [13.101, 80.303];

// Approximate berth polylines along the harbour (schematic on real coords)
const BERTHS: { id: string; poly: [number, number][]; occ: number }[] = [
  { id: "B1", occ: 0.94, poly: [[13.1050, 80.2960], [13.1050, 80.2985]] },
  { id: "B2", occ: 0.88, poly: [[13.1040, 80.2960], [13.1040, 80.2985]] },
  { id: "B3", occ: 0.62, poly: [[13.1030, 80.2965], [13.1030, 80.2990]] },
  { id: "B4", occ: 0.00, poly: [[13.1020, 80.2970], [13.1020, 80.2995]] },
  { id: "B5", occ: 0.71, poly: [[13.1010, 80.2975], [13.1010, 80.3000]] },
  { id: "B6", occ: 0.55, poly: [[13.1000, 80.2980], [13.1000, 80.3005]] },
  { id: "B7", occ: 0.40, poly: [[13.0990, 80.2985], [13.0990, 80.3010]] },
];

const APPROACH: [number, number][] = [
  [13.070, 80.360],
  [13.085, 80.335],
  [13.098, 80.315],
  [13.101, 80.302],
];

const QUEUE_ZONE: [number, number][] = [
  [13.060, 80.340],
  [13.060, 80.395],
  [13.100, 80.395],
  [13.100, 80.340],
];

function occColor(occ: number) {
  if (occ === 0) return "#c58cff";
  if (occ > 0.85) return "#ff5566";
  if (occ > 0.6) return "#ffb347";
  return "#7ef0b4";
}

export default function PortSatellite() {
  return (
    <MapContainer
      center={CENTER}
      zoom={14}
      minZoom={12}
      maxZoom={17}
      zoomControl={false}
      attributionControl={false}
      preferCanvas
      className="absolute inset-0 w-full h-full"
      style={{ background: "#0a1420" }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
        opacity={0.9}
      />

      {/* Approach lane */}
      <Polyline positions={APPROACH} pathOptions={{ color: "#7dd3fc", weight: 2, dashArray: "6 6", opacity: 0.85 }}>
        <Tooltip permanent direction="center" className="pw-tip pw-tip-cyan" offset={[0, -10]}>APPROACH · CH-A</Tooltip>
      </Polyline>

      {/* Queue zone */}
      <Polygon positions={QUEUE_ZONE} pathOptions={{ color: "#ffb347", weight: 1, fillColor: "#ffb347", fillOpacity: 0.06, dashArray: "3 4" }}>
        <Tooltip permanent direction="top" className="pw-tip" offset={[0, 0]}>QUEUE ZONE · CH-A</Tooltip>
      </Polygon>

      {/* Anchorage rings */}
      <LayerGroup>
        <Circle center={[13.080, 80.370]} radius={2200} pathOptions={{ color: "#ffb347", weight: 1, fillColor: "#ffb347", fillOpacity: 0.05, dashArray: "3 5" }} />
        <Circle center={[13.080, 80.370]} radius={1200} pathOptions={{ color: "#ffb347", weight: 1, fillColor: "#ffb347", fillOpacity: 0.08 }}>
          <Tooltip permanent direction="top" className="pw-tip" offset={[0, -6]}>ANCHORAGE Q · 22 VESSELS</Tooltip>
        </Circle>
      </LayerGroup>

      {/* Berths as short bold polylines */}
      {BERTHS.map((b) => {
        const color = occColor(b.occ);
        return (
          <LayerGroup key={b.id}>
            <Polyline positions={b.poly} pathOptions={{ color, weight: 5, opacity: 0.95 }}>
              <Tooltip permanent direction="right" className="pw-tip" offset={[8, 0]}>
                {b.id} · {(b.occ * 100).toFixed(0)}%
              </Tooltip>
            </Polyline>
          </LayerGroup>
        );
      })}

      {/* Bounding box of terminal */}
      <Rectangle
        bounds={[[13.0975, 80.2955], [13.1058, 80.3015]]}
        pathOptions={{ color: "#7dd3fc", weight: 0.8, fillOpacity: 0, dashArray: "2 4" }}
      />
    </MapContainer>
  );
}
