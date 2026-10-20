function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, i) => [...row, vector[i]])
  for (let p = 0; p < n; p++) {
    let max = p
    for (let r = p + 1; r < n; r++) if (Math.abs(a[r][p]) > Math.abs(a[max][p])) max = r
    if (Math.abs(a[max][p]) < 1e-12) return null
    ;[a[p], a[max]] = [a[max], a[p]]
    const pv = a[p][p]
    for (let c = p; c <= n; c++) a[p][c] /= pv
    for (let r = 0; r < n; r++) {
      if (r === p) continue
      const f = a[r][p]
      if (f === 0) continue
      for (let c = p; c <= n; c++) a[r][c] -= f * a[p][c]
    }
  }
  return a.map(row => row[n])
}

function leastSquares(design, y, ridge = 1e-10) {
  const cols = design[0].length
  const normal = Array.from({ length: cols }, () => new Array(cols).fill(0))
  const rhs = new Array(cols).fill(0)
  for (let r = 0; r < design.length; r++) {
    const row = design[r]
    for (let i = 0; i < cols; i++) {
      rhs[i] += row[i] * y[r]
      for (let j = 0; j < cols; j++) normal[i][j] += row[i] * row[j]
    }
  }
  for (let i = 0; i < cols; i++) normal[i][i] += ridge
  return solveLinearSystem(normal, rhs)
}


export function metrics(actual, predicted) {
  const n = actual.length
  const mean = actual.reduce((a, b) => a + b, 0) / n
  let ssRes = 0
  let ssTot = 0
  let abs = 0
  for (let i = 0; i < n; i++) {
    const e = actual[i] - predicted[i]
    ssRes += e * e
    ssTot += (actual[i] - mean) ** 2
    abs += Math.abs(e)
  }
  return {
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    rmse: Math.sqrt(ssRes / n),
    mae: abs / n,
  }
}


export function fitRSM(data) {
  const idx = data.inputs.map((inp, i) => (inp.type === 'numeric' ? i : -1)).filter(i => i >= 0)
  const k = idx.length
  if (k < 2) return { error: 'Response surfaces need at least two numeric factors.' }
  const terms = 1 + 2 * k + (k * (k - 1)) / 2
  if (data.X.length < terms) {
    return { error: `A quadratic model with ${k} factors needs at least ${terms} runs (found ${data.X.length}).` }
  }
  const centers = []
  const steps = []
  idx.forEach(col => {
    const values = data.X.map(r => r[col])
    const counts = new Map()
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1))
    let center = null
    let best = 0
    counts.forEach((c, v) => { if (c > best) { best = c; center = v } })
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    if (best < 2) center = (lo + hi) / 2
    let step = Infinity
    values.forEach(v => {
      const d = Math.abs(v - center)
      if (d > 1e-8 && d < step) step = d
    })
    if (!Number.isFinite(step)) step = (hi - lo) / 2 || 1
    centers.push(center)
    steps.push(step)
  })

  const expand = coded => {
    const out = [1, ...coded]
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) out.push(coded[i] * coded[j])
    for (let i = 0; i < k; i++) out.push(coded[i] * coded[i])
    return out
  }
  const toCoded = point => idx.map((col, i) => (point[col] - centers[i]) / steps[i])

  const design = data.X.map(row => expand(toCoded(row)))
  const coef = leastSquares(design, data.y)
  if (!coef) return { error: 'The quadratic system is singular for this dataset.' }

  const predict = point => {
    const t = expand(toCoded(point))
    let s = 0
    for (let i = 0; i < coef.length; i++) s += coef[i] * t[i]
    return s
  }

  let alpha = 1
  data.X.forEach(row => toCoded(row).forEach(c => { if (Math.abs(c) > alpha) alpha = Math.abs(c) }))
  const stationary = () => {
    const H = Array.from({ length: k }, () => new Array(k).fill(0))
    const b = []
    for (let i = 0; i < k; i++) {
      b.push(-coef[1 + i])
      H[i][i] = 2 * coef[1 + k + (k * (k - 1)) / 2 + i]
    }
    let pos = 1 + k
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) { H[i][j] = coef[pos]; H[j][i] = coef[pos]; pos++ }
    return solveLinearSystem(H, b)
  }

  return {
    kind: 'rsm',
    label: 'RSM Quadratic',
    factorIdx: idx,
    predict,
    coef,
    centers,
    steps,
    alpha,
    stationaryCoded: stationary,
    toActual: coded => idx.map((col, i) => centers[i] + coded[i] * steps[i]),
    toCoded,
  }
}

