import type { Rating } from "../types.ts";

const W = 386;
const H = 88;

interface MoodChartProps {
  /** Oldest first; `null` on days with no mood set. */
  series: (Rating | null)[];
}

/** Maps a 1–5 rating onto the plot area, 5 at the top. */
const yFor = (value: number) => H - ((value - 1) / 4) * H;

export function MoodChart({ series }: MoodChartProps) {
  const span = Math.max(1, series.length - 1);
  const points = series
    .map((mood, i) => (mood === null ? null : ([(i / span) * W, yFor(mood)] as const)))
    .filter((p): p is readonly [number, number] => p !== null);

  const last = points[points.length - 1];

  return (
    <svg
      className="mood-chart"
      viewBox={`0 0 ${W} ${H + 8}`}
      width="100%"
      height={96}
      role="img"
      aria-label={`Mood over the last ${series.length} days, on a scale of 1 to 5.`}
    >
      {[1, 3, 5].map((v) => (
        <line
          key={v}
          x1={0}
          x2={W}
          y1={yFor(v)}
          y2={yFor(v)}
          stroke="rgba(239,236,229,.07)"
          strokeWidth={1}
        />
      ))}
      {points.length > 1 && (
        <polyline
          points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#e0b98d"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
      )}
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill="#e0b98d" />}
    </svg>
  );
}
