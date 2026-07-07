/* MapLibre maps: national radar (markers + vessels + chokepoint routes) and
   the port-area digital-twin panel (anchorage ring, queue, radar sweep).
   Vessel dots are the backend's AIS/satellite PROXY simulation. */
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { Pin, PortLive, Vessel } from "./api";

const CHOKEPOINTS: Record<string, [number, number]> = {
  HORMUZ: [56.3, 26.6], BAB_EL_MANDEB: [43.3, 12.6], MALACCA: [101.0, 2.5],
};
const ROUTES: [string, string][] = [
  ["MUNDRA", "HORMUZ"], ["JNPT", "HORMUZ"], ["JNPT", "BAB_EL_MANDEB"],
  ["COCHIN", "BAB_EL_MANDEB"], ["CHENNAI", "MALACCA"], ["VIZAG", "MALACCA"],
  ["KOLKATA", "MALACCA"], ["TUTICORIN", "BAB_EL_MANDEB"],
];

function darkStyle(): maplibregl.StyleSpecification {
  // Satellite imagery (Esri World Imagery, free/no key) dimmed to command-center
  // tones, with CARTO dark labels floated on top for place names.
  return {
    version: 8,
    sources: {
      sat: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Esri World Imagery",
      },
      labels: {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png"],
        tileSize: 256,
        attribution: "CARTO",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0b1120" } },
      { id: "sat", type: "raster", source: "sat",
        paint: { "raster-brightness-max": 0.75, "raster-saturation": -0.35,
                 "raster-contrast": 0.12, "raster-opacity": 0.95 } },
      { id: "labels", type: "raster", source: "labels",
        paint: { "raster-opacity": 0.85 } },
    ],
  };
}

function arc(a: [number, number], b: [number, number], n = 24): [number, number][] {
  // Simple curved line: quadratic bezier with an offset control point.
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const cx = mx - dy * 0.12, cy = my + dx * 0.12;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0],
              u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
  }
  return pts;
}

function markerSize(c: number) { return 10 + (Math.max(0, Math.min(100, c || 0)) / 100) * 20; }

function addVessels(map: maplibregl.Map, vessels: Vessel[]) {
  const marks = vessels.map((v0) => {
    const v = { ...v0 };
    const d = document.createElement("div");
    d.className = `vessel-dot ${v.status}`;
    d.title = `${v.name} · ${v.status}${v.speed_kn ? ` · ${v.speed_kn} kn` : ""}`;
    const m = new maplibregl.Marker({ element: d }).setLngLat([v.lon, v.lat]).addTo(map);
    return { m, v };
  });
  const t = setInterval(() => {
    for (const { m, v } of marks) {
      if (v.speed_kn > 0.5) {
        const step = v.speed_kn * 0.00035, b = (v.heading * Math.PI) / 180;
        v.lat += step * Math.cos(b); v.lon += step * Math.sin(b);
        m.setLngLat([v.lon, v.lat]);
      }
    }
  }, 1000);
  return () => { clearInterval(t); marks.forEach(({ m }) => m.remove()); };
}