function buildTree(X, y, idx, rng, opts, depth = 0) {
  const n = idx.length
  let sum = 0
  for (const i of idx) sum += y[i]
  const mean = sum / n
  let sse = 0
  for (const i of idx) sse += (y[i] - mean) ** 2
  if (n < 2 * opts.minLeaf || depth >= opts.maxDepth || sse < 1e-12) return { leaf: true, value: mean }

  const nf = X[0].length
  let features = Array.from({ length: nf }, (_, i) => i)
  if (opts.mtry && opts.mtry < nf) {
    for (let i = features.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[features[i], features[j]] = [features[j], features[i]]
    }
    features = features.slice(0, opts.mtry)
  }

  let best = null
  for (const f of features) {
    const order = [...idx].sort((a, b) => X[a][f] - X[b][f])
    let leftSum = 0
    for (let s = 0; s < n - 1; s++) {
      leftSum += y[order[s]]
      const leftN = s + 1
      const rightN = n - leftN
      if (X[order[s]][f] === X[order[s + 1]][f]) continue
      if (leftN < opts.minLeaf || rightN < opts.minLeaf) continue
      const rightSum = sum - leftSum
      const gain = (leftSum * leftSum) / leftN + (rightSum * rightSum) / rightN
      if (!best || gain > best.gain) {
        best = { gain, f, threshold: (X[order[s]][f] + X[order[s + 1]][f]) / 2 }
      }
    }
  }
  if (!best) return { leaf: true, value: mean }

  const left = []
  const right = []
  for (const i of idx) (X[i][best.f] <= best.threshold ? left : right).push(i)
  return {
    f: best.f,
    threshold: best.threshold,
    left: buildTree(X, y, left, rng, opts, depth + 1),
    right: buildTree(X, y, right, rng, opts, depth + 1),
  }
}

const treePredict = (node, x) => {
  let cur = node
  while (!cur.leaf) cur = x[cur.f] <= cur.threshold ? cur.left : cur.right
  return cur.value
}

function expandForLinear(data, point) {
  const out = []
  data.inputs.forEach((inp, j) => {
    if (inp.type === 'numeric') out.push(point[j])
    else inp.categories.forEach((_, c) => out.push(point[j] === c ? 1 : 0))
  })
  return out
}

function buildLinear(data, ridge) {
  const rows = data.X.map(r => expandForLinear(data, r))
  const nf = rows[0].length
  const mean = new Array(nf).fill(0)
  const sd = new Array(nf).fill(1)
  for (let j = 0; j < nf; j++) {
    mean[j] = rows.reduce((s, r) => s + r[j], 0) / rows.length
    const v = rows.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / rows.length
    sd[j] = Math.sqrt(v) || 1
  }
  const design = rows.map(r => [1, ...r.map((v, j) => (v - mean[j]) / sd[j])])
  const coef = leastSquares(design, data.y, ridge)
  if (!coef) return null
  return point => {
    const r = expandForLinear(data, point)
    let s = coef[0]
    for (let j = 0; j < nf; j++) s += coef[j + 1] * ((r[j] - mean[j]) / sd[j])
    return s
  }
}

const sigmoid = v => 1 / (1 + Math.exp(-Math.max(-60, Math.min(60, v))))

