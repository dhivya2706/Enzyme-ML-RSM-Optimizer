import React, { useMemo, useRef, useState } from 'react'
import { Box, RotateCcw } from 'lucide-react'
import { Card, EmptyState, ExportButton, Notice, PageHeader, Segmented, Select, Slider } from '../components/ui'
import Surface3D from '../components/Surface3D'
import Contour2D from '../components/Contour2D'
import ModelNote from '../components/ModelNote'
import { fmt, niceRange, prettyName, rainbowGradientCss } from '../lib/format'
import { centerPoint, differenceGrid, gridRange, surfaceGrid } from '../lib/models'
import { optimumVector } from '../lib/results'

const LETTERS = 'ABCDEFGH'
const VIEWS = [
  { value: 'rsm', label: 'RSM' },
  { value: 'ml', label: 'ML' },
  { value: 'compare', label: 'Compare' },
  { value: 'delta', label: 'Compare + Δ' },
]

export default function Surfaces(props) {
  const { dataset, models, go } = props
  const numericCount = dataset ? dataset.inputs.filter(inp => inp.type === 'numeric').length : 0

  if (!models || !dataset || numericCount < 2) {
    return (
      <>
        <PageHeader eyebrow="ANALYTICS / RESPONSE SURFACES" title="3D Response Surfaces" subtitle="RSM and machine-learning response surfaces, side by side." />
        <Card>
          <EmptyState
            icon={Box}
            title={models ? 'At least two numeric factors are needed' : 'Run the analysis first'}
            text={models ? 'Response surfaces plot the response against two numeric factors at a time.' : 'Surfaces are generated after a dataset is uploaded and the ML + RSM run has completed.'}
            action={<button className="btn btn-primary" onClick={() => go('data')}>Go to Data Workspace</button>}
          />
        </Card>
      </>
    )
  }

  return <SurfacesInner {...props} />
}