export function RadarMap({ pins, vessels, onSelect, height = "62vh" }: {
  pins: Pin[]; vessels: Vessel[]; onSelect: (id: string) => void; height?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [fail, setFail] = useState("");
  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el.current, style: darkStyle(), center: [76, 15], zoom: 4.1,
        maxBounds: [[40, -8], [110, 38]], attributionControl: false,
      });
    } catch (e) {
      console.error("[portwatch] MapLibre init failed:", e);
      setFail(String(e));
      return;
    }
    map.on("error", (e) => console.warn("[portwatch] map error:", e?.error ?? e));
    const kick = setTimeout(() => map.resize(), 400);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.fitBounds([[62, 5], [93, 26]], { padding: 30, duration: 0 });

    map.on("load", () => {
      const byId = Object.fromEntries(pins.map((p) => [p.port_id, p]));
      const feats = ROUTES.filter(([p]) => byId[p]).map(([p, cp]) => ({
        type: "Feature" as const, properties: {},
        geometry: { type: "LineString" as const,
          coordinates: arc([byId[p].lon, byId[p].lat], CHOKEPOINTS[cp]) },
      }));
      map.addSource("routes", { type: "geojson",
        data: { type: "FeatureCollection", features: feats } });
      map.addLayer({ id: "routes", type: "line", source: "routes",
        paint: { "line-color": "#38bdf8", "line-opacity": 0.25,
                 "line-width": 1.2, "line-dasharray": [2, 3] } });
      for (const [cp, coord] of Object.entries(CHOKEPOINTS)) {
        const d = document.createElement("div");
        d.className = "vessel-dot"; d.style.background = "var(--cyan)";
        d.style.width = "9px"; d.style.height = "9px"; d.title = cp;
        new maplibregl.Marker({ element: d }).setLngLat(coord as [number, number]).addTo(map);
      }
    });

    for (const pin of pins) {
      const d = document.createElement("div");
      const s = markerSize(pin.congestion_now);
      d.className = "port-node";
      d.innerHTML = `<span class="port-marker ${pin.regime}" style="width:${s}px;height:${s}px"></span>
        <span class="port-tag">${pin.port_id} <b>${pin.congestion_now.toFixed(0)}</b></span>`;
      d.addEventListener("click", (e) => { e.stopPropagation(); onSelect(pin.port_id); });
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<div style="font-size:12px;min-width:190px"><b>${pin.name}</b>
         <span class="badge ${pin.regime.toLowerCase()}">${pin.regime}</span><br/>
         congestion <b>${pin.congestion_now.toFixed(1)}</b> · delay <b>${pin.delay_hours.toFixed(1)}h</b><br/>
         transition risk ${(pin.transition_risk * 100).toFixed(0)}% · conf ${pin.regime_confidence}</div>`);
      new maplibregl.Marker({ element: d }).setLngLat([pin.lon, pin.lat]).setPopup(popup).addTo(map);
      d.addEventListener("mouseenter", () => popup.addTo(map).setLngLat([pin.lon, pin.lat]));
      d.addEventListener("mouseleave", () => popup.remove());
    }
    const stop = vessels.length ? addVessels(map, vessels) : () => {};
    return () => { clearTimeout(kick); stop(); map.remove(); };
  }, [pins, vessels]);

  if (fail) {
    return (
      <div className="map-wrap" style={{ height }}>
        <SvgIndiaFallback pins={pins} onSelect={onSelect} note={fail} />
      </div>
    );
  }
  return (
    <div className="map-wrap" style={{ height }}>
      <div ref={el} className="map-abs" />
      <div className="map-legend">
        <span><span className="ldot" style={{ background: "var(--green)" }} />Normal</span>
        <span><span className="ldot" style={{ background: "var(--amber)" }} />Congested</span>
        <span><span className="ldot" style={{ background: "var(--red)" }} />Severe</span>
        <span><span className="ldot" style={{ background: "var(--purple)" }} />Unknown</span>
        <span><span className="ldot" style={{ background: "#9fd8ff", width: 6, height: 6 }} />Vessel (proxy)</span>
        <span><span className="ldot" style={{ background: "var(--cyan)" }} />Chokepoint route</span>
      </div>
    </div>
  );
}

function circleGeo(lat: number, lon: number, km: number, n = 48) {
  const c: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const b = (i / n) * 2 * Math.PI;
    c.push([lon + (km / (111.3 * Math.cos((lat * Math.PI) / 180))) * Math.sin(b),
            lat + (km / 110.6) * Math.cos(b)]);
  }
  return { type: "Feature" as const, properties: {},
    geometry: { type: "Polygon" as const, coordinates: [c] } };
}

export function PortAreaMap({ port, live }: { port: Pin; live: PortLive }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el.current, style: darkStyle(),
        center: [(port.lon + live.anchorage.lon) / 2, (port.lat + live.anchorage.lat) / 2],
        zoom: 9.4, attributionControl: false,
      });
    } catch (e) {
      console.error("[portwatch] area map init failed:", e);
      if (el.current) el.current.innerHTML =
        `<div class="loading">MAP ENGINE UNAVAILABLE - vessel field: ${live.vessels.length} tracked (${live.queue_count} queued)</div>`;
      return;
    }
    map.on("error", (e) => console.warn("[portwatch] map error:", e?.error ?? e));
    map.on("load", () => {
      map.addSource("anch", { type: "geojson",
        data: circleGeo(live.anchorage.lat, live.anchorage.lon, live.anchorage.radius_km) });
      map.addLayer({ id: "anch-f", type: "fill", source: "anch",
        paint: { "fill-color": "#f5a524", "fill-opacity": 0.08 } });
      map.addLayer({ id: "anch-l", type: "line", source: "anch",
        paint: { "line-color": "#f5a524", "line-opacity": 0.5, "line-dasharray": [3, 3] } });
      // Smooth cinematic ease into the port.
      map.easeTo({ zoom: 9.9, duration: 2400 });
    });
    const pd = document.createElement("div");
    pd.className = `port-marker ${port.regime}`;
    pd.style.width = "16px"; pd.style.height = "16px";
    new maplibregl.Marker({ element: pd }).setLngLat([port.lon, port.lat]).addTo(map);
    const stop = addVessels(map, live.vessels);
    return () => { stop(); map.remove(); };
  }, [port.port_id]);
  return <div ref={el} className="map-abs" />;
}


/* Offline / no-WebGL fallback: vector India scatter, always renders. */
export function SvgIndiaFallback({ pins, onSelect, note = "" }: {
  pins: Pin[]; onSelect: (id: string) => void; note?: string;
}) {
  const minLon = 66, minLat = 5, maxLon = 96, maxLat = 32, W = 900, H = 620;
  const X = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * W;
  const Y = (lat: number) => (1 - (lat - minLat) / (maxLat - minLat)) * H;
  const color: Record<string, string> = {
    NORMAL: "var(--green)", CONGESTED: "var(--amber)",
    SEVERE: "var(--red)", UNKNOWN: "var(--purple)",
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", background: "#0b1120" }}>
      <text x={16} y={24} fill="var(--muted)" style={{ font: "11px var(--mono)", letterSpacing: 3 }}>
        INDIA - VECTOR FALLBACK (map engine unavailable: {note.slice(0, 60)})
      </text>
      {pins.map((p) => {
        const r = markerSize(p.congestion_now) / 2.2;
        return (
          <g key={p.port_id} style={{ cursor: "pointer" }} onClick={() => onSelect(p.port_id)}>
            <circle cx={X(p.lon)} cy={Y(p.lat)} r={r}
              fill={color[p.regime] ?? "var(--purple)"} opacity={0.9}
              stroke="rgba(255,255,255,.6)" />
            <text x={X(p.lon) + r + 4} y={Y(p.lat) + 3} fill="var(--muted)"
              style={{ font: "9px var(--mono)" }}>{p.port_id}</text>
          </g>
        );
      })}
    </svg>
  );
}