function buildMLP(data, details = {}) {
  const hidden = String(details.hiddenLayers || '3')
    .split(',')
    .map(v => parseInt(v, 10))
    .filter(v => v > 0)
  const lr = Number(details.learningRate) || 0.1
  const momentum = Number.isFinite(Number(details.momentum)) ? Number(details.momentum) : 0.2
  const epochs = Math.min(Math.max(Number(details.epochs) || 500, 1), 3000)

  const rows = data.X.map(r => expandForLinear(data, r))
  const nIn = rows[0].length
  const lo = new Array(nIn).fill(Infinity)
  const hi = new Array(nIn).fill(-Infinity)
  rows.forEach(r => r.forEach((v, j) => { if (v < lo[j]) lo[j] = v; if (v > hi[j]) hi[j] = v }))
  const scaleIn = r => r.map((v, j) => (hi[j] === lo[j] ? 0 : (2 * (v - lo[j])) / (hi[j] - lo[j]) - 1))

  const yLo = Math.min(...data.y)
  const yHi = Math.max(...data.y)
  const scaleY = v => (yHi === yLo ? 0 : (2 * (v - yLo)) / (yHi - yLo) - 1)
  const unscaleY = t => (yHi === yLo ? yLo : ((t + 1) / 2) * (yHi - yLo) + yLo)

  const X = rows.map(scaleIn)
  const Y = data.y.map(scaleY)

  const sizes = [nIn, ...hidden, 1]
  const rng = mulberry32(42)
  const W = []
  const prev = []
  for (let l = 1; l < sizes.length; l++) {
    W.push(Array.from({ length: sizes[l] }, () => Array.from({ length: sizes[l - 1] + 1 }, () => rng() - 0.5)))
    prev.push(Array.from({ length: sizes[l] }, () => new Array(sizes[l - 1] + 1).fill(0)))
  }
  const last = W.length - 1

  const forward = x => {
    const acts = [x]
    for (let l = 0; l <= last; l++) {
      const a = acts[l]
      acts.push(W[l].map(w => {
        let s = w[0]
        for (let i = 0; i < a.length; i++) s += w[i + 1] * a[i]
        return l === last ? s : sigmoid(s)
      }))
    }
    return acts
  }

  const n = X.length
  const order = Array.from({ length: n }, (_, i) => i)
  for (let e = 0; e < epochs; e++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    for (const r of order) {
      const acts = forward(X[r])
      let delta = [acts[last + 1][0] - Y[r]] 
      for (let l = last; l >= 0; l--) {
        const a = acts[l]
        const nextDelta = l > 0 ? new Array(sizes[l]).fill(0) : null
        for (let j = 0; j < W[l].length; j++) {
          const w = W[l][j]
          const p = prev[l][j]
          if (nextDelta) for (let i = 0; i < a.length; i++) nextDelta[i] += delta[j] * w[i + 1]
          const step0 = -lr * delta[j] + momentum * p[0]
          w[0] += step0
          p[0] = step0
          for (let i = 0; i < a.length; i++) {
            const step = -lr * delta[j] * a[i] + momentum * p[i + 1]
            w[i + 1] += step
            p[i + 1] = step
          }
        }
        if (nextDelta) for (let i = 0; i < nextDelta.length; i++) nextDelta[i] *= acts[l][i] * (1 - acts[l][i])
        delta = nextDelta
      }
    }
  }

  const predict = point => unscaleY(forward(scaleIn(expandForLinear(data, point)))[last + 1][0])
  return Number.isFinite(predict(data.X[0])) ? predict : null
}

export const ML_KINDS = {
  'Random Forest': 'forest',
  'Decision Tree': 'tree',
  'Linear Regression': 'linear',
  'Support Vector Regression': 'svr',
  'Additive Regression': 'additive',
  'Neural Network (ANN)': 'ann',
}

