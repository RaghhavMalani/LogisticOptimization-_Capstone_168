import { useMemo, useState } from "react";
import {
  Briefing, ExpertOutput, ForecastPoint, Pin, PortImpact, PortIntel, PortLive,
  RegimeTimeline, SarReport, ScenarioResult, Ship, ShipRec, Vessel, WxReport, fmt,
} from "./api";

const MAP = { minLon: 38, maxLon: 104, minLat: -3, maxLat: 32, w: 1000, h: 620 };

const CHOKEPOINTS: Record<string, { label: string; lon: number; lat: number; status: string }> = {
  HORMUZ: { label: "Hormuz Strait", lon: 56.3, lat: 26.6, status: "CONGESTED" },
  BAB: { label: "Bab-el-Mandeb", lon: 43.3, lat: 12.6, status: "CONGESTED" },
  MALACCA: { label: "Malacca Strait", lon: 101.0, lat: 2.5, status: "SEVERE" },
  SUEZ: { label: "Suez Canal", lon: 39.0, lat: 30.0, status: "NORMAL" },
};

const ROUTES: [string, keyof typeof CHOKEPOINTS][] = [
  ["MUNDRA", "HORMUZ"], ["JNPT", "HORMUZ"], ["JNPT", "BAB"],
  ["COCHIN", "BAB"], ["CHENNAI", "MALACCA"], ["VIZAG", "MALACCA"],
  ["KOLKATA", "MALACCA"], ["TUTICORIN", "BAB"], ["MUNDRA", "SUEZ"],
];

function x(lon: number) { return ((lon - MAP.minLon) / (MAP.maxLon - MAP.minLon)) * MAP.w; }
function y(lat: number) { return (1 - (lat - MAP.minLat) / (MAP.maxLat - MAP.minLat)) * MAP.h; }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function routePath(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const x1 = x(a.lon), y1 = y(a.lat), x2 = x(b.lon), y2 = y(b.lat);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  return `M ${x1} ${y1} Q ${mx - dy * 0.14} ${my + dx * 0.14} ${x2} ${y2}`;
}

const indiaCoast = [
  [66.9, 23.6], [68.6, 22.8], [70.4, 21.3], [71.7, 19.5], [72.5, 18.2],
  [73.1, 16.4], [73.7, 14.4], [74.8, 12.0], [76.2, 9.4], [77.6, 8.1],
  [79.3, 9.4], [80.2, 12.3], [80.3, 14.9], [81.8, 16.9], [83.6, 18.4],
  [86.2, 20.2], [88.7, 21.9], [89.7, 22.8], [88.8, 23.6], [86.0, 22.9],
  [83.1, 21.0], [80.5, 18.2], [78.6, 15.7], [77.0, 12.5], [75.0, 11.0],
  [73.2, 14.8], [71.4, 18.6], [69.0, 22.0], [66.9, 23.6],
].map(([lon, lat]) => `${x(lon)} ${y(lat)}`).join(" ");

function riskClass(level?: string) {
  return String(level ?? "UNKNOWN").toLowerCase();
}

function portRadius(p: Pin | PortImpact) {
  const c = "congestion_now" in p ? p.congestion_now : p.scenario_congestion;
  return 8 + clamp(c, 0, 100) * 0.16;
}