function SurfacesInner({ dataset, models, result, palette }) {
  const [view, setView] = useState('compare')
  const [plot, setPlot] = useState('3d')
  const [pairKey, setPairKey] = useState('all')
  const [az, setAz] = useState(40)
  const [el, setEl] = useState(28)
  const [hold, setHold] = useState(() => centerPoint(dataset))
  const refs = useRef({})

  const numeric = dataset.inputs.map((inp, i) => (inp.type === 'numeric' ? i : -1)).filter(i => i >= 0)

  const { rsm, ml, rsmOpt } = models
  const rsmOk = !rsm?.error
  const mlOk = !ml?.error
  const effectiveView = !rsmOk ? 'ml' : !mlOk ? 'rsm' : view

  const factorLabel = i => `${LETTERS[numeric.indexOf(i)]}: ${dataset.inputs[i].name}`
  const pairs = []
  for (let a = 0; a < numeric.length; a++) for (let b = a + 1; b < numeric.length; b++) pairs.push([numeric[a], numeric[b]])
  const pairValue = p => `${p[0]}-${p[1]}`
  const shown = pairKey === 'all' ? pairs.slice(0, 6) : [pairs.find(p => pairValue(p) === pairKey) || pairs[0]]
  const n = plot === '3d' ? 24 : 36
  const zLabel = prettyName(dataset.targetColumn)

  const rows = useMemo(() => shown.map(([fx, fy]) => {
    const g = {}
    if (rsmOk) g.rsm = surfaceGrid(rsm, dataset, hold, fx, fy, n)
    if (mlOk) g.ml = surfaceGrid(ml, dataset, hold, fx, fy, n)
    if (g.rsm && g.ml) g.delta = differenceGrid(g.rsm, g.ml)
    const [lo, hi] = gridRange(g.rsm, g.ml)
    g.zr = niceRange(lo, hi)
    if (g.delta) { const [dlo, dhi] = gridRange(g.delta); g.dr = [dlo, dhi] }
    return { fx, fy, g }
  }), [rsm, ml, dataset, hold, pairKey, n])

  const keys = effectiveView === 'delta' ? ['rsm', 'ml', 'delta'] : effectiveView === 'compare' ? ['rsm', 'ml'] : [effectiveView]
  const panelTitle = k => (k === 'rsm' ? 'RSM · quadratic' : k === 'ml' ? `ML · ${ml.label}` : 'Difference · ML − RSM')
  const getRef = id => (refs.current[id] ||= { current: null })

  const applyPreset = which => {
    const base = centerPoint(dataset)
    if (which === 'center') setHold(base)
    if (which === 'ml' && result?.mlOptimum?.parameters) setHold(optimumVector(result.mlOptimum.parameters, dataset, base))
    if (which === 'rsm' && rsmOpt) setHold(rsmOpt.point)
  }

  const rotate = (a, e) => { setAz(a); setEl(e) }
  const axisFactors = shown.length === 1 ? shown[0] : []
  const heldText = ([fx, fy]) => {
    const others = dataset.inputs.map((inp, i) => i).filter(i => i !== fx && i !== fy)
    return others.length ? `Held at ${others.map(i => `${dataset.inputs[i].name} = ${dataset.inputs[i].type === 'categorical' ? dataset.inputs[i].categories[hold[i]] : fmt(hold[i], 2)}`).join(' · ')}` : ''
  }

  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS / RESPONSE SURFACES"
        title="3D Response Surfaces"
        subtitle="Predicted response over pairs of factors — RSM and ML on a shared colour scale."
      />
      <ModelNote mlLabel={ml?.label || '—'} rsmError={rsm?.error} />
      {mlOk === false && <Notice tone="warn">{ml.error}</Notice>}

      <div className="with-inspector">
        <div className="figures">
          {rows.map((row, ri) => {
            const letter = String.fromCharCode(97 + ri)
            return (
              <Card
                key={`${row.fx}-${row.fy}`}
                className="figure-card"
                title={<><span className="fig-letter">{shown.length > 1 ? `(${letter})` : ''}</span> {factorLabel(row.fx)} × {factorLabel(row.fy)}</>}
                subtitle={heldText([row.fx, row.fy])}
              >
                <div className={`fig-row cols-${keys.length}`}>
                  {keys.map(k => {
                    const id = `${ri}-${k}`
                    const grid = row.g[k]
                    if (!grid) return null
                    const isDelta = k === 'delta'
                    return (
                      <figure className="fig-panel" key={k}>
                        <figcaption>
                          <span className={`fig-dot ${k}`} style={{ background: k === 'rsm' ? palette.rsm : k === 'ml' ? palette.ml : palette.muted }} />
                          {panelTitle(k)}
                          <ExportButton svgRef={getRef(id)} name={`surface-${LETTERS[numeric.indexOf(row.fx)]}${LETTERS[numeric.indexOf(row.fy)]}-${k}`} background={palette.surface} />
                        </figcaption>
                        {plot === '3d' && !isDelta ? (
                          <Surface3D
                            svgRef={getRef(id)}
                            grid={grid}
                            zRange={effectiveView === 'rsm' || effectiveView === 'ml' ? niceRange(...gridRange(grid)) : row.g.zr}
                            xLabel={factorLabel(row.fx)}
                            yLabel={factorLabel(row.fy)}
                            zLabel={zLabel}
                            az={az}
                            el={el}
                            onRotate={rotate}
                            palette={palette}
                            title={`${panelTitle(k)} surface`}
                          />
                        ) : (
                          <Contour2D
                            svgRef={getRef(id)}
                            grid={grid}
                            mode={isDelta ? 'diff' : 'value'}
                            zRange={isDelta ? row.g.dr : effectiveView === 'rsm' || effectiveView === 'ml' ? niceRange(...gridRange(grid)) : row.g.zr}
                            xLabel={factorLabel(row.fx)}
                            yLabel={factorLabel(row.fy)}
                            unitLabel={isDelta ? 'Δ response' : 'response'}
                            palette={palette}
                            title={`${panelTitle(k)} contour`}
                          />
                        )}
                      </figure>
                    )
                  })}
                </div>
              </Card>
            )
          })}
          {pairKey === 'all' && pairs.length > 6 && <Notice tone="info">Showing the first 6 of {pairs.length} factor pairs. Pick a specific pair in the panel on the right to view the others.</Notice>}
        </div>

        <aside className="inspector" aria-label="Surface controls">
          <div className="inspector-section">
            <h4>View</h4>
            <Segmented label="Model view" options={VIEWS.map(v => ({ ...v, disabled: (v.value === 'rsm' && !rsmOk) || (v.value === 'ml' && !mlOk) || ((v.value === 'compare' || v.value === 'delta') && !(rsmOk && mlOk)) }))} value={effectiveView} onChange={setView} />
            <div style={{ height: 10 }} />
            <Segmented label="Plot type" options={[{ value: '3d', label: '3D surface' }, { value: 'contour', label: '2D contour' }]} value={plot} onChange={setPlot} />
          </div>

          <div className="inspector-section">
            <h4>Factor pair</h4>
            <Select
              label="Show"
              value={pairKey}
              onChange={setPairKey}
              options={[{ value: 'all', label: `All pairs (${Math.min(pairs.length, 6)} figures)` }, ...pairs.map(p => ({ value: pairValue(p), label: `${factorLabel(p[0])} × ${factorLabel(p[1])}` }))]}
            />
          </div>

          <div className="inspector-section">
            <div className="inspector-title-row">
              <h4>Hold other factors</h4>
            </div>
            <div className="preset-row">
              <button className="btn btn-secondary btn-xs" onClick={() => applyPreset('center')}>Centre</button>
              <button className="btn btn-secondary btn-xs" onClick={() => applyPreset('ml')} disabled={!result?.mlOptimum?.parameters}>ML optimum</button>
              <button className="btn btn-secondary btn-xs" onClick={() => applyPreset('rsm')} disabled={!rsmOpt}>RSM optimum</button>
            </div>
            {dataset.inputs.map((inp, i) => {
              if (inp.type === 'categorical') {
                return (
                  <Select
                    key={inp.name}
                    label={inp.name}
                    value={String(hold[i])}
                    onChange={v => setHold(h => h.map((x, j) => (j === i ? Number(v) : x)))}
                    options={inp.categories.map((c, ci) => ({ value: String(ci), label: c }))}
                  />
                )
              }
              const onAxis = axisFactors.includes(i)
              return (
                <Slider
                  key={inp.name}
                  label={`${LETTERS[numeric.indexOf(i)]}: ${inp.name}`}
                  value={hold[i]}
                  min={inp.min}
                  max={inp.max}
                  step={(inp.max - inp.min) / 100 || 1}
                  disabled={onAxis}
                  onChange={v => setHold(h => h.map((x, j) => (j === i ? v : x)))}
                  format={v => fmt(v, 2)}
                />
              )
            })}
          </div>

          {plot === '3d' && (
            <div className="inspector-section">
              <div className="inspector-title-row">
                <h4>Camera</h4>
                <button className="btn btn-ghost btn-xs" onClick={() => { setAz(40); setEl(28) }}><RotateCcw size={12} />Reset</button>
              </div>
              <Slider label="Azimuth" value={Math.round(az)} min={-180} max={180} step={1} onChange={setAz} format={v => `${v}°`} />
              <Slider label="Elevation" value={Math.round(el)} min={8} max={80} step={1} onChange={setEl} format={v => `${v}°`} />
              <p className="hint">Tip: drag any surface to rotate all views together.</p>
            </div>
          )}

          <div className="inspector-section">
            <h4>Colour scale</h4>
            <div className="scale">
              <div className="scale-bar" style={{ background: rainbowGradientCss().replace('to top', 'to right') }} />
              <div className="scale-labels"><span>Low</span><span>High</span></div>
            </div>
            <p className="hint">Both models share one scale per figure so colours are directly comparable.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
