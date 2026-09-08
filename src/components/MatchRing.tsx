export function MatchRing({ value, size = 60 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const hue = 12 + (pct / 100) * 78;          // kirmizidan yesile

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
                strokeWidth="4" className="text-paper/12" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`hsl(${hue} 62% 55%)`}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-[family-name:var(--font-display)] text-[15px] tabular-nums text-paper">
          {pct}
          <span className="text-[9px] text-paper/50">%</span>
        </span>
      </div>
    </div>
  );
}
