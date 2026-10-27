import { useState } from "react";

export type RadarProfile = {
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
};

export function ResearchRadar({
  labels,
  profiles,
  compact = false,
  title = "Capability comparison",
}: {
  labels: string[];
  profiles: RadarProfile[];
  compact?: boolean;
  title?: string;
}) {
  const [focus, setFocus] = useState<number | null>(null);
  const cx = 260,
    cy = 218,
    radius = 135;
  function point(index: number, level: number, r = radius) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / labels.length;
    return [cx + (Math.cos(angle) * r * level) / 5, cy + (Math.sin(angle) * r * level) / 5];
  }
  const polygon = (level: number) =>
    labels.map((_, index) => point(index, level).join(",")).join(" ");
  return (
    <div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 520 440"
        role="img"
        aria-label={`${title}. Scale 1 to 5. ${profiles.map((profile) => `${profile.label}: ${profile.values.map((value, index) => `${labels[index]} ${value ?? "unanswered"}`).join(", ")}`).join(". ")}`}
        className="mx-auto block w-full"
        data-research-radar
      >
        <title>{title}</title>
        <rect width="520" height="440" fill="white" rx="20" />
        <polygon points={polygon(5)} fill="#faf9ff" />
        {[1, 2, 3, 4, 5].map((level) => (
          <g key={level}>
            <polygon points={polygon(level)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
            <text
              x={cx + 5}
              y={cy - (radius * level) / 5 - 3}
              fontSize="9"
              fill="#9ca3af"
              fontFamily="sans-serif"
            >
              {level}
            </text>
          </g>
        ))}
        {labels.map((label, index) => {
          const [x, y] = point(index, 5);
          const [tx, ty] = point(index, 5, 170);
          return (
            <g key={label}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" />
              <text
                x={tx}
                y={ty + 4}
                textAnchor={Math.abs(tx - cx) < 10 ? "middle" : tx > cx ? "start" : "end"}
                fontSize={compact ? "13" : "12"}
                fill="#52525b"
                fontFamily="sans-serif"
              >
                {label}
              </text>
            </g>
          );
        })}
        {profiles.map((profile) => (
          <g key={profile.label}>
            {profile.values.every((value) => value !== null) && (
              <polygon
                points={profile.values
                  .map((value, index) => point(index, value!).join(","))
                  .join(" ")}
                fill={profile.color}
                fillOpacity={profile.dashed ? 0.06 : 0.1}
                stroke={profile.color}
                strokeWidth={profile.dashed ? 2.5 : 2}
                strokeDasharray={profile.dashed ? "6 4" : undefined}
                strokeLinejoin="round"
              />
            )}
            {profile.values.map((value, index) => {
              if (value === null) return null;
              const [x, y] = point(index, value);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={focus === index ? 5 : 3}
                  fill={profile.color}
                  onMouseEnter={() => setFocus(index)}
                  onFocus={() => setFocus(index)}
                  onMouseLeave={() => setFocus(null)}
                  tabIndex={compact ? undefined : 0}
                  aria-label={`${profile.label}: ${labels[index]} ${value}/5`}
                >
                  <title>{`${profile.label} · ${labels[index]}: ${value}/5`}</title>
                </circle>
              );
            })}
          </g>
        ))}
      </svg>
      {!compact && (
        <div className="flex min-h-5 flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500">
          {profiles.map((profile) => (
            <span key={profile.label} className="inline-flex items-center gap-2">
              <span className="h-0.5 w-4" style={{ backgroundColor: profile.color }} />
              {profile.label}
              {focus !== null && ` · ${profile.values[focus] ?? "—"}/5`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
