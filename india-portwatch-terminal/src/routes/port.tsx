import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Chip, Sparkline, Bar } from "@/components/terminal/ui";
import chennaiSat from "@/assets/chennai-port.jpg";
import {
  getDecisionRecommendation,
  getForecastForPort,
  getHSMMRegime,
  listModelPipelineStatuses,
} from "@/services/modelService";
import {
  fetchDecisionRecommendation,
  fetchForecastForPort,
  fetchHSMMRegime,
  fetchModelPipelineStatuses,
} from "@/services/model";
import { listNewsEvents } from "@/services/newsService";
import { fetchNewsEvents } from "@/services/news";
import { getPortSnapshot } from "@/services/portService";
import { fetchPortSnapshot } from "@/services/ports";
import { getWeatherSignal } from "@/services/weatherService";
import { fetchWeatherSignal } from "@/services/weather";

export const Route = createFileRoute("/port")({
  validateSearch: (search: Record<string, unknown>) => ({
    port: typeof search.port === "string" ? search.port : "INMAA",
  }),
  component: PortPage,
});

const berthOcc = [
  ["B1", 100, "red"],
  ["B2", 95, "red"],
  ["B3", 95, "red"],
  ["B4", 90, "red"],
  ["B5", 65, "amber"],
  ["B6", 60, "amber"],
  ["B7", 60, "amber"],
  ["B8", 50, "amber"],
  ["B9", 40, "mint"],
  ["B10", 30, "mint"],
] as const;

