/** Decorative, token-coloured illustrations for the labs section (aria-hidden). */
export function CubeSectionIllustration() {
  return (
    <svg viewBox="0 0 200 160" className="h-40 w-full" aria-hidden="true">
      <g fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
        <path d="M50 50 L130 50 L130 130 L50 130 Z" />
        <path d="M50 50 L80 25 L160 25 L130 50" />
        <path d="M160 25 L160 105 L130 130" />
        <path d="M50 130 L80 105 L160 105" strokeDasharray="4 4" />
        <path d="M80 25 L80 105" strokeDasharray="4 4" />
      </g>
      <path
        d="M50 90 L130 50 L160 65 L80 105 Z"
        fill="var(--subject-geometry)"
        fillOpacity="0.2"
        stroke="var(--subject-geometry)"
        strokeWidth="2"
      />
    </svg>
  );
}

export function CircuitIllustration() {
  return (
    <svg viewBox="0 0 200 160" className="h-40 w-full" aria-hidden="true">
      <g fill="none" stroke="var(--text-muted)" strokeWidth="2">
        <path d="M30 40 H85 M115 40 H170 V120 H120 M80 120 H30 V40" />
        <rect x="85" y="30" width="30" height="20" rx="2" stroke="var(--subject-physics)" />
        <path d="M80 108 V132 M90 114 V126" strokeWidth="3" />
      </g>
      <circle
        cx="170"
        cy="80"
        r="16"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <text x="170" y="86" textAnchor="middle" fontSize="16" fill="var(--accent)" fontWeight="600">
        A
      </text>
    </svg>
  );
}
