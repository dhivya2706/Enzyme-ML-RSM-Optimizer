export const fmt = (value, digits = 2) => {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—'
  return Number(value).toFixed(digits)
}

export const percent = value => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return `${(Number(value) * 100).toFixed(2)}%`
}

export const prettyName = name => String(name || '').replace(/_/g, ' ')

export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) return [min]
  const span = max - min
  const rough = span / Math.max(1, count - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const start = Math.ceil(min / step - 1e-9) * step
  const out = []
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)))
  return out
}

export function niceRange(min, max) {
  if (min === max) return [min - 1, max + 1]
  const ticks = niceTicks(min, max, 6)
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : (max - min) / 5
  return [Math.floor(min / step + 1e-9) * step, Math.ceil(max / step - 1e-9) * step]
}

export const tickLabel = v => {
  const a = Math.abs(v)
  if (a >= 1000) return v.toFixed(0)
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return Number(v.toFixed(1)).toString()
  return Number(v.toFixed(2)).toString()
}

const RAINBOW = [
  [0.0, [24, 24, 190]], [0.18, [0, 105, 255]], [0.34, [0, 215, 230]],
  [0.5, [45, 200, 70]], [0.66, [205, 235, 35]], [0.8, [255, 170, 0]],
  [0.92, [232, 40, 0]], [1.0, [125, 0, 0]],
]
const DIVERGING = [
  [0.0, [37, 99, 235]], [0.5, [245, 247, 250]], [1.0, [220, 38, 38]],
]

function lerpStops(stops, t) {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [t0, c0] = stops[i - 1]
      const [t1, c1] = stops[i]
      const f = (x - t0) / (t1 - t0 || 1)
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f))
    }
  }
  return stops[stops.length - 1][1]
}

export const rainbow = t => `rgb(${lerpStops(RAINBOW, t).join(',')})`
export const diverging = t => `rgb(${lerpStops(DIVERGING, t).join(',')})`

export const rainbowGradientCss = () =>
  `linear-gradient(to top, ${RAINBOW.map(([t, c]) => `rgb(${c.join(',')}) ${t * 100}%`).join(',')})`

export function downloadSvgAsPng(svgEl, filename, background = '#ffffff', scale = 2) {
  if (!svgEl) return
  const clone = svgEl.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const vb = svgEl.viewBox.baseVal
  const width = vb.width || svgEl.clientWidth
  const height = vb.height || svgEl.clientHeight
  clone.setAttribute('width', width)
  clone.setAttribute('height', height)
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
}