function PortPage() {
  const { port } = Route.useSearch();
  const portQuery = useQuery({
    queryKey: ["port", port],
    queryFn: () => fetchPortSnapshot(port),
    initialData: () => getPortSnapshot(port),
    staleTime: 30_000,
  });
  const chn = portQuery.data;
  const weatherQuery = useQuery({
    queryKey: ["weather", chn.code],
    queryFn: () => fetchWeatherSignal(chn.code),
    initialData: () => getWeatherSignal(chn.code),
    staleTime: 30_000,
  });
  const regimeQuery = useQuery({
    queryKey: ["regime", chn.code],
    queryFn: () => fetchHSMMRegime(chn.code),
    initialData: () => getHSMMRegime(chn.code),
    staleTime: 30_000,
  });
  const forecastQuery = useQuery({
    queryKey: ["forecast", chn.code],
    queryFn: () => fetchForecastForPort(chn.code),
    initialData: () => getForecastForPort(chn.code),
    staleTime: 30_000,
  });
  const recommendationQuery = useQuery({
    queryKey: ["decision", chn.code],
    queryFn: () => fetchDecisionRecommendation(chn.code),
    initialData: () => getDecisionRecommendation(chn.code),
    staleTime: 30_000,
  });
  const expertsQuery = useQuery({
    queryKey: ["model-pipeline"],
    queryFn: fetchModelPipelineStatuses,
    initialData: listModelPipelineStatuses,
    staleTime: 60_000,
  });
  const newsQuery = useQuery({
    queryKey: ["news-events"],
    queryFn: fetchNewsEvents,
    initialData: listNewsEvents,
    staleTime: 30_000,
  });
  const weather = weatherQuery.data;
  const regime = regimeQuery.data;
  const forecastDays = forecastQuery.data;
  const recommendation = recommendationQuery.data;
  const experts = expertsQuery.data;
  const newsForPort = newsQuery.data.filter((event) =>
    event.affectedPorts.includes(chn.code),
  );
  const portName = chn.name.toUpperCase();
  const riskTone =
    chn.risk === "severe" ? "red" : chn.risk === "congested" ? "amber" : "mint";
  const severityLabel =
    chn.risk === "severe"
      ? "SEVERE"
      : chn.risk === "congested"
        ? "HIGH"
        : "NORMAL";

  return (
    <div className="h-full overflow-auto">
      <div className="min-h-full p-3 space-y-3">
        {/* PAGE HEADER */}
        <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1fr_1.1fr_1.1fr] gap-2 items-stretch">
          <div className="panel px-4 py-3 col-span-1">
            <div className="text-[9px] tracking-[0.24em] text-[var(--color-muted-foreground)]">
              PORT OPERATIONS COCKPIT FOR
            </div>
            <div className="text-[32px] leading-none tracking-[0.06em] text-[var(--color-foreground)] font-semibold">
              {portName}
            </div>
            <div className="text-[9px] tracking-[0.24em] text-[var(--color-muted-foreground)] mt-1">
              {chn.authority.toUpperCase()}
            </div>
          </div>
          <HdrField
            label="CURRENT PORT AUTHORITY"
            value={chn.authority}
            sub={`${chn.location.lat.toFixed(4)}° N, ${chn.location.lon.toFixed(4)}° E`}
          />
          <HdrField
            label="CURRENT REGIME"
            chip={<Chip tone={riskTone}>{severityLabel}</Chip>}
          />
          <HdrField
            label="FORECAST ORIGIN"
            value="07 MAY 2025"
            sub="03:00 UTC"
          />
          <HdrField
            label="MODEL CONFIDENCE"
            chip={<Chip tone="mint">HIGH</Chip>}
            sub={`${Math.round(chn.confidence * 100)}%`}
          />
          <HdrField label="SELECT PORT" value={`${portName} ▾`} />
          <HdrField
            label="LAST UPDATED"
            value="07 May 2025 06:15 UTC"
            chip={<Chip tone="mint">● LIVE</Chip>}
          />
        </div>

        {/* TOP KPI STRIP */}
        <div className="grid grid-cols-7 gap-2">
          <Kpi
            label="SEVERITY"
            big={severityLabel}
            tone={riskTone}
            sub="HIGH IMPACT"
          />
          <Kpi
            label={`${portName} PORT CONGESTION`}
            big={(chn.congestion * 100).toFixed(1)}
            tone={riskTone}
            sub="Index (0-100)"
            spark={[45, 50, 58, 64, 68, 72, 75, chn.congestion * 100]}
            sparkTone={riskTone}
          />
          <Kpi
            label="PEAK DELAY (P95)"
            big={`${chn.delayHours.toFixed(1)} h`}
            tone={riskTone}
            sub="(next 24h)"
            spark={[
              8,
              9,
              10,
              11,
              12,
              Math.max(12, chn.delayHours - 1),
              chn.delayHours,
            ]}
            sparkTone={riskTone}
          />
          <Kpi
            label="THROUGHPUT (27D)"
            big={chn.throughput.toLocaleString()}
            tone="cyan"
            sub="TEU proxy"
            spark={[
              chn.throughput * 0.86,
              chn.throughput * 0.9,
              chn.throughput * 0.93,
              chn.throughput,
            ]}
            sparkTone="cyan"
          />
          <Kpi
            label="TRANSITION RISK"
            big={`${Math.round(regime.transitionRisk24h * 100)}%`}
            tone="amber"
            sub="(12h Horizon)"
            spark={[42, 48, 54, 58, 60, 62, regime.transitionRisk24h * 100]}
            sparkTone="amber"
          />
          <Kpi
            label="CONFIDENCE"
            big={`${Math.round(chn.confidence * 100)}%`}
            tone="mint"
            sub="Model Confidence"
            spark={[85, 88, 90, 91, 92, 93, chn.confidence * 100]}
            sparkTone="mint"
          />
          <div className="panel px-3 py-2 flex flex-col justify-between">
            <div>
              <div className="label-xs">RECOMMENDATION ({portName})</div>
              <div className="mt-1 text-[11px] text-[var(--color-foreground)] leading-snug">
                <span className="text-[var(--color-amber)]">
                  {recommendation.title}.
                </span>{" "}
                {recommendation.actions.slice(0, 3).join(". ")}.
              </div>
            </div>
            <button className="mt-1 self-end text-[var(--color-cyan)] text-[16px]">
              ›
            </button>
          </div>
        </div>

        {/* AI OPERATIONAL BRIEFING STRIP */}
        <div className="panel px-3 py-2 flex items-center gap-4 text-[11px]">
          <span className="text-[var(--color-cyan)] flex items-center gap-2 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-cyan)] animate-blink" />
            AI OPERATIONAL BRIEFING
          </span>
          <span className="text-[var(--color-foreground)] flex-1">
            {chn.name} congestion is {severityLabel.toLowerCase()}. Peak
            congestion is expected in the next 48h with {weather.windKnots} kt
            wind and {weather.seaState.toLowerCase()} sea state affecting
            pilotage and cargo ops.
          </span>
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-mint)]">
            <span>● Activate congestion protocol</span>
            <span>● Prioritize berth allocation</span>
            <span>● Stagger arrivals</span>
            <span>● Advise vessels to slow steam</span>
          </div>
          <span className="text-[9px] text-[var(--color-muted-foreground)]">
            Generated by India PortWatch AI · {recommendation.timestamp}
          </span>
        </div>

        {/* MID GRID: twin | hsmm | weather */}
        <div
          className="grid grid-cols-[1.6fr_0.9fr_1.1fr] gap-2"
          style={{ minHeight: 380 }}
        >
          {/* DIGITAL TWIN */}
          <div className="panel flex flex-col">
            <div className="panel-header">
              <span>PORT DIGITAL TWIN — {portName} PORT</span>
              <span>UPDATED: {chn.updatedAt}</span>
            </div>
            <div className="relative flex-1 overflow-hidden">
              <img
                src={chennaiSat}
                alt="Chennai port satellite"
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  filter: "brightness(0.72) saturate(1.08) contrast(1.05)",
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.55) 100%)",
                }}
              />

              {/* Zone shading + labels + vessels */}
              <svg
                viewBox="0 0 800 500"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                <defs>
                  <linearGradient id="berthZone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="oklch(0.86 0.19 155 / 0.10)" />
                    <stop offset="1" stopColor="oklch(0.86 0.19 155 / 0.02)" />
                  </linearGradient>
                  <linearGradient id="anchorZone" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="oklch(0.82 0.18 75 / 0.09)" />
                    <stop offset="1" stopColor="oklch(0.82 0.18 75 / 0.02)" />
                  </linearGradient>
                  <radialGradient id="harborZone" cx="30%" cy="55%" r="45%">
                    <stop offset="0" stopColor="oklch(0.82 0.18 195 / 0.10)" />
                    <stop offset="100%" stopColor="oklch(0.82 0.18 195 / 0)" />
                  </radialGradient>
                  <filter
                    id="vShip"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="0.5"
                      stdDeviation="0.5"
                      floodColor="#000"
                      floodOpacity="0.65"
                    />
                  </filter>
                </defs>

                {/* Zone regions */}
                <path
                  d="M 40 140 Q 250 130 320 200 L 320 420 Q 200 440 40 420 Z"
                  fill="url(#harborZone)"
                  stroke="oklch(0.82 0.18 195 / 0.35)"
                  strokeWidth="0.8"
                  strokeDasharray="3 4"
                />
                <path
                  d="M 200 160 L 340 160 L 340 400 L 200 400 Z"
                  fill="url(#berthZone)"
                  stroke="oklch(0.86 0.19 155 / 0.4)"
                  strokeWidth="0.6"
                  strokeDasharray="2 3"
                />
                <path
                  d="M 380 100 Q 620 130 780 220 L 780 460 Q 600 470 380 460 Z"
                  fill="url(#anchorZone)"
                  stroke="oklch(0.82 0.18 75 / 0.35)"
                  strokeWidth="0.6"
                  strokeDasharray="2 4"
                />

                {/* Zone captions */}
                <text
                  x="60"
                  y="128"
                  fontSize="8"
                  letterSpacing="2"
                  fill="oklch(0.82 0.18 195)"
                  opacity="0.85"
                  className="label-halo"
                >
                  ◆ INNER HARBOUR
                </text>
                <text
                  x="216"
                  y="152"
                  fontSize="8"
                  letterSpacing="2"
                  fill="oklch(0.86 0.19 155)"
                  opacity="0.9"
                  className="label-halo"
                >
                  ◆ BERTH AREA
                </text>
                <text
                  x="560"
                  y="94"
                  fontSize="8"
                  letterSpacing="2"
                  fill="oklch(0.82 0.18 75)"
                  opacity="0.9"
                  className="label-halo"
                >
                  ◆ OUTER ANCHORAGE
                </text>

                {/* Berth region sub-labels */}
                {[
                  ["KASIMEDU HARBOUR", 90, 40],
                  ["KASIRAJPURAM", 210, 30],
                  ["ENNORE", 480, 30],
                  ["PORT TRUST", 90, 90],
                  ["BHARATI DOCK", 130, 180],
                  ["NORTH HARBOUR", 100, 240],
                  ["CENTRAL BASIN", 180, 300],
                  ["OIL JETTY", 220, 380],
                  ["SOUTH HARBOUR", 130, 420],
                  ["KAMARAJAR PORT LTD (KPL)", 210, 470],
                ].map(([t, x, y]) => (
                  <text
                    key={t as string}
                    x={x as number}
                    y={y as number}
                    fontSize="8"
                    fill="oklch(0.82 0.18 195)"
                    opacity="0.55"
                    letterSpacing="1.2"
                    className="label-halo"
                  >
                    {t}
                  </text>
                ))}

                {/* Berth quay line */}
                <line
                  x1="205"
                  y1="170"
                  x2="205"
                  y2="395"
                  stroke="oklch(0.86 0.19 155 / 0.6)"
                  strokeWidth="0.8"
                />

                {/* Vessels at berth — ship silhouettes with wake */}
                {Array.from({ length: 22 }).map((_, i) => {
                  const x = 216 + i * 5.5;
                  const y = 180 + Math.sin(i * 0.9) * 4 + (i % 3) * 22;
                  const c =
                    i % 5 === 0
                      ? "#ff5566"
                      : i % 3 === 0
                        ? "#ffb347"
                        : i % 4 === 0
                          ? "#c58cff"
                          : "#7ef0b4";
                  const r = 90 + ((i * 37) % 20) - 10;
                  return (
                    <g
                      key={"b" + i}
                      transform={`translate(${x} ${y}) rotate(${r})`}
                      style={{
                        animation: `vessel-drift ${4 + (i % 4)}s ease-in-out infinite`,
                      }}
                    >
                      <path
                        d="M 0 -7 L 4.4 4.5 L 1.2 7 L 0 5.2 L -1.2 7 L -4.4 4.5 Z"
                        fill={c}
                        opacity="0.98"
                        stroke="#000"
                        strokeWidth="0.45"
                        filter="url(#vShip)"
                      />
                      <rect
                        x="-1.4"
                        y="-1.2"
                        width="2.8"
                        height="3.3"
                        fill="#0a1420"
                        opacity="0.72"
                      />
                    </g>
                  );
                })}
                {/* Anchored vessels — smaller ships in outer roads */}
                {Array.from({ length: 26 }).map((_, i) => {
                  const angle = (i / 26) * Math.PI * 1.1 - 0.4;
                  const r = 200 + (i % 4) * 26;
                  const x = 500 + Math.cos(angle) * r;
                  const y = 260 + Math.sin(angle) * r * 0.55;
                  const c = i % 6 === 0 ? "#ffb347" : "#7dd3fc";
                  const rot = (i * 47) % 360;
                  return (
                    <g
                      key={"a" + i}
                      transform={`translate(${x} ${y}) rotate(${rot})`}
                      style={{
                        animation: `vessel-drift ${5 + (i % 5)}s ease-in-out infinite`,
                      }}
                    >
                      <line
                        x1="-14"
                        y1="0"
                        x2="-6"
                        y2="0"
                        stroke={c}
                        strokeWidth="0.4"
                        strokeDasharray="1.4 2"
                        opacity="0.5"
                      />
                      <path
                        d="M 0 -6 L 3.8 4 L 0 6 L -3.8 4 Z"
                        fill={c}
                        opacity="0.94"
                        stroke="#000"
                        strokeWidth="0.38"
                        filter="url(#vShip)"
                      />
                    </g>
                  );
                })}
                {/* Approach lanes with glow */}
                <path
                  d="M 800 220 Q 600 260 380 300"
                  stroke="oklch(0.82 0.18 195)"
                  strokeWidth="2.2"
                  opacity="0.08"
                  fill="none"
                />
                <path
                  d="M 800 220 Q 600 260 380 300"
                  stroke="oklch(0.82 0.18 195 / 0.85)"
                  strokeWidth="0.9"
                  strokeDasharray="3 7"
                  fill="none"
                  style={{ animation: "dash-flow 3s linear infinite" }}
                />
                <path
                  d="M 800 380 Q 620 380 440 400"
                  stroke="oklch(0.82 0.18 75)"
                  strokeWidth="2.1"
                  opacity="0.07"
                  fill="none"
                />
                <path
                  d="M 800 380 Q 620 380 440 400"
                  stroke="oklch(0.82 0.18 75 / 0.8)"
                  strokeWidth="0.9"
                  strokeDasharray="3 7"
                  fill="none"
                  style={{ animation: "dash-flow 4s linear infinite" }}
                />
                <path
                  d="M 780 140 Q 620 190 440 240"
                  stroke="oklch(0.82 0.18 195 / 0.5)"
                  strokeWidth="0.9"
                  strokeDasharray="2 5"
                  fill="none"
                />
              </svg>

              {/* Legend */}
              <div className="absolute bottom-2 left-2 right-2 px-2 py-1 border border-[var(--color-cyan)]/25 bg-[oklch(0.10_0.02_240_/_0.82)] backdrop-blur flex items-center gap-3 text-[9px] tracking-widest">
                <LegendPill c="#7ef0b4" t="At Berth" />
                <LegendPill c="#ffb347" t="Anchored" />
                <LegendPill c="#7dd3fc" t="En Route" />
                <LegendPill c="#c58cff" t="Drifting" />
                <LegendPill c="#ff5566" t="Restricted" />
                <span className="ml-auto flex items-center gap-3">
                  <span className="text-[var(--color-muted-foreground)]">
                    -·- Tug/Service
                  </span>
                  <span className="text-[var(--color-muted-foreground)]">
                    ---- Approach Lane
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Anchorage + Berth Occupancy */}
          <div className="panel flex flex-col">
            <div className="panel-header">
              <span>ANCHORAGE QUEUES</span>
            </div>
            <div className="p-3 space-y-2 text-[11px]">
              {[
                ["Outer Anchorage (E)", 25, "#7ef0b4"],
                ["Outer Anchorage (W)", 17, "#ffb347"],
                ["Northern Roads", 10, "#7dd3fc"],
                ["Southern Roads", 10, "#c58cff"],
              ].map(([l, n, c]) => (
                <div
                  key={l as string}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-[var(--color-foreground)]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: c as string }}
                    />
                    {l}
                  </span>
                  <span className="tabular-nums text-[var(--color-muted-foreground)]">
                    {n} vessels
                  </span>
                </div>
              ))}
            </div>
            <div className="panel-header border-t border-[var(--color-line)]">
              <span>BERTH OCCUPANCY</span>
            </div>
            <div className="p-2 space-y-1 text-[10px]">
              {berthOcc.map(([b, v, tone]) => (
                <div
                  key={b}
                  className="grid grid-cols-[24px_1fr_36px] items-center gap-2"
                >
                  <span className="text-[var(--color-cyan)]">{b}</span>
                  <div className="h-1.5 bg-[var(--color-panel-2)] overflow-hidden rounded-sm">
                    <div
                      className="h-full"
                      style={{
                        width: `${v}%`,
                        background:
                          tone === "red"
                            ? "var(--color-red)"
                            : tone === "amber"
                              ? "var(--color-amber)"
                              : "var(--color-mint)",
                      }}
                    />
                  </div>
                  <span className="tabular-nums text-right text-[var(--color-foreground)]">
                    {v}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* HSMM + weather column */}
          <div className="grid grid-rows-2 gap-2">
            <div className="panel">
              <div className="panel-header">
                <span>HSMM REGIME INTELLIGENCE ({portName})</span>
              </div>
              <div className="p-3 space-y-2 text-[11px]">
                {[
                  ["Normal", regime.probabilities.normal * 100, "mint"],
                  ["Congested", regime.probabilities.congested * 100, "amber"],
                  ["Severe", regime.probabilities.severe * 100, "red"],
                ].map(([l, v, t]) => (
                  <div key={l as string}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[var(--color-foreground)]">
                        {l}
                      </span>
                      <span
                        className={
                          t === "red"
                            ? "text-[var(--color-red)]"
                            : t === "amber"
                              ? "text-[var(--color-amber)]"
                              : "text-[var(--color-mint)]"
                        }
                      >
                        {Math.round(v as number)}%
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--color-panel-2)]">
                      <div
                        className="h-full"
                        style={{
                          width: `${v}%`,
                          background:
                            t === "red"
                              ? "var(--color-red)"
                              : t === "amber"
                                ? "var(--color-amber)"
                                : "var(--color-mint)",
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-[var(--color-line)] space-y-1 text-[10px]">
                  <Row k="Days in State" v={regime.daysInState.toFixed(1)} />
                  <Row
                    k="Expected remaining"
                    v={`${regime.expectedRemainingDays.toFixed(1)} day`}
                  />
                  <Row
                    k="Transition risk (24h)"
                    v={
                      <>
                        <span className="text-[var(--color-foreground)]">
                          {Math.round(regime.transitionRisk24h * 100)}%
                        </span>{" "}
                        <Chip
                          tone={
                            regime.transitionRisk24h > 0.55 ? "red" : "amber"
                          }
                        >
                          HIGH
                        </Chip>
                      </>
                    }
                  />
                  <Row
                    k="State confidence"
                    v={
                      <>
                        <span className="text-[var(--color-foreground)]">
                          {Math.round(regime.confidence * 100)}%
                        </span>{" "}
                        <Chip tone="red">HIGH</Chip>
                      </>
                    }
                  />
                </div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">
                <span>WEATHER INTELLIGENCE · {portName} COASTAL OUTLOOK</span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-x-3 gap-y-2 text-[10px]">
                <WxCell
                  l="WIND (10m)"
                  v={`${weather.windKnots} kt`}
                  sub={weather.windDirection}
                />
                <WxCell l="GUSTS" v={`${weather.gustKnots} kt`} />
                <WxCell l="RAINFALL (24h)" v={`${weather.rainfallMm24h} mm`} />
                <WxCell
                  l="WAVE HEIGHT"
                  v={`${weather.waveHeightM} m`}
                  sub="S"
                />
                <WxCell l="SEA STATE" v={weather.seaState} />
                <WxCell
                  l="VISIBILITY"
                  v={`${weather.visibilityKm} km`}
                  sub="Good"
                  tone="mint"
                />
                <div className="col-span-3 mt-1 border-t border-[var(--color-line)] pt-2">
                  <div className="label-xs mb-1">MONSOON OUTLOOK</div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <div className="text-[var(--color-muted-foreground)]">
                        SW Monsoon
                      </div>
                      <div className="text-[var(--color-mint)]">Active</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-muted-foreground)]">
                        Cyclone Risk (7D)
                      </div>
                      <div className="text-[var(--color-mint)]">Low</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-muted-foreground)]">
                        Next Tide
                      </div>
                      <div className="text-[var(--color-foreground)]">
                        07:42
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-3 mt-1 border-t border-[var(--color-line)] pt-2">
                  <div className="label-xs mb-1">WEATHER MODULE OUTPUTS</div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <WxOut
                      k="weather_raw_score"
                      v={weather.impactScore.toFixed(2)}
                    />
                    <WxOut
                      k="weather_impact_score"
                      v={weather.impactScore.toFixed(2)}
                    />
                    <WxOut
                      k="weather_persistence"
                      v="SW_MONSOON_ACTIVE"
                      tone="mint"
                    />
                    <WxOut
                      k="weather_shock"
                      v={weather.shockSigma.toFixed(2)}
                    />
                    <WxOut
                      k="weather_hsmm_input"
                      v={weather.impactScore.toFixed(2)}
                      tone="red"
                    />
                    <WxOut
                      k="weather_tft_covariate"
                      v={weather.persistenceScore.toFixed(2)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 10-DAY FORECAST TIMELINE */}
        <div className="panel">
          <div className="panel-header">
            <span>10-DAY FORECAST TIMELINE · {portName} PORT</span>
          </div>
          <div className="p-2 grid grid-cols-10 gap-1.5">
            {forecastDays.map((d, i) => {
              const tone =
                d.severity === "SEVERE"
                  ? "red"
                  : d.severity === "HIGH"
                    ? "amber"
                    : d.severity === "MOD"
                      ? "cyan"
                      : "mint";
              const bg =
                tone === "red"
                  ? "var(--color-red)"
                  : tone === "amber"
                    ? "var(--color-amber)"
                    : tone === "cyan"
                      ? "var(--color-cyan)"
                      : "var(--color-mint)";
              return (
                <div
                  key={i}
                  className="panel p-2 flex flex-col gap-1"
                  style={{ animation: `fade-in .5s ease-out ${i * 60}ms both` }}
                >
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-[var(--color-muted-foreground)]">
                      DAY {d.day} · {d.dateLabel}
                    </span>
                    <span
                      className="px-1 border"
                      style={{ borderColor: bg, color: bg }}
                    >
                      {d.severity}
                    </span>
                  </div>
                  <div className="text-[16px] tabular-nums text-[var(--color-foreground)] leading-none">
                    {d.congestionIndex}
                  </div>
                  <div className="text-[9px] text-[var(--color-muted-foreground)]">
                    (±{d.uncertaintyBandHours}h)
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-[var(--color-cyan)]">☁</span>
                    {d.weatherProbability > 0 && (
                      <span className="text-[var(--color-red)] tabular-nums">
                        {Math.round(d.weatherProbability * 100)}%
                      </span>
                    )}
                  </div>
                  <div
                    className="h-0.5"
                    style={{ background: bg, opacity: 0.7 }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM: DRIVERS · EXPERT CHAIN · NEWS */}
        <div className="grid grid-cols-3 gap-2">
          <div className="panel">
            <div className="panel-header">
              <span>KEY FORECAST DRIVERS · {portName}</span>
              <span>IMPACT</span>
            </div>
            <div className="p-2 space-y-1.5 text-[11px]">
              {[
                ["1", "Wind Speed (WNW 20–30 kt)", "+28%", "HIGH", "red"],
                ["2", "SW Monsoon Onset (Active)", "+25%", "HIGH", "red"],
                ["3", "Sea State (Moderate)", "+16%", "HIGH", "amber"],
                ["4", "Labor Availability Risk", "+11%", "MED", "amber"],
                [
                  "5",
                  "Dredging Operations (Entry Channel)",
                  "-7%",
                  "LOW",
                  "mint",
                ],
                ["6", "Export Demand (Auto Components)", "+6%", "MED", "amber"],
              ].map(([n, label, delta, sev, tone]) => (
                <div
                  key={n}
                  className="grid grid-cols-[16px_1fr_50px_54px] items-center gap-2"
                >
                  <span className="text-[var(--color-cyan)] tabular-nums">
                    {n}
                  </span>
                  <span className="text-[var(--color-foreground)]">
                    {label}
                  </span>
                  <span className="text-right tabular-nums text-[var(--color-foreground)]">
                    {delta}
                  </span>
                  <Chip tone={tone as any}>{sev}</Chip>
                </div>
              ))}
              <div className="text-[9px] text-[var(--color-muted-foreground)] pt-1 border-t border-[var(--color-line)]/60">
                ⓘ Impact shown is relative contribution to congestion index
                (next 24h).
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>MODEL OUTPUTS · EXPERT CHAIN ({portName})</span>
              <span>Confidence</span>
            </div>
            <div className="p-2 space-y-1.5 text-[11px]">
              {experts.map((expert) => (
                <div
                  key={expert.key}
                  className="grid grid-cols-[18px_140px_1fr_36px] gap-2 items-center"
                >
                  <span className="text-[var(--color-cyan)]">◎</span>
                  <span className="text-[var(--color-foreground)]">
                    {expert.name}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">
                    {expert.effectOnForecast}
                  </span>
                  <span
                    className={
                      "text-right tabular-nums " +
                      (expert.score > 0.7
                        ? "text-[var(--color-red)]"
                        : expert.score > 0.55
                          ? "text-[var(--color-amber)]"
                          : "text-[var(--color-cyan)]")
                    }
                  >
                    {expert.confidence.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="text-[9px] text-[var(--color-muted-foreground)] pt-1 border-t border-[var(--color-line)]/60">
                ⓘ Expert chain output drives HSMM regime and TFT forecast.
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>NEWS INTELLIGENCE · THIS PORT ({portName})</span>
              <span>Impact · Confidence</span>
            </div>
            <div className="p-2 space-y-2 text-[11px]">
              {(newsForPort.length ? newsForPort : listNewsEvents())
                .slice(0, 4)
                .map((event, i) => (
                  <div
                    key={event.id}
                    className="grid grid-cols-[14px_1fr_54px_44px] gap-2"
                  >
                    <span className="text-[var(--color-cyan)] tabular-nums">
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--color-foreground)] font-medium">
                          {event.tag}
                        </span>
                        <Chip
                          tone={
                            event.severity === "severe"
                              ? "red"
                              : event.severity === "normal"
                                ? "mint"
                                : "amber"
                          }
                        >
                          {event.severity}
                        </Chip>
                      </div>
                      <div className="text-[10px] text-[var(--color-foreground)]">
                        {event.text}
                      </div>
                      <div className="text-[9px] text-[var(--color-muted-foreground)]">
                        {event.source} · {event.timestamp}Z
                      </div>
                    </div>
                    <span className="text-right text-[10px] text-[var(--color-foreground)] self-start">
                      {event.sentiment < -0.2 ? "High" : "Medium"}
                    </span>
                    <span className="text-right tabular-nums text-[10px] text-[var(--color-cyan)] self-start">
                      {event.confidence.toFixed(2)}
                    </span>
                  </div>
                ))}
              <div className="text-[9px] text-[var(--color-muted-foreground)] pt-1 border-t border-[var(--color-line)]/60">
                ⓘ News & events intelligence integrated into expert chain.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HdrField({
  label,
  value,
  sub,
  chip,
}: {
  label: string;
  value?: string;
  sub?: string;
  chip?: React.ReactNode;
}) {
  return (
    <div className="panel px-3 py-2 flex flex-col justify-center min-h-[68px]">
      <div className="text-[9px] tracking-[0.2em] text-[var(--color-muted-foreground)]">
        {label}
      </div>
      {chip ? (
        <div className="mt-1">{chip}</div>
      ) : (
        value && (
          <div className="text-[12px] text-[var(--color-foreground)] mt-0.5">
            {value}
          </div>
        )
      )}
      {sub && (
        <div className="text-[9px] text-[var(--color-muted-foreground)] mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  big,
  tone,
  sub,
  spark,
  sparkTone,
}: {
  label: string;
  big: string;
  tone: "red" | "amber" | "cyan" | "mint";
  sub?: string;
  spark?: number[];
  sparkTone?: "red" | "amber" | "cyan" | "mint";
}) {
  const c =
    tone === "red"
      ? "text-[var(--color-red)] glow-red"
      : tone === "amber"
        ? "text-[var(--color-amber)] glow-amber"
        : tone === "cyan"
          ? "text-[var(--color-cyan)]"
          : "text-[var(--color-mint)]";
  const accent =
    tone === "red"
      ? "var(--color-red)"
      : tone === "amber"
        ? "var(--color-amber)"
        : tone === "cyan"
          ? "var(--color-cyan)"
          : "var(--color-mint)";
  return (
    <div className="panel relative px-3 py-2.5 flex flex-col gap-1.5 overflow-hidden">
      <span
        className="absolute left-0 top-0 bottom-0 w-[2px]"
        style={{
          background: `linear-gradient(180deg, ${accent}, transparent)`,
          opacity: 0.8,
        }}
      />
      <div className="label-xs">{label}</div>
      <div
        className={`text-[22px] leading-none tabular-nums font-semibold ${c}`}
      >
        {big}
      </div>
      {sub && (
        <div className="text-[9px] text-[var(--color-muted-foreground)]">
          {sub}
        </div>
      )}
      {spark && (
        <div className="-mx-1">
          <Sparkline data={spark} tone={sparkTone || "cyan"} height={20} />
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-line)]/50 pb-1">
      <span className="text-[var(--color-muted-foreground)]">{k}</span>
      <span className="flex items-center gap-1">{v}</span>
    </div>
  );
}

function WxCell({
  l,
  v,
  sub,
  tone,
}: {
  l: string;
  v: string;
  sub?: string;
  tone?: "mint" | "amber" | "red" | "cyan";
}) {
  const c =
    tone === "mint"
      ? "text-[var(--color-mint)]"
      : tone === "amber"
        ? "text-[var(--color-amber)]"
        : tone === "red"
          ? "text-[var(--color-red)]"
          : "text-[var(--color-foreground)]";
  return (
    <div>
      <div className="text-[9px] tracking-widest text-[var(--color-muted-foreground)]">
        {l}
      </div>
      <div className={`text-[14px] tabular-nums ${c}`}>{v}</div>
      {sub && (
        <div className="text-[9px] text-[var(--color-muted-foreground)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function WxOut({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "mint" | "red";
}) {
  const c =
    tone === "mint"
      ? "text-[var(--color-mint)]"
      : tone === "red"
        ? "text-[var(--color-red)]"
        : "text-[var(--color-foreground)]";
  return (
    <div>
      <div className="text-[9px] text-[var(--color-muted-foreground)]">{k}</div>
      <div className={`text-[11px] tabular-nums ${c}`}>{v}</div>
    </div>
  );
}

function LegendPill({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1 text-[var(--color-muted-foreground)]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: c, boxShadow: `0 0 4px ${c}` }}
      />
      {t}
    </span>
  );
}
