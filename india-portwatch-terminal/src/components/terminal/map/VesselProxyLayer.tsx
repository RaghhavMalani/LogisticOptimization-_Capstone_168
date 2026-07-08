import type { VesselProxy } from "@/types/portwatch";

const vesselTone = {
  CONT: "#7ef0b4",
  TANKER: "#ffb347",
  BULK: "#7ef0b4",
  LNG: "#c58cff",
  GENERAL_CARGO: "#7dd3fc",
  PATROL: "#ff5566",
  SERVICE: "#7ef0b4",
  TUG: "#7ef0b4",
  OTHER: "#7dd3fc",
} as const;

export function VesselProxyLayer({ vessels }: { vessels: VesselProxy[] }) {
  return (
    <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
      <defs>
        <filter id="vesselShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#000" floodOpacity="0.7" />
        </filter>
      </defs>
      {vessels.map((vessel, index) => {
        const cx = vessel.radar.x * 1000;
        const cy = vessel.radar.y * 700;
        const dur = 6 + (index % 5);
        const tone = vesselTone[vessel.vesselType];
        return (
          <g
            key={vessel.id}
            transform={`translate(${cx} ${cy}) rotate(${vessel.heading})`}
            style={{ animation: `vessel-drift ${dur}s ease-in-out infinite` }}
          >
            <path d="M -18 0 Q -10 -2 -6 0 Q -10 2 -18 0 Z" fill={tone} opacity="0.18" />
            <line x1="-16" y1="0" x2="-6" y2="0" stroke={tone} strokeWidth="0.5" strokeDasharray="1.5 2" opacity="0.55" />
            <path
              d="M -5 -1.6 L 3 -1.6 L 5.2 0 L 3 1.6 L -5 1.6 Z"
              fill={tone}
              stroke="#000"
              strokeWidth="0.35"
              opacity="0.98"
              filter="url(#vesselShadow)"
            />
            <rect x="-2" y="-0.7" width="2.2" height="1.4" fill="#0a1420" opacity="0.7" />
          </g>
        );
      })}
    </svg>
  );
}
