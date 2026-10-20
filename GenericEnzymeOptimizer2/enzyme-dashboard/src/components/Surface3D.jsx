import React, { useMemo, useRef } from 'react'
import { niceTicks, rainbow, tickLabel } from '../lib/format'
import { isoSegments } from '../lib/contour'

const W = 560
const H = 440
const CX = W / 2 + 6
const CY = H / 2 + 6
const ZS = 0.78 

export default function Surface3D({
  grid, zRange, xLabel, yLabel, zLabel, az, el, onRotate, palette, svgRef, title,
}) {
  const localRef = useRef(null)
  const ref = svgRef || localRef
  const drag = useRef(null)

  const scene = useMemo(() => {
    const { xs, ys, z } = grid
    const [zmin, zmax] = zRange
    const nx = xs.length
    const ny = ys.length
    const xmin = xs[0], xmax = xs[nx - 1], ymin = ys[0], ymax = ys[ny - 1]
    const nxv = v => ((v - xmin) / (xmax - xmin || 1)) * 2 - 1
    const nyv = v => ((v - ymin) / (ymax - ymin || 1)) * 2 - 1
    const nzv = v => (((v - zmin) / (zmax - zmin || 1)) * 2 - 1) * ZS

    const A = (az * Math.PI) / 180
    const E = (el * Math.PI) / 180
    const cA = Math.cos(A), sA = Math.sin(A), cE = Math.cos(E), sE = Math.sin(E)
    const R = Math.sqrt(2 + ZS * ZS)
    const scale = Math.min(W, H) * 0.5 * 0.86 / R * 1.28

    const project = (x, y, zz) => {
      const xr = x * cA - y * sA
      const yr = x * sA + y * cA
      const depth = yr * cE - zz * sE
      const up = yr * sE + zz * cE
      return [CX + xr * scale, CY - up * scale, depth]
    }

    // surface quads
    const quads = []
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const zc = [z[j][i], z[j][i + 1], z[j + 1][i + 1], z[j + 1][i]]
        const p = [
          project(nxv(xs[i]), nyv(ys[j]), nzv(zc[0])),
          project(nxv(xs[i + 1]), nyv(ys[j]), nzv(zc[1])),
          project(nxv(xs[i + 1]), nyv(ys[j + 1]), nzv(zc[2])),
          project(nxv(xs[i]), nyv(ys[j + 1]), nzv(zc[3])),
        ]
        const zAvg = (zc[0] + zc[1] + zc[2] + zc[3]) / 4
        quads.push({
          d: (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4,
          pts: p.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' '),
          fill: rainbow((zAvg - zmin) / (zmax - zmin || 1)),
        })
      }
    }
    quads.sort((a, b) => b.d - a.d)

    // floor
    const fz = -ZS
    const floor = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      .map(([x, y]) => project(x, y, fz))
      .map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')

    const levels = niceTicks(zmin, zmax, 9).filter(v => v > zmin && v < zmax)
    const toFloor = ([gi, gj]) => {
      const x = xs[0] + ((xs[nx - 1] - xs[0]) * gi) / (nx - 1)
      const y = ys[0] + ((ys[ny - 1] - ys[0]) * gj) / (ny - 1)
      const q = project(nxv(x), nyv(y), fz)
      return `${q[0].toFixed(1)},${q[1].toFixed(1)}`
    }
    const contours = levels.map((lv, k) => ({
      key: k,
      path: isoSegments(grid, lv).map(([a, b]) => `M${toFloor(a)}L${toFloor(b)}`).join(''),
    }))

    // box wireframe
    const corners = []
    for (const zz of [-ZS, ZS]) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push([x, y, zz])
    const C = corners.map(([x, y, zz]) => project(x, y, zz))
    const edgeIdx = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    const edges = edgeIdx.map(([a, b]) => ({
      a: C[a], b: C[b], back: (C[a][2] + C[b][2]) / 2 > project(0, 0, 0)[2],
    }))

    const center = project(0, 0, fz)
    const frontY = project(0, -1, fz)[2] < project(0, 1, fz)[2] ? -1 : 1
    const frontX = project(-1, 0, fz)[2] < project(1, 0, fz)[2] ? -1 : 1
    const out = (pt, mid, dist) => {
      const dx = pt[0] - mid[0]
      const dy = pt[1] - mid[1]
      const len = Math.hypot(dx, dy) || 1
      return [pt[0] + (dx / len) * dist, pt[1] + (dy / len) * dist]
    }
    const xTicks = niceTicks(xmin, xmax, 5).map(v => {
      const p = project(nxv(v), frontY, fz)
      const l = out(p, center, 15)
      return { x: l[0], y: l[1], tx: p[0], ty: p[1], text: tickLabel(v) }
    })
    const yTicks = niceTicks(ymin, ymax, 5).map(v => {
      const p = project(frontX, nyv(v), fz)
      const l = out(p, center, 15)
      return { x: l[0], y: l[1], tx: p[0], ty: p[1], text: tickLabel(v) }
    })
    const xMid = out(project(0, frontY, fz), center, 46)
    const yMid = out(project(frontX, 0, fz), center, 58)
    const xAnchor = xMid[0] < CX - 40 ? 'end' : xMid[0] > CX + 40 ? 'start' : 'middle'
    const yAnchor = yMid[0] < CX - 40 ? 'end' : yMid[0] > CX + 40 ? 'start' : 'middle'

    // z axis on the left-most vertical edge
    const zCorner = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      .map(([x, y]) => ({ x, y, p: project(x, y, fz) }))
      .sort((a, b) => a.p[0] - b.p[0])[0]
    const zTicks = niceTicks(zmin, zmax, 5).filter(v => v > zmin + (zmax - zmin) * 0.04).map(v => {
      const p = project(zCorner.x, zCorner.y, nzv(v))
      return { x: p[0] - 12, y: p[1], text: tickLabel(v) }
    })
    const zTop = project(zCorner.x, zCorner.y, ZS)
    const zBottom = project(zCorner.x, zCorner.y, fz)

    return { quads, floor, contours, edges, xTicks, yTicks, xMid, yMid, xAnchor, yAnchor, zTicks, zAxisX: zTop[0] - 46, zMidY: (zTop[1] + zBottom[1]) / 2 }
  }, [grid, zRange, az, el])

  const onDown = e => {
    drag.current = { x: e.clientX, y: e.clientY, az, el }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = e => {
    if (!drag.current || !onRotate) return
    const nextAz = drag.current.az - (e.clientX - drag.current.x) * 0.5
    const nextEl = Math.min(80, Math.max(8, drag.current.el + (e.clientY - drag.current.y) * 0.4))
    onRotate(nextAz, nextEl)
  }
  const onUp = () => { drag.current = null }

  const c = palette
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="surface-svg"
      role="img"
      aria-label={title || '3D response surface'}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      style={{ touchAction: 'none', cursor: onRotate ? 'grab' : 'default' }}
      fontFamily="Inter, Arial, sans-serif"
    >
      <rect x="0" y="0" width={W} height={H} fill={c.surface} />

      {scene.edges.filter(e => e.back).map((e, i) => (
        <line key={`b${i}`} x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke={c.box} strokeWidth="0.7" opacity="0.45" />
      ))}

      <polygon points={scene.floor} fill={c.floor} stroke={c.box} strokeWidth="0.8" />
      {scene.contours.map(ct => (
        <path key={ct.key} d={ct.path} fill="none" stroke={c.floorLine} strokeWidth="1" strokeLinecap="round" />
      ))}

      <g>
        {scene.quads.map((q, i) => (
          <polygon key={i} points={q.pts} fill={q.fill} stroke={c.meshStroke} strokeWidth="0.35" strokeLinejoin="round" />
        ))}
      </g>

      {scene.edges.filter(e => !e.back).map((e, i) => (
        <line key={`f${i}`} x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke={c.box} strokeWidth="0.9" opacity="0.8" />
      ))}

      <g fill={c.ink} fontSize="10.5" textAnchor="middle" dominantBaseline="middle">
        {scene.xTicks.map((t, i) => <text key={`x${i}`} x={t.x} y={t.y}>{t.text}</text>)}
        {scene.yTicks.map((t, i) => <text key={`y${i}`} x={t.x} y={t.y}>{t.text}</text>)}
      </g>
      <g fill={c.ink} fontSize="10.5" textAnchor="end" dominantBaseline="middle">
        {scene.zTicks.map((t, i) => <text key={`z${i}`} x={t.x} y={t.y}>{t.text}</text>)}
      </g>

      <g fill={c.ink} fontSize="13" fontWeight="600">
        <text x={scene.xMid[0]} y={scene.xMid[1]} textAnchor={scene.xAnchor}>{xLabel}</text>
        <text x={scene.yMid[0]} y={scene.yMid[1]} textAnchor={scene.yAnchor}>{yLabel}</text>
        <text transform={`translate(${scene.zAxisX} ${scene.zMidY}) rotate(-90)`} fontSize="12" textAnchor="middle">{zLabel}</text>
      </g>
    </svg>
  )
}
