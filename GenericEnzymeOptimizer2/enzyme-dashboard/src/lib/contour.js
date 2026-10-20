export function isoSegments(grid, level) {
  const { z } = grid
  const ny = z.length
  const nx = z[0].length
  const segs = []
  const lerp = (a, b) => (level - a) / (b - a)
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v00 = z[j][i], v10 = z[j][i + 1], v11 = z[j + 1][i + 1], v01 = z[j + 1][i]
      const pts = []
      if ((v00 < level) !== (v10 < level)) pts.push([i + lerp(v00, v10), j])
      if ((v10 < level) !== (v11 < level)) pts.push([i + 1, j + lerp(v10, v11)])
      if ((v01 < level) !== (v11 < level)) pts.push([i + lerp(v01, v11), j + 1])
      if ((v00 < level) !== (v01 < level)) pts.push([i, j + lerp(v00, v01)])
      if (pts.length === 2) segs.push(pts)
      else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]) }
    }
  }
  return segs
}

