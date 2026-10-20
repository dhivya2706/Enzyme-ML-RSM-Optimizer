import React, { useMemo } from 'react'
import { diverging, niceTicks, rainbow, tickLabel } from '../lib/format'
import { isoSegments } from '../lib/contour'

const W = 560
const H = 440
const L = 78
const T = 26
const PW = 372
const PH = 318

export default function Contour2D({
  grid, zRange, mode = 'value', xLabel, yLabel, unitLabel, palette, svgRef, title, marker,
}) {
  const scene = useMemo(() => {
    const { xs, ys, z } = grid
    const nx = xs.length
    const ny = ys.length
    let lo = zRange[0]
    let hi = zRange[1]
    if (mode === 'diff') {
      const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1
      lo = -m
      hi = m
    }
    const color = v => (mode === 'diff' ? diverging((v - lo) / (hi - lo)) : rainbow((v - lo) / (hi - lo || 1)))
    const cw = PW / (nx - 1)
    const ch = PH / (ny - 1)
    const px = i => L + i * cw
    const py = j => T + PH - j * ch

    const cells = []
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v = (z[j][i] + z[j][i + 1] + z[j + 1][i] + z[j + 1][i + 1]) / 4
        cells.push({ x: px(i), y: py(j + 1), fill: color(v) })
      }
    }

    const levels = niceTicks(lo, hi, mode === 'diff' ? 7 : 11).filter(v => v > lo && v < hi)
    const lines = levels.map((lv, k) => ({
      k,
      d: isoSegments(grid, lv).map(([a, b]) => `M${px(a[0]).toFixed(1)},${py(a[1]).toFixed(1)}L${px(b[0]).toFixed(1)},${py(b[1]).toFixed(1)}`).join(''),
      major: k % 2 === 0,
    }))

    const xTicks = niceTicks(xs[0], xs[nx - 1], 6).map(v => ({ v, x: L + ((v - xs[0]) / (xs[nx - 1] - xs[0] || 1)) * PW }))
    const yTicks = niceTicks(ys[0], ys[ny - 1], 6).map(v => ({ v, y: T + PH - ((v - ys[0]) / (ys[ny - 1] - ys[0] || 1)) * PH }))
    const barTicks = niceTicks(lo, hi, 6).map(v => ({ v, y: T + PH - ((v - lo) / (hi - lo || 1)) * PH }))
    const bar = Array.from({ length: 48 }, (_, i) => ({ y: T + PH - ((i + 1) / 48) * PH, v: lo + ((hi - lo) * (i + 0.5)) / 48 }))

    let mk = null
    if (marker && Number.isFinite(marker.x) && Number.isFinite(marker.y)) {
      mk = {
        x: L + ((marker.x - xs[0]) / (xs[nx - 1] - xs[0] || 1)) * PW,
        y: T + PH - ((marker.y - ys[0]) / (ys[ny - 1] - ys[0] || 1)) * PH,
      }
    }
    return { cells, cw, ch, lines, xTicks, yTicks, barTicks, bar, color, mk }
  }, [grid, zRange, mode, marker])

  const c = palette
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="surface-svg" role="img" aria-label={title || 'Contour map'} fontFamily="Inter, Arial, sans-serif">
      <rect x="0" y="0" width={W} height={H} fill={c.surface} />
      <g shapeRendering="crispEdges">
        {scene.cells.map((cell, i) => (
          <rect key={i} x={cell.x} y={cell.y} width={scene.cw + 0.6} height={scene.ch + 0.6} fill={cell.fill} />
        ))}
      </g>
      {scene.lines.map(l => (
        <path key={l.k} d={l.d} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={l.major ? 1.1 : 0.6} strokeLinecap="round" />
      ))}
      <rect x={L} y={T} width={PW} height={PH} fill="none" stroke={c.box} strokeWidth="1" />

      {scene.mk && (
        <g>
          <circle cx={scene.mk.x} cy={scene.mk.y} r="7" fill="none" stroke="#fff" strokeWidth="2.4" />
          <circle cx={scene.mk.x} cy={scene.mk.y} r="7" fill="none" stroke="#111" strokeWidth="1" />
          <circle cx={scene.mk.x} cy={scene.mk.y} r="2" fill="#111" />
        </g>
      )}

      <g fill={c.ink} fontSize="11" textAnchor="middle">
        {scene.xTicks.map(t => (
          <g key={`x${t.v}`}>
            <line x1={t.x} x2={t.x} y1={T + PH} y2={T + PH + 5} stroke={c.box} />
            <text x={t.x} y={T + PH + 19}>{tickLabel(t.v)}</text>
          </g>
        ))}
      </g>
      <g fill={c.ink} fontSize="11" textAnchor="end">
        {scene.yTicks.map(t => (
          <g key={`y${t.v}`}>
            <line x1={L - 5} x2={L} y1={t.y} y2={t.y} stroke={c.box} />
            <text x={L - 9} y={t.y + 4}>{tickLabel(t.v)}</text>
          </g>
        ))}
      </g>
      <text x={L + PW / 2} y={T + PH + 44} textAnchor="middle" fill={c.ink} fontSize="13" fontWeight="600">{xLabel}</text>
      <text transform={`translate(18 ${T + PH / 2}) rotate(-90)`} textAnchor="middle" fill={c.ink} fontSize="13" fontWeight="600">{yLabel}</text>

      <g>
        {scene.bar.map((b, i) => (
          <rect key={i} x={L + PW + 22} y={b.y} width="14" height={PH / 48 + 0.6} fill={scene.color(b.v)} />
        ))}
        <rect x={L + PW + 22} y={T} width="14" height={PH} fill="none" stroke={c.box} />
        <g fill={c.ink} fontSize="10.5" textAnchor="start">
          {scene.barTicks.map(t => (
            <g key={t.v}>
              <line x1={L + PW + 36} x2={L + PW + 40} y1={t.y} y2={t.y} stroke={c.box} />
              <text x={L + PW + 43} y={t.y + 3.5}>{mode === 'diff' && t.v > 0 ? '+' : ''}{tickLabel(t.v)}</text>
            </g>
          ))}
        </g>
        <text x={L + PW + 29} y={T - 9} textAnchor="middle" fill={c.muted} fontSize="10.5">{unitLabel}</text>
      </g>
    </svg>
  )
}
