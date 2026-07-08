import L from "leaflet";
import { CircleMarker, LayerGroup, Marker, Polygon, Polyline, Tooltip } from "react-leaflet";
import { marineWeatherIntelligence } from "@/data/weather";

function cycloneIcon() {
  const cyclone = marineWeatherIntelligence.cyclone;
  return L.divIcon({
    className: "pw-cyclone-icon",
    iconSize: [430, 430],
    iconAnchor: [215, 215],
    html: `
      <span class="pw-cyclone-system">
        <svg viewBox="0 0 250 250" aria-hidden="true">
          <defs>
            <radialGradient id="stormCloud" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff7da" stop-opacity="0.60" />
              <stop offset="18%" stop-color="#ffb347" stop-opacity="0.42" />
              <stop offset="45%" stop-color="#7dd3fc" stop-opacity="0.24" />
              <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0" />
            </radialGradient>
          </defs>
          <ellipse class="pw-cyclone-cloud" cx="125" cy="125" rx="122" ry="94" />
          <ellipse class="pw-cyclone-rainband band-a" cx="125" cy="125" rx="114" ry="46" />
          <ellipse class="pw-cyclone-rainband band-b" cx="125" cy="125" rx="96" ry="38" />
          <ellipse class="pw-cyclone-rainband band-c" cx="125" cy="125" rx="132" ry="52" />
          <g class="pw-cyclone-rotor">
            <path d="M125 36 C174 43 199 78 178 111 C160 139 116 135 109 109 C102 82 136 71 151 91" />
            <path d="M125 214 C76 207 51 172 72 139 C90 111 134 115 141 141 C148 168 114 179 99 159" />
            <path d="M44 128 C53 78 92 58 125 78 C155 96 151 140 122 147 C94 154 78 118 101 101" />
            <path d="M206 122 C197 172 158 192 125 172 C95 154 99 110 128 103 C156 96 172 132 149 149" />
          </g>
          <circle class="pw-cyclone-eye" cx="125" cy="125" r="7" />
          <circle class="pw-cyclone-ring" cx="125" cy="125" r="44" />
          <circle class="pw-cyclone-ring late" cx="125" cy="125" r="72" />
        </svg>
        <b>${cyclone.name}</b>
        <em>${cyclone.pressureHpa} hPa · ${cyclone.maxWindKnots} kt · ${cyclone.movement}</em>
      </span>
    `,
  });
}

export function CycloneSystemLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const cyclone = marineWeatherIntelligence.cyclone;
  const track = cyclone.forecastTrack.map((point) => [point.lat, point.lon] as [number, number]);
  const cone = [
    [12.8, 85.0],
    [13.6, 83.8],
    [15.8, 81.8],
    [18.0, 80.8],
    [17.0, 83.0],
    [14.8, 84.2],
  ] as [number, number][];

  return (
    <LayerGroup>
      <Polygon
        positions={cone}
        pathOptions={{
          color: "#ffb347",
          fillColor: "#ffb347",
          fillOpacity: 0.055,
          opacity: 0.34,
          weight: 0.8,
          dashArray: "4 8",
        }}
      />
      <Polyline
        positions={track}
        pathOptions={{
          color: "#ffb347",
          opacity: 0.82,
          weight: 1.15,
          dashArray: "5 7",
          className: "pw-cyclone-track",
        }}
      />
      {track.map((position, index) => (
        <CircleMarker
          key={`${position[0]}-${position[1]}`}
          center={position}
          radius={index === 0 ? 4 : 2.5}
          pathOptions={{
            color: index === 0 ? "#ff5566" : "#ffb347",
            fillColor: index === 0 ? "#ff5566" : "#ffb347",
            fillOpacity: 0.9 - index * 0.08,
            weight: 0.8,
          }}
        />
      ))}
      <Marker position={[cyclone.center.lat, cyclone.center.lon]} icon={cycloneIcon()}>
        <Tooltip className="pw-port-tooltip" direction="right">
          <div className="pw-tooltip-card">
            <div className="text-[var(--color-red)]">CYCLONE OUTLOOK · {cyclone.source}</div>
            <div>{cyclone.name} Bay of Bengal storm envelope</div>
            <div className="grid grid-cols-[72px_68px] gap-x-2 tabular-nums">
              <span>PRESSURE</span>
              <b>{cyclone.pressureHpa} hPa</b>
              <span>MAX WIND</span>
              <b>{cyclone.maxWindKnots} kt</b>
              <span>PROB 72H</span>
              <b>{Math.round(cyclone.probability72h * 100)}%</b>
              <span>WINDOW</span>
              <b>{cyclone.riskWindow}</b>
            </div>
          </div>
        </Tooltip>
      </Marker>
    </LayerGroup>
  );
}
