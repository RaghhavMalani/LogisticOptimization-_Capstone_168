import L from "leaflet";
import { LayerGroup, Marker, Tooltip } from "react-leaflet";

function cycloneIcon() {
  return L.divIcon({
    className: "pw-cyclone-icon",
    iconSize: [190, 190],
    iconAnchor: [95, 95],
    html: `
      <span class="pw-cyclone-system">
        <svg viewBox="0 0 190 190" aria-hidden="true">
          <g class="pw-cyclone-rotor">
            <path d="M95 28 C136 34 154 62 138 88 C124 112 87 112 80 92 C72 68 101 56 114 72" />
            <path d="M95 162 C54 156 36 128 52 102 C66 78 103 78 110 98 C118 122 89 134 76 118" />
            <path d="M31 98 C38 58 70 43 96 60 C120 76 116 111 94 116 C70 121 60 93 77 80" />
            <path d="M159 92 C152 132 120 147 94 130 C70 114 74 79 96 74 C120 69 130 97 113 110" />
          </g>
          <circle cx="95" cy="95" r="6" />
          <circle class="pw-cyclone-ring" cx="95" cy="95" r="36" />
          <circle class="pw-cyclone-ring late" cx="95" cy="95" r="58" />
        </svg>
        <b>CYCLONE WATCH</b>
        <em>CAT WATCH · BAY OF BENGAL</em>
      </span>
    `,
  });
}

export function CycloneSystemLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <LayerGroup>
      <Marker position={[13.8, 88.7]} icon={cycloneIcon()}>
        <Tooltip className="pw-port-tooltip" direction="right">
          <div className="pw-tooltip-card">
            <div className="text-[var(--color-red)]">CYCLONE WATCH</div>
            <div>Bay of Bengal spiral bands</div>
            <div>Risk window T+48 to T+72</div>
          </div>
        </Tooltip>
      </Marker>
    </LayerGroup>
  );
}
