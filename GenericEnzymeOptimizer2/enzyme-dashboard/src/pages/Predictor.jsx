import React, { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Zap } from 'lucide-react'
import { Badge, Card, EmptyState, Notice, PageHeader, Select, Slider } from '../components/ui'
import XYChart from '../components/XYChart'
import ModelNote from '../components/ModelNote'
import { fmt, prettyName } from '../lib/format'
import { centerPoint, curve } from '../lib/models'
import { ANN_NAME, namedParameters, optimumVector } from '../lib/results'
import { predictActivity } from '../services/api'

const CURVE_POINTS = 40

export default function Predictor(props) {
  const { dataset, models, go } = props
  if (!models || !dataset) {
    return (
      <>
        <PageHeader eyebrow="ANALYTICS / PREDICTOR" title="Live Predictor & Optimum" subtitle="Explore predicted response for any factor combination." />
        <Card>
          <EmptyState icon={SlidersHorizontal} title="Run the analysis first" text="The predictor is available once a dataset is uploaded and the ML + RSM run has completed." action={<button className="btn btn-primary" onClick={() => go('data')}>Go to Data Workspace</button>} />
        </Card>
      </>
    )
  }
  return <PredictorInner {...props} />
}

function PredictorInner({ dataset, models, result, palette, enzymeName }) {
  const { rsm, ml, rsmOpt } = models
  const rsmOk = !rsm?.error
  const mlOk = !ml?.error
  const [point, setPoint] = useState(() => centerPoint(dataset))
  const refs = useRef({})
  const getRef = i => (refs.current[i] ||= { current: null })

  const numeric = dataset.inputs.map((inp, i) => (inp.type === 'numeric' ? i : -1)).filter(i => i >= 0)

  // ---- ANN: predictions come from the trained Weka network on the backend ----
  const annAvailable = Boolean(result?.annModel)
  const annIsML = annAvailable && ml?.label === ANN_NAME
  const [annState, setAnnState] = useState({ status: 'idle', value: NaN, curves: {}, outOfRange: [] })

  useEffect(() => {
    if (!annAvailable) return undefined
    let cancelled = false
    const toInputs = p => Object.fromEntries(
      dataset.inputs.map((inp, i) => [inp.name, inp.type === 'categorical' ? inp.categories[p[i]] : p[i]]),
    )
    const timer = setTimeout(async () => {
      const points = [toInputs(point)]
      const spans = []
      numeric.forEach(i => {
        const inp = dataset.inputs[i]
        const xs = Array.from({ length: CURVE_POINTS }, (_, k) => inp.min + ((inp.max - inp.min) * k) / (CURVE_POINTS - 1))
        xs.forEach(x => { const q = [...point]; q[i] = x; points.push(toInputs(q)) })
        spans.push({ i, xs })
      })
      setAnnState(prev => ({ ...prev, status: 'loading' }))
      try {
        const res = await predictActivity({ model: ANN_NAME, points })
        if (cancelled) return
        const values = res.predictions.map(entry => entry.values?.[ANN_NAME])
        const curves = {}
        let offset = 1
        spans.forEach(({ i, xs }) => {
          curves[i] = xs.map((x, k) => [x, values[offset + k]]).filter(([, y]) => Number.isFinite(y))
          offset += xs.length
        })
        setAnnState({ status: 'ok', value: values[0] ?? NaN, curves, outOfRange: res.predictions[0]?.outOfRange || [] })
      } catch (err) {
        if (cancelled) return
        setAnnState({
          status: 'error', value: NaN, curves: {}, outOfRange: [],
          error: err.response?.data?.message || err.message || 'ANN prediction failed.',
        })
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [point, annAvailable, dataset])

  const rsmValue = rsmOk ? rsm.predict(point) : NaN
  const mlValue = annIsML && Number.isFinite(annState.value) ? annState.value : (mlOk ? ml.predict(point) : NaN)
  const delta = mlValue - rsmValue
  const response = prettyName(dataset.targetColumn)

  const mlOptVec = result?.mlOptimum?.parameters ? optimumVector(result.mlOptimum.parameters, dataset, centerPoint(dataset)) : null
  const mlOptParams = namedParameters(result?.mlOptimum?.parameters || [], dataset)
  const rsmParams = rsmOpt ? dataset.inputs.map((inp, i) => ({ name: inp.name, display: inp.type === 'categorical' ? inp.categories[rsmOpt.point[i]] : fmt(rsmOpt.point[i], 3) })) : []

  const annOptVec = result?.annOptimum?.parameters ? optimumVector(result.annOptimum.parameters, dataset, centerPoint(dataset)) : null
  const annOptParams = namedParameters(result?.annOptimum?.parameters || [], dataset)
  const annDetails = result?.annModel?.details
  const annNote = annDetails
    ? `Hidden layers ${annDetails.hiddenLayers} · learning rate ${annDetails.learningRate} · ${annDetails.epochs} epochs · CV R² ${fmt(result.annModel.r2, 3)}`
    : ''

  const setValue = (i, v) => setPoint(p => p.map((x, j) => (j === i ? v : x)))

  return (
    <>
      <PageHeader eyebrow="ANALYTICS / PREDICTOR" title="Live Predictor & Optimum" subtitle={`Move the sliders to see how RSM and ML predict ${enzymeName || 'enzyme'} ${response}.`} />
      <ModelNote mlLabel={ml?.label || '—'} rsmError={rsm?.error} />

      <div className="predictor-grid">
        <Card
          title="Factor settings"
          subtitle="Ranges come from your experimental data."
          actions={(
            <div className="preset-row">
              <button className="btn btn-secondary btn-xs" onClick={() => setPoint(centerPoint(dataset))}>Centre</button>
              <button className="btn btn-secondary btn-xs" disabled={!mlOptVec} onClick={() => setPoint(mlOptVec)}>ML optimum</button>
              {annAvailable && !annIsML && (
                <button className="btn btn-secondary btn-xs" disabled={!annOptVec} onClick={() => setPoint(annOptVec)}>ANN optimum</button>
              )}
              <button className="btn btn-secondary btn-xs" disabled={!rsmOpt} onClick={() => setPoint(rsmOpt.point)}>RSM optimum</button>
            </div>
          )}
        >
          {dataset.inputs.map((inp, i) => inp.type === 'categorical' ? (
            <Select key={inp.name} label={inp.name} value={String(point[i])} onChange={v => setValue(i, Number(v))} options={inp.categories.map((c, ci) => ({ value: String(ci), label: c }))} />
          ) : (
            <Slider key={inp.name} label={inp.name} value={point[i]} min={inp.min} max={inp.max} step={(inp.max - inp.min) / 200 || 1} onChange={v => setValue(i, v)} format={v => fmt(v, 2)} />
          ))}
        </Card>

        <div className="stack">
          <div className="pred-card pred-rsm">
            <div className="pred-top"><Badge tone="rsm">RSM Quadratic</Badge></div>
            <small>Predicted {response}</small>
            <div className="pred-value">{fmt(rsmValue)}</div>
          </div>
          <div className="pred-card pred-ml">
            <div className="pred-top"><Badge tone="ml">ML · {ml?.label}{annIsML && Number.isFinite(annState.value) ? ' (Weka)' : ''}</Badge></div>
            <small>Predicted {response}</small>
            <div className="pred-value">{fmt(mlValue)}</div>
          </div>
          {annAvailable && !annIsML && (
            <div className="pred-card pred-ann">
              <div className="pred-top"><Badge tone="ann">ANN · Weka neural network</Badge></div>
              <small>Predicted {response}</small>
              <div className="pred-value">{annState.status === 'error' ? '—' : fmt(annState.value)}</div>
              <span className="pred-note">{annNote}</span>
              {annState.status === 'error' && <span className="pred-note pred-warn">{annState.error}</span>}
              {annState.outOfRange.length > 0 && <span className="pred-note pred-warn">Outside the experimental range for {annState.outOfRange.join(', ')} — extrapolation is unreliable.</span>}
            </div>
          )}
          <div className="pred-card pred-delta">
            <div className="pred-top"><Badge>Difference</Badge></div>
            <small>ML − RSM</small>
            <div className="pred-value">{Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : '—'}</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <Card title="ML optimum (backend)" subtitle="Highest response found by the 5,000-point search over the experimental ranges.">
          {result?.mlOptimum ? (
            <>
              <div className="optimum-value"><small>PREDICTED RESPONSE</small><b>{fmt(result.mlOptimum.predictedActivity)}</b></div>
              <div className="chips">{mlOptParams.map(p => <span className="chip" key={p.name}>{p.name}<b>{p.display}</b></span>)}</div>
            </>
          ) : <Notice tone="info">No ML optimum was returned.</Notice>}
        </Card>
        {annAvailable && !annIsML && (
          <Card title="ANN optimum (backend)" subtitle="Highest response the neural network predicts inside the experimental ranges (5,000-point search).">
            {result?.annOptimum ? (
              <>
                <div className="optimum-value"><small>PREDICTED RESPONSE</small><b>{fmt(result.annOptimum.predictedActivity)}</b></div>
                <div className="chips">{annOptParams.map(p => <span className="chip" key={p.name}>{p.name}<b>{p.display}</b></span>)}</div>
              </>
            ) : <Notice tone="info">No ANN optimum was returned.</Notice>}
          </Card>
        )}
        <Card title="RSM optimum (browser)" subtitle="Stationary point of the fitted quadratic, or the best bounded point if it lies outside the design.">
          {rsmOpt ? (
            <>
              <div className="optimum-value"><small>PREDICTED RESPONSE</small><b>{fmt(rsmOpt.value)}</b></div>
              <div className="chips">{rsmParams.map(p => <span className="chip" key={p.name}>{p.name}<b>{p.display}</b></span>)}</div>
              <p className="hint"><Zap size={13} /> {rsmOpt.stationary ? 'True stationary point inside the experimental region.' : 'Stationary point is outside the design region, so the best in-region point is shown.'}</p>
            </>
          ) : <Notice tone="info">RSM optimum unavailable{rsm?.error ? `: ${rsm.error}` : '.'}</Notice>}
        </Card>
      </div>

      <h2 className="section-title">One-factor response curves</h2>
      <p className="section-sub">Each curve varies one factor while the others stay at the slider values above. The dashed line marks the current setting.</p>
      <div className="curve-grid">
        {numeric.map(i => {
          const inp = dataset.inputs[i]
          const series = []
          if (rsmOk) series.push({ name: 'RSM', color: palette.rsm, kind: 'line', points: curve(rsm, dataset, point, i) })
          const annCurve = annState.curves[i]
          if (mlOk && !(annIsML && annCurve?.length)) series.push({ name: 'ML', color: palette.ml, kind: 'line', points: curve(ml, dataset, point, i) })
          if (annCurve?.length) series.push({ name: annIsML ? 'ML (ANN)' : 'ANN', color: annIsML ? palette.ml : palette.ann, kind: 'line', points: annCurve })
          return (
            <Card key={inp.name} title={inp.name} className="curve-card">
              <XYChart svgRef={getRef(i)} series={series} vMarker={point[i]} xLabel={inp.name} yLabel={response} palette={palette} title={`${inp.name} response curve`} />
            </Card>
          )
        })}
      </div>
    </>
  )
}
