// Minimal SVG charts. Colors come from CSS (currentColor + .chart-* classes).

const WIDTH = 320;

function niceRange(values, padRatio = 0.1) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.abs(max) || 1) * padRatio;
  return [min - pad, max + pad];
}

export function LineChart({ points, height = 140, unit = "", formatLabel = (value) => value }) {
  if (points.length === 0) return null;

  const padX = 8;
  const padTop = 16;
  const padBottom = 22;
  const values = points.map((point) => point.value);
  const [min, max] = niceRange(values);
  const x = (index) =>
    points.length === 1 ? WIDTH / 2 : padX + (index * (WIDTH - padX * 2)) / (points.length - 1);
  const y = (value) => padTop + (1 - (value - min) / (max - min)) * (height - padTop - padBottom);

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" ");
  const area = `${path} L${x(points.length - 1)},${height - padBottom} L${x(0)},${height - padBottom} Z`;
  const last = points[points.length - 1];
  const labelIndexes = points.length > 1 ? [0, points.length - 1] : [0];

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="График">
      <path className="chart-area" d={area} />
      <path className="chart-line" d={path} />
      {points.map((point, index) => (
        <circle key={point.label + index} className="chart-dot" cx={x(index)} cy={y(point.value)} r={points.length > 30 ? 0 : 2.5} />
      ))}
      <circle className="chart-dot-last" cx={x(points.length - 1)} cy={y(last.value)} r="4" />
      <text className="chart-value" x={Math.min(x(points.length - 1), WIDTH - 4)} y={Math.max(y(last.value) - 9, 11)} textAnchor="end">
        {last.value}
        {unit}
      </text>
      {labelIndexes.map((index) => (
        <text
          key={`label-${index}`}
          className="chart-label"
          x={x(index)}
          y={height - 6}
          textAnchor={index === 0 && points.length > 1 ? "start" : "end"}
        >
          {formatLabel(points[index].label)}
        </text>
      ))}
    </svg>
  );
}

export function BarChart({ bars, height = 130, target = null, highlightLast = true }) {
  if (bars.length === 0) return null;

  const padTop = 12;
  const padBottom = 20;
  const max = Math.max(...bars.map((bar) => bar.value), target || 0, 1) * 1.08;
  const slot = WIDTH / bars.length;
  const barWidth = Math.min(28, slot * 0.62);
  const scale = (value) => (value / max) * (height - padTop - padBottom);
  const targetY = target ? height - padBottom - scale(target) : null;

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Диаграмма">
      {bars.map((bar, index) => {
        const barHeight = Math.max(bar.value > 0 ? 3 : 0, scale(bar.value));
        const isLast = highlightLast && index === bars.length - 1;
        return (
          <g key={bar.label + index}>
            <rect
              className={`chart-bar ${isLast ? "current" : ""} ${bar.muted ? "muted" : ""}`}
              x={index * slot + (slot - barWidth) / 2}
              y={height - padBottom - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(6, barWidth / 3)}
            />
            <text className="chart-label" x={index * slot + slot / 2} y={height - 6} textAnchor="middle">
              {bar.label}
            </text>
          </g>
        );
      })}
      {targetY !== null && <line className="chart-target" x1="0" x2={WIDTH} y1={targetY} y2={targetY} />}
    </svg>
  );
}