export function buildMLSurrogate(modelName, data, details) {
  const kind = ML_KINDS[modelName] || 'forest'
  const rng = mulberry32(42)
  const n = data.X.length
  const all = Array.from({ length: n }, (_, i) => i)
  let predict = null

  if (kind === 'forest') {
    const nf = data.inputs.length
    const mtry = Math.max(1, Math.floor(Math.log2(nf) + 1))
    const trees = []
    for (let t = 0; t < 150; t++) {
      const sample = Array.from({ length: n }, () => Math.floor(rng() * n))
      trees.push(buildTree(data.X, data.y, sample, rng, { minLeaf: 1, maxDepth: 40, mtry }))
    }
    predict = point => trees.reduce((s, tr) => s + treePredict(tr, point), 0) / trees.length
  } else if (kind === 'tree') {
    const tree = buildTree(data.X, data.y, all, rng, { minLeaf: 2, maxDepth: 40 })
    predict = point => treePredict(tree, point)
  } else if (kind === 'additive') {
    const base = data.y.reduce((a, b) => a + b, 0) / n
    const residual = data.y.map(v => v - base)
    const stumps = []
    for (let it = 0; it < 10; it++) {
      const stump = buildTree(data.X, residual, all, rng, { minLeaf: 1, maxDepth: 1 })
      stumps.push(stump)
      for (let i = 0; i < n; i++) residual[i] -= treePredict(stump, data.X[i])
    }
    predict = point => base + stumps.reduce((s, st) => s + treePredict(st, point), 0)
  } else if (kind === 'ann') {
    predict = buildMLP(data, details)
  } else {
    predict = buildLinear(data, kind === 'svr' ? 1e-3 : 1e-8)
  }

  if (!predict) return { error: 'Could not build the machine-learning surrogate for this dataset.' }
  return { kind, label: modelName || 'Random Forest', predict }
}


export const centerPoint = data =>
  data.inputs.map(inp => (inp.type === 'numeric' ? (inp.min + inp.max) / 2 : inp.mode))

export function evaluateOnData(model, data) {
  const predicted = data.X.map(row => model.predict(row))
  return { predicted, ...metrics(data.y, predicted) }
}

export function surfaceGrid(model, data, base, fx, fy, n = 24) {
  const ix = data.inputs[fx]
  const iy = data.inputs[fy]
  const xs = Array.from({ length: n }, (_, i) => ix.min + ((ix.max - ix.min) * i) / (n - 1))
  const ys = Array.from({ length: n }, (_, i) => iy.min + ((iy.max - iy.min) * i) / (n - 1))
  const z = ys.map(y => xs.map(x => {
    const p = [...base]
    p[fx] = x
    p[fy] = y
    return model.predict(p)
  }))
  return { xs, ys, z }
}

export function gridRange(...grids) {
  let min = Infinity
  let max = -Infinity
  grids.forEach(g => g && g.z.forEach(row => row.forEach(v => {
    if (v < min) min = v
    if (v > max) max = v
  })))
  return [min, max]
}

export function differenceGrid(a, b) {
  return { xs: a.xs, ys: a.ys, z: a.z.map((row, j) => row.map((v, i) => b.z[j][i] - v)) }
}

export function curve(model, data, base, factor, n = 40) {
  const inp = data.inputs[factor]
  return Array.from({ length: n }, (_, i) => {
    const x = inp.min + ((inp.max - inp.min) * i) / (n - 1)
    const p = [...base]
    p[factor] = x
    return [x, model.predict(p)]
  })
}

// RSM optimum: stationary point if it lies inside the experimental region,
// otherwise a bounded search (same policy as the Java ParameterOptimizer).
export function rsmOptimum(rsm, data) {
  if (!rsm || rsm.error) return null
  const base = centerPoint(data)
  const k = rsm.factorIdx.length
  const inRegion = coded => coded.every(c => Math.abs(c) <= rsm.alpha + 1e-8)

  const st = rsm.stationaryCoded()
  if (st && st.every(Number.isFinite) && inRegion(st)) {
    const actual = rsm.toActual(st)
    const point = [...base]
    rsm.factorIdx.forEach((col, i) => { point[col] = actual[i] })
    return { point, value: rsm.predict(point), stationary: true }
  }

  const rng = mulberry32(42)
  let best = null
  for (let it = 0; it < 20000; it++) {
    const coded = Array.from({ length: k }, () => (rng() * 2 - 1) * rsm.alpha)
    if (k === 3 && coded.reduce((s, c) => s + c * c, 0) > rsm.alpha ** 2) continue
    const actual = rsm.toActual(coded)
    const point = [...base]
    rsm.factorIdx.forEach((col, i) => { point[col] = actual[i] })
    const v = rsm.predict(point)
    if (Number.isFinite(v) && (!best || v > best.value)) best = { point, value: v, stationary: false }
  }
  return best
}
