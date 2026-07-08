export function WeatherOverlayLayer({ tick }: { tick: number }) {
  return (
    <svg viewBox="0 0 1000 700" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
      <defs>
        <radialGradient id="cyc" cx="70%" cy="72%" r="18%">
          <stop offset="0%" stopColor="oklch(0.68 0.24 25 / 0.65)" />
          <stop offset="60%" stopColor="oklch(0.68 0.24 25 / 0.18)" />
          <stop offset="100%" stopColor="oklch(0.68 0.24 25 / 0)" />
        </radialGradient>
        <radialGradient id="rainCore" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="oklch(0.55 0.22 260 / 0.55)" />
          <stop offset="60%" stopColor="oklch(0.60 0.18 200 / 0.28)" />
          <stop offset="100%" stopColor="oklch(0.72 0.20 145 / 0)" />
        </radialGradient>
        <linearGradient id="rainG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="oklch(0.55 0.22 260 / 0.35)" />
          <stop offset="1" stopColor="oklch(0.72 0.20 145 / 0.35)" />
        </linearGradient>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {Array.from({ length: 70 }).map((_, i) => {
        const y = 20 + i * 9.5;
        const dx = ((tick + i * 3) % 200) - 100;
        const opacity = 0.14 + ((i * 7) % 10) / 55;
        const sw = 0.4 + (i % 4) * 0.15;
        return (
          <path
            key={i}
            d={`M ${-50 + dx} ${y} Q 300 ${y - 30} 600 ${y + 20} T 1100 ${y}`}
            fill="none"
            stroke="oklch(0.82 0.18 195)"
            strokeWidth={sw}
            opacity={opacity}
          />
        );
      })}

      <g filter="url(#softBlur)">
        <ellipse cx="700" cy="530" rx="150" ry="95" fill="url(#rainCore)" opacity="0.75" />
        <ellipse cx="200" cy="540" rx="115" ry="65" fill="url(#rainCore)" opacity="0.6" />
        <ellipse cx="420" cy="620" rx="90" ry="45" fill="url(#rainG)" opacity="0.35" />
      </g>

      <circle cx="720" cy="510" r="100" fill="url(#cyc)" />
      <g transform="translate(720 510)">
        <g style={{ transformOrigin: "0 0", animation: "sweep 10s linear infinite" }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <path
              key={angle}
              d="M 0 0 Q 26 -6 40 -22 Q 52 -34 60 -46"
              fill="none"
              stroke="oklch(0.68 0.24 25 / 0.65)"
              strokeWidth="1.1"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
        <g style={{ transformOrigin: "0 0", animation: "sweep 16s linear infinite reverse" }}>
          {[0, 90, 180, 270].map((angle) => (
            <path
              key={angle}
              d="M 0 0 Q 40 -12 70 -28"
              fill="none"
              stroke="oklch(0.68 0.24 25 / 0.32)"
              strokeWidth="0.6"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
        <circle r="6" fill="none" stroke="var(--color-red)" strokeWidth="1" opacity="0.7" />
        <circle r="3" fill="var(--color-red)" />
        <text y="-16" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-red)" className="label-halo">
          CAT 6
        </text>
      </g>
    </svg>
  );
}