export function MaritimeRadarVisual({ pins, vessels, onSelect }: {
  pins: Pin[]; vessels: Vessel[]; onSelect: (id: string) => void;
}) {
  const [layers, setLayers] = useState({ weather: true, sar: true, model: true });
  const byId = useMemo(() => Object.fromEntries(pins.map((p) => [p.port_id, p])), [pins]);
  const top = [...pins].sort((a, b) => b.congestion_now - a.congestion_now).slice(0, 5);

  return (
    <div className="ops-visual radar-visual">
      <div className="visual-toolbar">
        {(["weather", "sar", "model"] as const).map((k) => (
          <button key={k} className={layers[k] ? "active" : ""}
            onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
            {k === "sar" ? "SAR/AIS proxy" : k === "model" ? "model output" : "weather overlay"}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${MAP.w} ${MAP.h}`} role="img" aria-label="India maritime operations map">
        <defs>
          <radialGradient id="seaGlow" cx="58%" cy="52%" r="70%">
            <stop offset="0%" stopColor="#123451" />
            <stop offset="52%" stopColor="#071827" />
            <stop offset="100%" stopColor="#040812" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width={MAP.w} height={MAP.h} fill="url(#seaGlow)" />
        {Array.from({ length: 18 }, (_, i) => (
          <path key={`wind-${i}`} className="sea-stream"
            d={`M ${40 + i * 54} ${470 + Math.sin(i) * 28} C ${190 + i * 24} ${420 - i * 3}, ${300 + i * 32} ${520 + Math.cos(i) * 26}, ${510 + i * 20} ${448 - Math.sin(i) * 38}`} />
        ))}
        <polygon className="land-mass" points={indiaCoast} />
        <path className="coastline" d={`M ${indiaCoast}`} />
        <path className="subcontinent-shade" d={`M ${x(61)} ${y(29)} L ${x(67)} ${y(24)} L ${x(90)} ${y(23)} L ${x(96)} ${y(27)} L ${x(94)} ${y(34)} L ${x(61)} ${y(34)} Z`} />

        {layers.weather && (
          <g className="weather-layer">
            <ellipse cx={x(75)} cy={y(8)} rx="260" ry="58" transform={`rotate(-8 ${x(75)} ${y(8)})`} />
            <ellipse cx={x(91)} cy={y(18)} rx="175" ry="74" transform={`rotate(18 ${x(91)} ${y(18)})`} />
            <g className="cyclone-map" transform={`translate(${x(86.8)} ${y(13.2)})`}>
              <circle r="48" />
              <path d="M -42 4 C -14 -28, 20 -38, 42 -9 C 15 -14, -5 2, -18 27" />
              <path d="M 34 -4 C 8 28, -26 35, -43 6" />
            </g>
          </g>
        )}

        <g className="route-layer">
          {ROUTES.map(([pid, cp]) => {
            const p = byId[pid];
            const c = CHOKEPOINTS[cp];
            if (!p || !c) return null;
            return <path key={`${pid}-${cp}`} className="route-line" d={routePath(p, c)} />;
          })}
        </g>

        {Object.entries(CHOKEPOINTS).map(([id, c]) => (
          <g key={id} className="choke-node" transform={`translate(${x(c.lon)} ${y(c.lat)})`}>
            <circle r="7" />
            <rect x="11" y="-18" width="132" height="38" rx="6" />
            <text x="18" y="-4">{c.label}</text>
            <text x="18" y="11" className={riskClass(c.status)}>{c.status}</text>
          </g>
        ))}

        {layers.sar && vessels.slice(0, 170).map((v, i) => (
          <circle key={v.id || i} className={`vessel-proxy ${v.status}`}
            cx={x(v.lon)} cy={y(v.lat)} r={v.status === "anchored" ? 3.2 : 2.4}
            style={{ animationDelay: `${-i * 0.17}s` }} />
        ))}

        {pins.map((p) => {
          const r = portRadius(p);
          const severe = p.regime === "SEVERE" || p.congestion_now >= 65;
          return (
            <g key={p.port_id} className={`port-live-node ${riskClass(p.regime)} ${severe ? "major" : ""}`}
              transform={`translate(${x(p.lon)} ${y(p.lat)})`} onClick={() => onSelect(p.port_id)}>
              <circle className="risk-halo" r={r * 2.8} />
              <circle className="risk-ring" r={r * 1.45} />
              <circle className="risk-core" r={r} />
              {layers.model && <text x={r + 7} y="-2">{p.port_id}</text>}
              {layers.model && <text x={r + 7} y="13" className="score">{fmt.n0(p.congestion_now)}</text>}
            </g>
          );
        })}
      </svg>
      <div className="visual-status-strip">
        <span>LIVE NODES {pins.length}</span>
        <span>VESSEL PROXY {vessels.length}</span>
        <span>CHOKEPOINT ROUTES {ROUTES.length}</span>
        <span>TOP RISK {top.map((p) => p.port_id).join(" / ")}</span>
      </div>
    </div>
  );
}

export function PortOpsVisual({ pin, live, sar }: { pin: Pin; live?: PortLive; sar?: SarReport }) {
  const berthCount = Math.max(6, Math.min(12, pin.berth_count || 8));
  const util = live?.berth_utilization ?? clamp(pin.congestion_now / 100, 0.2, 0.95);
  const vessels = live?.vessels ?? [];
  const queue = live?.queue_count ?? Math.round(pin.congestion_now / 5);

  return (
    <div className="ops-visual port-ops-visual">
      <svg viewBox="0 0 980 480" role="img" aria-label={`${pin.port_id} port operations visual`}>
        <defs>
          <linearGradient id="basin" x1="0" x2="1">
            <stop offset="0%" stopColor="#061828" />
            <stop offset="100%" stopColor="#09263a" />
          </linearGradient>
        </defs>
        <rect width="980" height="480" fill="url(#basin)" />
        <path className="port-land" d="M 0 0 L 410 0 C 382 72, 356 118, 388 178 C 420 240, 380 292, 330 328 C 244 389, 245 435, 268 480 L 0 480 Z" />
        <path className="breakwater" d="M 364 116 C 514 126, 634 156, 760 228" />
        <path className="breakwater secondary" d="M 305 356 C 482 325, 610 314, 780 350" />
        <circle className="anchorage-zone" cx="690" cy="168" r={112} />
        <circle className="queue-zone" cx="724" cy="302" r={88} />
        <text className="zone-label" x="612" y="68">ANCHORAGE ZONE</text>
        <text className="zone-label" x="666" y="410">QUEUE ZONE</text>

        {Array.from({ length: berthCount }, (_, i) => {
          const occ = clamp(util * (1.18 - i * 0.055), 0.18, 1);
          const y0 = 58 + i * 31;
          return (
            <g key={i} className={`berth-slot ${occ > 0.86 ? "hot" : occ > 0.62 ? "warm" : ""}`}>
              <rect x="134" y={y0} width="170" height="20" rx="3" />
              <rect x="134" y={y0} width={170 * occ} height="20" rx="3" className="berth-fill" />
              <text x="42" y={y0 + 14}>B{String(i + 1).padStart(2, "0")}</text>
              <text x="316" y={y0 + 14}>{(occ * 100).toFixed(0)}%</text>
            </g>
          );
        })}

        <path id="approachLane" className="approach-lane" d="M 930 424 C 820 360, 740 315, 682 252 C 622 186, 525 148, 386 134" />
        {Array.from({ length: Math.min(18, Math.max(queue, vessels.length)) }, (_, i) => {
          const t = i / Math.max(1, Math.min(18, Math.max(queue, vessels.length)) - 1);
          const cx = 905 - t * 500 + Math.sin(i * 1.7) * 22;
          const cy = 398 - t * 245 + Math.cos(i * 1.3) * 20;
          return <g key={i} className="queued-vessel" style={{ animationDelay: `${-i * 0.23}s` }}>
            <path d={`M ${cx - 9} ${cy + 4} L ${cx} ${cy - 7} L ${cx + 11} ${cy + 4} Z`} />
          </g>;
        })}

        <g className="port-readout">
          <rect x="28" y="368" width="280" height="82" rx="8" />
          <text x="45" y="395">BERTH UTILIZATION</text>
          <text x="45" y="430" className={util > 0.85 ? "red" : util > 0.65 ? "amber" : "green"}>{(util * 100).toFixed(0)}%</text>
          <text x="168" y="430">QUEUE {queue}</text>
        </g>

        <g className="port-readout right">
          <rect x="708" y="34" width="238" height="92" rx="8" />
          <text x="725" y="62">SAR/AIS PROXY</text>
          <text x="725" y="93">{sar ? `${sar.vessel_detections} DETECTIONS` : `${vessels.length} VESSELS`}</text>
          <text x="725" y="111">QUEUE ACTIVITY {sar ? `${(sar.queue_zone_activity * 100).toFixed(0)}%` : "LIVE"}</text>
        </g>
      </svg>
    </div>
  );
}

function windDeg(dir: string) {
  const map: Record<string, number> = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };
  return map[dir.toUpperCase()] ?? 290;
}

export function WeatherIntelVisual({ wx }: { wx: WxReport }) {
  const precip = clamp(wx.rainfall_mm / 80, 0.12, 1);
  const storm = wx.cyclone_risk === "ACTIVE" ? 1 : wx.cyclone_risk === "WATCH" ? 0.65 : 0.25;
  const deg = windDeg(wx.wind_dir);
  return (
    <div className="ops-visual weather-intel-visual">
      <svg viewBox="0 0 980 480" role="img" aria-label={`${wx.port_id} marine weather intelligence`}>
        <defs>
          <linearGradient id="wxSea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#061421" /><stop offset="58%" stopColor="#092a3f" /><stop offset="100%" stopColor="#050914" />
          </linearGradient>
          <filter id="wxBlur"><feGaussianBlur stdDeviation="10" /></filter>
        </defs>
        <rect width="980" height="480" fill="url(#wxSea)" />
        <path className="wx-coast" d="M 92 0 C 142 70, 121 128, 182 188 C 244 250, 186 316, 222 480 L 0 480 L 0 0 Z" />
        {Array.from({ length: 18 }, (_, i) => (
          <path key={i} className="wind-stream"
            style={{ animationDelay: `${-i * 0.19}s` }}
            d={`M ${180 + (i % 6) * 126} ${68 + Math.floor(i / 6) * 108} C ${260 + (i % 6) * 116} ${38 + Math.sin(i) * 42}, ${366 + (i % 6) * 90} ${132 + Math.cos(i) * 40}, ${520 + (i % 6) * 64} ${88 + Math.floor(i / 6) * 104}`} />
        ))}
        <g className="precip-layer" opacity={precip}>
          <ellipse cx="642" cy="168" rx="238" ry="62" transform="rotate(-13 642 168)" />
          <ellipse cx="702" cy="286" rx="190" ry="58" transform="rotate(18 702 286)" />
          <ellipse cx="462" cy="328" rx="155" ry="42" transform="rotate(4 462 328)" />
        </g>
        <g className="wx-storm" transform="translate(732 214)" opacity={storm}>
          <circle r="78" />
          <path d="M -65 8 C -24 -58, 47 -52, 70 -5 C 33 -22, -10 -9, -28 42" />
          <path d="M 56 -6 C 18 58, -49 50, -70 2" />
        </g>
        <g className="wind-compass" transform="translate(806 88)">
          <circle r="49" />
          <path style={{ transform: `rotate(${deg}deg)`, transformOrigin: "0px 0px" }} d="M 0 -39 L 10 8 L 0 1 L -10 8 Z" />
          <text y="72">{wx.wind_dir} {fmt.n1(wx.wind_kt)} KT</text>
        </g>
        <g className="weather-readouts">
          <rect x="30" y="318" width="302" height="122" rx="8" />
          <text x="50" y="348">MARINE WEATHER OUTPUTS</text>
          <text x="50" y="377">RAIN {fmt.n1(wx.rainfall_mm)} MM / WAVE {fmt.n1(wx.wave_m)} M</text>
          <text x="50" y="405">VISIBILITY {fmt.n1(wx.visibility_km)} KM / STORM {wx.cyclone_risk}</text>
          <text x="50" y="427">IMPACT SCORE {wx.weather_impact_score.toFixed(2)}</text>
        </g>
        <g className="wave-meter" transform="translate(438 382)">
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={i * 22} y={42 - clamp(wx.wave_m * 12 + i * 2, 8, 42)} width="14"
              height={clamp(wx.wave_m * 12 + i * 2, 8, 42)} rx="2" />
          ))}
          <text x="0" y="66">WAVE HEIGHT {fmt.n1(wx.wave_m)} M</text>
        </g>
        <g className="visibility-meter" transform="translate(692 382)">
          <rect width="178" height="9" rx="5" />
          <rect width={clamp(wx.visibility_km / 12, 0.05, 1) * 178} height="9" rx="5" className="fill" />
          <text x="0" y="35">VISIBILITY {fmt.n1(wx.visibility_km)} KM</text>
        </g>
      </svg>
    </div>
  );
}

export function SarIntelVisual({ sar, pin, live }: { sar: SarReport; pin: Pin; live?: PortLive }) {
  const count = Math.min(72, Math.max(18, sar.vessel_detections));
  return (
    <div className="ops-visual sar-intel-visual">
      <svg viewBox="0 0 980 480" role="img" aria-label={`${sar.port_id} satellite intelligence scene`}>
        <defs>
          <filter id="sarNoise">
            <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3" seed="7" />
            <feColorMatrix type="matrix" values="0 0 0 .16 0  0 0 0 .45 0  0 0 0 .62 0  0 0 0 .52 0" />
          </filter>
          <radialGradient id="sarGlow">
            <stop offset="0%" stopColor="#2ee6c7" stopOpacity=".36" />
            <stop offset="100%" stopColor="#2ee6c7" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="980" height="480" fill="#050914" />
        <rect width="980" height="480" filter="url(#sarNoise)" opacity=".9" />
        <path className="sar-coast" d="M 0 0 L 342 0 C 310 80, 352 145, 298 210 C 234 287, 276 358, 224 480 L 0 480 Z" />
        <circle className="sar-anchorage" cx="672" cy="190" r="124" />
        <circle className="sar-queue" cx="704" cy="316" r="82" />
        <path className="sar-scan" d="M 160 0 L 620 480" />
        <path className="sar-scan secondary" d="M 318 0 L 778 480" />
        {Array.from({ length: count }, (_, i) => {
          const cluster = i % 3;
          const cx = cluster === 0 ? 630 + ((i * 31) % 170) : cluster === 1 ? 535 + ((i * 47) % 255) : 724 + ((i * 29) % 125);
          const cy = cluster === 0 ? 118 + ((i * 43) % 152) : cluster === 1 ? 276 + ((i * 37) % 110) : 252 + ((i * 41) % 126);
          return <g key={i} className={`sar-detection ${i % 7 === 0 ? "hot" : ""}`}>
            <circle cx={cx} cy={cy} r={i % 7 === 0 ? 5 : 3} />
            {i % 9 === 0 && <circle cx={cx} cy={cy} r="16" className="det-ring" />}
          </g>;
        })}
        <g className="sar-compare">
          <rect x="34" y="330" width="268" height="96" rx="8" />
          <text x="52" y="359">SCENE COMPARISON</text>
          <text x="52" y="389">PREVIOUS: {fmt.n0(sar.vessel_detections / (1 + sar.change_vs_prev_pct / 100))}</text>
          <text x="52" y="414">LATEST: {sar.vessel_detections} / CHANGE {sar.change_vs_prev_pct > 0 ? "+" : ""}{fmt.n1(sar.change_vs_prev_pct)}%</text>
        </g>
        <g className="sar-labels">
          <text x="566" y="58">ANCHORAGE CLUSTER</text>
          <text x="650" y="432">QUEUE ZONE ACTIVITY {(sar.queue_zone_activity * 100).toFixed(0)}%</text>
          <text x="36" y="42">{sar.mode}</text>
          <text x="36" y="66">SCENE {sar.scene_time}</text>
          <text x="36" y="90">CONFIDENCE {sar.sar_confidence.toFixed(2)} / {pin.port_id}</text>
          {live && <text x="36" y="114">LIVE PROXY VESSELS {live.vessels.length}</text>}
        </g>
      </svg>
    </div>
  );
}

export function ModelFlowVisual({ intel, regime, forecast, briefing }: {
  intel?: PortIntel | null; regime?: RegimeTimeline | null; forecast?: { horizon: ForecastPoint[] } | null; briefing?: Briefing | null;
}) {
  const experts = intel?.expert_outputs ?? [];
  const drivers = intel?.drivers ?? [];
  const severe = regime?.current.p_severe ?? 0;
  const horizon = forecast?.horizon ?? [];
  const pts = horizon.length ? sparkline(horizon.map((h) => h.congestion_q50), 254, 70) : "";

  return (
    <div className="ops-visual model-intel-visual">
      <svg viewBox="0 0 980 430" role="img" aria-label="AI model pipeline flow">
        <defs>
          <linearGradient id="flowGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#2ee6c7" /><stop offset="55%" stopColor="#45b9ff" /><stop offset="100%" stopColor="#ffb020" />
          </linearGradient>
        </defs>
        <rect width="980" height="430" fill="#06101c" />
        <path className="ai-flow-line" d="M 155 214 C 265 116, 382 122, 474 214 S 686 318, 826 214" />
        {experts.slice(0, 4).map((e, i) => (
          <ModelNode key={e.expert} x={50 + i * 155} y={46 + (i % 2) * 154} title={e.expert}
            value={e.value} conf={e.confidence} signal={e.signal} />
        ))}
        <g className="model-core-node" transform="translate(452 162)">
          <rect width="156" height="116" rx="10" />
          <text x="20" y="34">HSMM REGIME</text>
          <text x="20" y="68" className="big">{((regime?.current.p_severe ?? 0) * 100).toFixed(0)}%</text>
          <text x="20" y="94">severe probability</text>
        </g>
        <g className="model-core-node tft" transform="translate(656 162)">
          <rect width="156" height="116" rx="10" />
          <text x="20" y="34">TFT FORECAST</text>
          <polyline points={pts} transform="translate(20 48)" />
          <text x="20" y="99">peak D+{briefing?.peak_congestion_day ?? "--"}</text>
        </g>
        <g className="model-core-node decision" transform="translate(840 162)">
          <rect width="116" height="116" rx="10" />
          <text x="16" y="34">DECISION</text>
          <text x="16" y="68" className="big">{briefing ? fmt.n1(briefing.peak_delay_hours) : "--"}h</text>
          <text x="16" y="94">peak delay</text>
        </g>
        <g className="confidence-bank">
          <rect x="44" y="338" width="416" height="64" rx="8" />
          <text x="62" y="365">WHAT CHANGED SINCE LAST RUN</text>
          <text x="62" y="389">{drivers[0]?.name ?? "Weather / SAR / demand signals"}: {drivers[0]?.detail ?? "signals are being fused into the active forecast."}</text>
        </g>
        <g className="influence-bank">
          <rect x="500" y="338" width="430" height="64" rx="8" />
          <text x="518" y="365">FEATURE INFLUENCE</text>
          {drivers.slice(0, 4).map((d, i) => (
            <g key={d.name} transform={`translate(${518 + i * 100} 380)`}>
              <rect width="78" height="7" rx="4" />
              <rect width={clamp(d.value, 0, 1) * 78} height="7" rx="4" className={d.value > 0.65 ? "red" : d.value > 0.45 ? "amber" : "green"} />
              <text y="24">{d.name.slice(0, 12)}</text>
            </g>
          ))}
        </g>
        <text className="model-state" x="460" y="32">CURRENT PORT STATE: HSMM severe {(severe * 100).toFixed(0)}% / TFT horizon {horizon.length || "--"}D</text>
      </svg>
    </div>
  );
}

function ModelNode({ x, y, title, value, conf, signal }: {
  x: number; y: number; title: string; value: number; conf: number; signal: string;
}) {
  return (
    <g className="expert-node" transform={`translate(${x} ${y})`}>
      <rect width="132" height="112" rx="9" />
      <text x="14" y="28">{title.replace(" Expert", "")}</text>
      <text x="14" y="57" className="big">{value.toFixed(2)}</text>
      <rect x="14" y="74" width="96" height="7" rx="4" />
      <rect x="14" y="74" width={clamp(conf, 0, 1) * 96} height="7" rx="4" className="fill" />
      <text x="14" y="100">{signal.slice(0, 18)}</text>
    </g>
  );
}

function sparkline(values: number[], w: number, h: number) {
  if (!values.length) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(1, max - min);
  return values.map((v, i) => {
    const px = (i / Math.max(1, values.length - 1)) * w;
    const py = h - ((v - min) / span) * h;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");
}

export function ScenarioImpactVisual({ result }: { result: ScenarioResult }) {
  const top = [...result.affected_ports].sort((a, b) => b.congestion_delta - a.congestion_delta).slice(0, 7);
  return (
    <div className="ops-visual scenario-impact-visual">
      <svg viewBox={`0 0 ${MAP.w} ${MAP.h}`} role="img" aria-label="Scenario impact map">
        <rect width={MAP.w} height={MAP.h} fill="#06101c" />
        <polygon className="land-mass" points={indiaCoast} />
        {top.map((p, i) => (
          <g key={p.port_id} className="scenario-port" transform={`translate(${x(p.lon)} ${y(p.lat)})`}>
            <circle className="before" r={6 + p.baseline_congestion * 0.13} />
            <circle className="after" r={8 + p.scenario_congestion * 0.16} />
            <text x="18" y="-4">{p.port_id}</text>
            <text x="18" y="12">+{fmt.n1(p.congestion_delta)}</text>
            <path className="impact-ray" d={`M 0 0 L ${90 + i * 7} ${-50 + i * 18}`} />
          </g>
        ))}
        <g className="scenario-bars" transform="translate(38 352)">
          <rect width="412" height="222" rx="9" />
          <text x="20" y="32">BEFORE / AFTER CONGESTION IMPACT</text>
          {top.slice(0, 5).map((p, i) => (
            <g key={p.port_id} transform={`translate(20 ${56 + i * 29})`}>
              <text x="0" y="10">{p.port_id}</text>
              <rect x="76" y="1" width={p.baseline_congestion * 2.2} height="9" rx="5" className="base" />
              <rect x="76" y="14" width={p.scenario_congestion * 2.2} height="9" rx="5" className="shock" />
              <text x="315" y="18">+{fmt.n1(p.delay_delta_hours)}h</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export function FleetRoutingVisual({ ships, rec, pins }: { ships: Ship[]; rec?: ShipRec | null; pins?: Pin[] }) {
  const selected = rec ?? ships[0];
  const target = pins?.find((p) => p.port_id === selected?.recommended_port || p.port_id === selected?.intended_port);
  const tx = target ? x(target.lon) : 650;
  const ty = target ? y(target.lat) : 235;
  const best = selected?.best_arrival_day ?? 2;
  const worst = selected?.worst_arrival_day ?? 6;
  return (
    <div className="ops-visual fleet-routing-visual">
      <svg viewBox={`0 0 ${MAP.w} 480`} role="img" aria-label="Fleet routing recommendation view">
        <rect width={MAP.w} height="480" fill="#06101c" />
        <polygon className="land-mass" points={indiaCoast} />
        <path className="fleet-route" d={`M ${x(56)} ${y(8)} C 390 360, 520 300, ${tx} ${ty}`} />
        <circle className="fleet-origin" cx={x(56)} cy={y(8)} r="9" />
        <circle className="fleet-destination" cx={tx} cy={ty} r="18" />
        <text x={tx + 24} y={ty - 8}>{target?.port_id ?? selected?.recommended_port ?? "PORT"}</text>
        <text x={tx + 24} y={ty + 10}>{target?.regime ?? selected?.port_entry_risk ?? "RISK"}</text>
        <g className="fleet-card" transform="translate(42 310)">
          <rect width="380" height="132" rx="9" />
          <text x="22" y="34">{selected?.name ?? "Select vessel"}</text>
          <text x="22" y="63">ROUTE {selected ? `${selected.intended_port}${selected.reroute ? " -> " + selected.recommended_port : ""}` : "--"}</text>
          <text x="22" y="91">BUFFER {selected?.recommended_buffer_hours ?? "--"}H / CONF {selected?.confidence ?? "--"}</text>
          <text x="22" y="116">{rec?.advisory?.slice(0, 56) ?? "Select a vessel for routing recommendation."}</text>
        </g>
        <g className="arrival-window" transform="translate(502 328)">
          <rect width="404" height="94" rx="9" />
          <text x="22" y="30">BEST ARRIVAL WINDOW</text>
          {Array.from({ length: 10 }, (_, i) => {
            const day = i + 1;
            const active = day >= best && day <= worst;
            return <g key={day} transform={`translate(${22 + i * 36} 48)`}>
              <rect width="26" height="22" rx="4" className={day === best ? "best" : active ? "window" : ""} />
              <text x="8" y="15">{day}</text>
            </g>;
          })}
        </g>
      </svg>
    </div>
  );
}
