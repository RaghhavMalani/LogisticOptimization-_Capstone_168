import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Panel, Metric, Chip, Bar, Sparkline } from "@/components/terminal/ui";
import { getPortSnapshot } from "@/services/portService";
import { fetchPortSnapshot } from "@/services/ports";
import { getWeatherSignal } from "@/services/weatherService";
import { fetchWeatherSignal } from "@/services/weather";

export const Route = createFileRoute("/wx")({
  validateSearch: (search: Record<string, unknown>) => ({
    port: typeof search.port === "string" ? search.port : "INMAA",
  }),
  component: WxPage,
});

function WxPage() {
  const { port: portQuery } = Route.useSearch();
  const portDataQuery = useQuery({
    queryKey: ["port", portQuery],
    queryFn: () => fetchPortSnapshot(portQuery),
    initialData: () => getPortSnapshot(portQuery),
    staleTime: 30_000,
  });
  const port = portDataQuery.data;
  const weatherQuery = useQuery({
    queryKey: ["weather", port.code],
    queryFn: () => fetchWeatherSignal(port.code),
    initialData: () => getWeatherSignal(port.code),
    staleTime: 30_000,
  });
  const weather = weatherQuery.data;

  return (
    <div className="h-full grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-2">
      <div className="grid grid-cols-7 gap-2">
        <Metric
          label="WIND"
          value={weather.windKnots}
          unit={`kt ${weather.windDirection}`}
          tone="amber"
          sub={`gust ${weather.gustKnots} kt`}
        />
        <Metric
          label="WAVE HT"
          value={weather.waveHeightM}
          unit="m"
          tone="amber"
          sub={weather.seaState}
        />
        <Metric
          label="PRECIP RATE"
          value={weather.precipRateMmH}
          unit="mm/h"
          tone="cyan"
          sub={`24h acc ${weather.rainfallMm24h}mm`}
        />
        <Metric
          label="VISIBILITY"
          value={weather.visibilityKm}
          unit="km"
          tone="mint"
          sub={port.name}
        />
        <Metric
          label="CYC/STORM RISK"
          value={Math.round(weather.cycloneRisk7d * 100)}
          unit="%"
          tone="amber"
          sub="T+72h"
        />
        <Metric
          label="WX IMPACT"
          value={weather.impactScore.toFixed(2)}
          tone="red"
          sub="port ops"
        />
        <Metric
          label="WX PERSISTENCE"
          value={weather.persistenceScore.toFixed(2)}
          tone="amber"
          sub="regime 18h"
        />
      </div>

      <div className="min-h-0 grid grid-cols-[1.4fr_1fr] grid-rows-2 gap-2">
        <Panel title="WIND FIELD · MSL · +12H" className="row-span-2">
          <MarineWeatherMap weather={weather} portName={port.name} />
        </Panel>

        <Panel title="PRECIPITATION · 24H ACC">
          <div className="p-3">
            <div className="grid grid-cols-12 gap-[2px]">
              {Array.from({ length: 96 }).map((_, i) => {
                const v = Math.abs(Math.sin(i * 0.3) + Math.cos(i * 0.18)) / 2;
                return (
                  <div
                    key={i}
                    className="h-4"
                    style={{ background: `oklch(0.82 0.18 195 / ${v})` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-[var(--color-muted-foreground)] tabular-nums">
              <span>0 mm</span>
              <span>25 mm</span>
              <span>50 mm</span>
              <span>100+</span>
            </div>
            <div className="mt-3 label-xs">6H FORECAST</div>
            <Sparkline
              data={[4, 6, 9, 12, 14, 17, 20, 18, 14, 10, 7, 5]}
              tone="cyan"
              height={36}
            />
          </div>
        </Panel>

        <Panel title="WAVE HEIGHT + VIS">
          <div className="p-3 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <div className="label-xs mb-1">SIG WAVE HEIGHT (m)</div>
              <Sparkline
                data={[1.4, 1.6, 1.9, 2.2, 2.5, 2.8, 2.6, 2.4, 2.1, 1.9]}
                tone="amber"
                height={44}
              />
            </div>
            <div>
              <div className="label-xs mb-1">VISIBILITY (km)</div>
              <Sparkline
                data={[10, 9.6, 9, 8.5, 8.2, 8, 8.4, 9, 9.4, 10]}
                tone="mint"
                height={44}
              />
            </div>
            <div className="col-span-2">
              <div className="label-xs mb-1">SWELL DIRECTION · ROSE</div>
              <svg viewBox="0 0 200 90" className="w-full h-24">
                {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((d, i) => {
                  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
                  const len = [10, 14, 20, 32, 40, 52, 30, 18][i];
                  return (
                    <g key={d}>
                      <line
                        x1="100"
                        y1="45"
                        x2={100 + Math.cos(a) * len}
                        y2={45 + Math.sin(a) * len}
                        stroke="var(--color-amber)"
                        strokeWidth="4"
                        opacity="0.75"
                      />
                      <text
                        x={100 + Math.cos(a) * 60}
                        y={45 + Math.sin(a) * 60 + 3}
                        fontSize="8"
                        fill="var(--color-muted-foreground)"
                        textAnchor="middle"
                      >
                        {d}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Panel title="WEATHER SHOCK · MODEL INPUTS">
          <div className="p-3 space-y-2 text-[11px]">
            <Row k="weather_hsmm_input" v="0.71" tone="red" />
            <Row
              k="weather_tft_covariate"
              v="[0.44,0.62,0.71,0.68]"
              tone="amber"
            />
            <Row k="weather_shock" v="+0.31 σ" tone="red" />
            <Row k="weather_persistence" v="0.62" tone="amber" />
            <Row k="regime_prior" v="CONG_HIGH · 0.55" tone="amber" />
          </div>
        </Panel>
        <Panel title="OPERATIONAL MEANING">
          <div className="p-3 text-[11px] leading-relaxed">
            Wind + swell combination reduces safe pilotage window at
            Chennai/Ennore to{" "}
            <span className="text-[var(--color-amber)]">22:00–04:00Z</span>.
            Berthing throughput expected to drop{" "}
            <span className="text-[var(--color-red)]">−18%</span> for 48h.
            Recommend staging inbound VLCC arrivals and holding container calls
            beyond T+60h.
          </div>
        </Panel>
        <Panel title="ADVISORIES">
          <div className="p-3 space-y-1.5 text-[11px]">
            <Advisory
              sev="red"
              t="IMD"
              text="Cyclogenesis prob 34% · centre 12.4N/88.1E · T+72h landfall Kakinada corridor"
            />
            <Advisory
              sev="amber"
              t="INCOIS"
              text="Storm surge 1.6–2.2m expected north Andhra coast"
            />
            <Advisory
              sev="amber"
              t="DGS"
              text="Small craft advisory Bay of Bengal 06:00–24:00Z"
            />
            <Advisory
              sev="mint"
              t="Mumbai MET"
              text="West coast improving; monsoon trough receding"
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MarineWeatherMap({
  weather,
  portName,
}: {
  weather: ReturnType<typeof getWeatherSignal>;
  portName: string;
}) {
  const streamlines = [
    "M 20 360 C 130 300 230 275 360 252 S 510 210 620 145",
    "M 0 285 C 120 236 260 222 390 194 S 530 154 640 96",
    "M 50 430 C 180 366 284 334 430 326 S 560 278 640 230",
    "M 145 470 C 244 388 320 354 444 356 S 552 330 640 310",
    "M 284 450 C 344 372 376 292 420 204 S 494 90 590 30",
  ];
  const cycloneTrack = [
    [448, 302],
    [432, 274],
    [414, 248],
    [392, 224],
    [364, 204],
  ];

  return (
    <div className="relative w-full h-full bg-[oklch(0.08_0.03_240)] overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 63% 45%, oklch(0.82 0.18 195 / 0.18), transparent 34%), radial-gradient(circle at 70% 58%, oklch(0.68 0.24 25 / 0.20), transparent 24%), linear-gradient(135deg, oklch(0.06 0.02 240), oklch(0.16 0.05 230))",
        }}
      />
      <svg
        viewBox="0 0 640 500"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <filter id="wxBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="13" />
          </filter>
          <radialGradient id="rainCore" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ff5566" stopOpacity="0.72" />
            <stop offset="32%" stopColor="#ffb347" stopOpacity="0.58" />
            <stop offset="62%" stopColor="#7ef0b4" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#45b9ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rainSoft" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#7ef0b4" stopOpacity="0.42" />
            <stop offset="60%" stopColor="#45b9ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#45b9ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          d="M 278 52 C 318 88 340 120 352 166 C 366 222 348 258 360 300 C 376 354 408 402 420 500 L 640 500 L 640 0 L 410 0 C 382 30 336 42 278 52 Z"
          fill="oklch(0.22 0.035 215 / 0.82)"
          stroke="oklch(0.72 0.14 195 / 0.54)"
          strokeWidth="1.2"
        />
        <path
          d="M 302 78 C 334 118 340 150 334 196 C 326 250 338 282 370 316"
          fill="none"
          stroke="oklch(0.82 0.18 195 / 0.42)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        <g filter="url(#wxBlur)" className="animate-halo">
          <ellipse cx="438" cy="282" rx="138" ry="92" fill="url(#rainCore)" />
          <ellipse cx="358" cy="222" rx="112" ry="58" fill="url(#rainSoft)" />
          <ellipse cx="248" cy="352" rx="118" ry="48" fill="url(#rainSoft)" />
          <ellipse
            cx="492"
            cy="164"
            rx="98"
            ry="52"
            fill="#45b9ff"
            opacity="0.20"
          />
        </g>

        {streamlines.map((d, index) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke={index % 2 === 0 ? "#9ff7ff" : "#7dd3fc"}
            strokeWidth={index % 2 === 0 ? "1.3" : "0.85"}
            strokeDasharray="2 11"
            opacity="0.65"
            className="pw-wind-streamline"
          />
        ))}

        <g transform="translate(438 282)" className="animate-sweep">
          <path
            d="M 0 -44 C 44 -34 58 -4 35 20 C 15 42 -22 30 -22 4 C -22 -18 10 -20 18 -4"
            fill="none"
            stroke="#ffb347"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 0 44 C -44 34 -58 4 -35 -20 C -15 -42 22 -30 22 -4 C 22 18 -10 20 -18 4"
            fill="none"
            stroke="#ff5566"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle r="4" fill="#ff5566" />
        </g>
        <polyline
          points={cycloneTrack.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#ffb347"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {cycloneTrack.map(([x, y], index) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={index === 0 ? 4 : 2.5}
            fill={index === 0 ? "#ff5566" : "#ffb347"}
            opacity={1 - index * 0.12}
          />
        ))}

        <g transform="translate(318 286)">
          <circle r="5" fill="#7dd3fc" />
          <circle
            r="22"
            fill="none"
            stroke="#7dd3fc"
            strokeDasharray="3 4"
            opacity="0.65"
          />
          <text
            x="14"
            y="-8"
            fontSize="9"
            fill="#edf7ff"
            className="label-halo"
          >
            {portName.toUpperCase()}
          </text>
          <text x="14" y="5" fontSize="8" fill="#7dd3fc" className="label-halo">
            IMPACT {weather.impactScore.toFixed(2)}
          </text>
        </g>
      </svg>

      <div className="absolute top-2 left-2 border border-[var(--color-cyan)]/35 bg-[oklch(0.08_0.02_240_/_0.72)] px-2 py-1 text-[9px] tracking-widest text-[var(--color-cyan)]">
        BAY OF BENGAL · MARINE WX RADAR · +12H
      </div>
      <div className="absolute top-2 right-2 grid grid-cols-2 gap-x-3 gap-y-1 border border-[var(--color-line)] bg-[oklch(0.08_0.02_240_/_0.72)] px-2 py-1 text-[9px]">
        <span className="text-[var(--color-muted-foreground)]">WIND</span>
        <span className="text-[var(--color-amber)] tabular-nums">
          {weather.windKnots} kt
        </span>
        <span className="text-[var(--color-muted-foreground)]">RAIN</span>
        <span className="text-[var(--color-cyan)] tabular-nums">
          {weather.rainfallMm24h} mm
        </span>
        <span className="text-[var(--color-muted-foreground)]">CYCLONE</span>
        <span className="text-[var(--color-red)] tabular-nums">
          {Math.round(weather.cycloneRisk7d * 100)}%
        </span>
      </div>
      <div className="absolute bottom-2 right-2 w-[170px] border border-[var(--color-line)] bg-[oklch(0.08_0.02_240_/_0.78)] p-2">
        <div className="label-xs mb-1">DIAGNOSTIC WIND BARBS</div>
        <svg viewBox="0 0 160 58" className="w-full h-[58px]">
          {Array.from({ length: 24 }).map((_, i) => {
            const x = 10 + (i % 8) * 19;
            const y = 12 + Math.floor(i / 8) * 18;
            const dir = (i * 31) % 360;
            return (
              <g
                key={i}
                transform={`translate(${x} ${y}) rotate(${dir})`}
                stroke="#7dd3fc"
                strokeWidth="0.7"
                opacity="0.72"
              >
                <line x1="-6" y1="0" x2="6" y2="0" />
                <polyline points="3,-2 6,0 3,2" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone: "cyan" | "amber" | "red" | "mint";
}) {
  const map: Record<string, string> = {
    cyan: "var(--color-cyan)",
    amber: "var(--color-amber)",
    red: "var(--color-red)",
    mint: "var(--color-mint)",
  };
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-line)]/60 pb-1">
      <span className="text-[var(--color-muted-foreground)] text-[10px] tracking-widest">
        {k}
      </span>
      <span className="tabular-nums" style={{ color: map[tone] }}>
        {v}
      </span>
    </div>
  );
}
function Advisory({
  sev,
  t,
  text,
}: {
  sev: "red" | "amber" | "mint";
  t: string;
  text: string;
}) {
  const border =
    sev === "red"
      ? "var(--color-red)"
      : sev === "amber"
        ? "var(--color-amber)"
        : "var(--color-mint)";
  return (
    <div className="border-l-2 pl-2" style={{ borderColor: border }}>
      <div className="flex items-center gap-1 text-[9px] tracking-widest text-[var(--color-muted-foreground)]">
        <Chip tone={sev}>{sev.toUpperCase()}</Chip>
        <span>{t}</span>
      </div>
      <div className="text-[var(--color-foreground)] text-[10px]">{text}</div>
    </div>
  );
}
