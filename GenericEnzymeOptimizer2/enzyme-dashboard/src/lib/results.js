import { fmt } from './format'

export const RSM_NAME = 'RSM Quadratic Regression'

export const ANN_NAME = 'Neural Network (ANN)'

export const isAnn = m => String(m?.modelName || '').toLowerCase() === ANN_NAME.toLowerCase()

export const isRsm = m => String(m?.modelName || '').toLowerCase() === RSM_NAME.toLowerCase()

export function pickBestOverall(models = []) {
  let best = null
  for (const m of models) {
    if (!Number.isFinite(Number(m.r2))) continue
    if (!best || Number(m.r2) > Number(best.r2) ||
        (Number(m.r2) === Number(best.r2) && Number(m.rmse) < Number(best.rmse))) best = m
  }
  return best
}

export function rankModels(models = []) {
  return [...models].sort((a, b) => Number(b.r2) - Number(a.r2) || Number(a.rmse) - Number(b.rmse))
}
export function namedParameters(parameters = [], dataset) {
  return parameters
    .map((raw, i) => {
      const input = dataset?.inputs?.[i]
      const value = Number(raw)
      if (dataset && !input) return null // trailing slot = target (NaN)
      if (!input && !Number.isFinite(value)) return null
      let display = fmt(value, 3)
      if (input?.type === 'categorical') display = input.categories[Math.round(value)] ?? '—'
      return { name: input?.name || `Parameter ${i + 1}`, value, display, categorical: input?.type === 'categorical' }
    })
    .filter(Boolean)
}

export function optimumVector(parameters, dataset, base) {
  return dataset.inputs.map((inp, i) => {
    const v = Number(parameters?.[i])
    return Number.isFinite(v) ? v : base[i]
  })
}
