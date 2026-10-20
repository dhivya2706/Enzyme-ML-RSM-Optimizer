import React, { useMemo } from 'react'
import { niceTicks, niceRange, tickLabel } from '../lib/format'

const W = 560
const H = 380
const L = 62
const R = 20
const T = 18
const B = 56

export default function XYChart({
  series, xLabel, yLabel, palette, identity = false, zeroLine = false, vMarker, svgRef, title,
}) {
  const scene = useMemo(() => {
    const all = series.flatMap(s => s.points)
    if (!all.length) return null
    let xmin = Math.min(...all.map(p => p[0]))
    let xmax = Math.max(...all.map(p => p[0]))
    let ymin = Math.min(...all.map(p => p[1]))
    let ymax = Math.max(...all.map(p => p[1]))
    if (identity) {
      const lo = Math.min(xmin, ymin)
      const hi = Math.max(xmax, ymax)
      xmin = ymin = lo
      xmax = ymax = hi
    }
    if (zeroLine) { ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0) }
    const [x0, x1] = niceRange(xmin, xmax)
    const [y0, y1] = niceRange(ymin, ymax)
    const sx = v => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R)
    const sy = v => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B)
    return { x0, x1, y0, y1, sx, sy, xt: niceTicks(x0, x1, 6), yt: niceTicks(y0, y1, 6) }
  }, [series, identity, zeroLine])

  const c = palette
  if (!scene) return null
  const { sx, sy } = scene

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="xy-svg" role="img" aria-label={title || 'Chart'} fontFamily="Inter, Arial, sans-serif">
      <rect x="0" y="0" width={W} height={H} fill={c.surface} />
      <g stroke={c.grid} strokeWidth="1">
        {scene.yt.map(v => <line key={`gy${v}`} x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} />)}
        {scene.xt.map(v => <line key={`gx${v}`} y1={T} y2={H - B} x1={sx(v)} x2={sx(v)} />)}
      </g>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="none" stroke={c.box} strokeOpacity="0.6" />

      {identity && <line x1={sx(scene.x0)} y1={sy(scene.y0)} x2={sx(scene.x1)} y2={sy(scene.y1)} stroke={c.muted} strokeDasharray="5 4" strokeWidth="1.2" />}
      {zeroLine && <line x1={L} x2={W - R} y1={sy(0)} y2={sy(0)} stroke={c.muted} strokeDasharray="5 4" strokeWidth="1.2" />}
      {vMarker !== undefined && vMarker !== null && Number.isFinite(vMarker) && (
        <line x1={sx(vMarker)} x2={sx(vMarker)} y1={T} y2={H - B} stroke={c.muted} strokeDasharray="3 3" strokeWidth="1.2" />
      )}

      {series.map(s => s.kind === 'line' ? (
        <path
          key={s.name}
          d={s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('')}
          fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"
          strokeDasharray={s.dashed ? '6 4' : undefined}
        />
      ) : (
        <g key={s.name} fill={s.color} fillOpacity="0.78" stroke={c.surface} strokeWidth="1">
          {s.points.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="4.6" />)}
        </g>
      ))}

      <g fill={c.ink} fontSize="11" textAnchor="middle">
        {scene.xt.map(v => <text key={`tx${v}`} x={sx(v)} y={H - B + 18}>{tickLabel(v)}</text>)}
      </g>
      <g fill={c.ink} fontSize="11" textAnchor="end">
        {scene.yt.map(v => <text key={`ty${v}`} x={L - 8} y={sy(v) + 4}>{tickLabel(v)}</text>)}
      </g>
      <text x={(L + W - R) / 2} y={H - 22} textAnchor="middle" fill={c.ink} fontSize="12.5" fontWeight="600">{xLabel}</text>
      <text transform={`translate(16 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fill={c.ink} fontSize="12.5" fontWeight="600">{yLabel}</text>

      <g fontSize="11.5" fill={c.ink}>
        {series.map((s, i) => (
          <g key={s.name} transform={`translate(${L + 12 + i * 150} ${H - 6})`}>
            {s.kind === 'line'
              ? <line x1="0" x2="16" y1="-4" y2="-4" stroke={s.color} strokeWidth="2.6" strokeDasharray={s.dashed ? '5 3' : undefined} />
              : <circle cx="6" cy="-4" r="4.6" fill={s.color} />}
            <text x="22" y="0">{s.name}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
