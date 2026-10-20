import React, { useRef } from 'react'
import { GitCompare } from 'lucide-react'
import { Badge, Card, EmptyState, ExportButton, Kpi, PageHeader } from '../components/ui'
import XYChart from '../components/XYChart'
import ModelNote from '../components/ModelNote'
import { fmt, prettyName } from '../lib/format'
import { Gauge, Activity, Target } from 'lucide-react'

export default function Comparison({ dataset, models, palette, go, enzymeName }) {
  const parityRef = useRef(null)
  const residRef = useRef(null)

  if (!models || !dataset) {
    return (
      <>
        <PageHeader eyebrow="MODEL PERFORMANCE / PLOTS" title="RSM vs ML — Side-by-Side Plots" subtitle="Actual vs predicted responses and residuals for both model families." />
        <Card>
          <EmptyState icon={GitCompare} title="Run the analysis first" text="These plots appear once a dataset is uploaded and the ML + RSM run has completed." action={<button className="btn btn-primary" onClick={() => go('data')}>Go to Data Workspace</button>} />
        </Card>
      </>
    )
  }

  const { rsm, ml, rsmEval, mlEval } = models
  const response = prettyName(dataset.targetColumn)
  const idx = dataset.y.map((_, i) => i + 1)

  const paritySeries = []
  if (rsmEval) paritySeries.push({ name: 'RSM', color: palette.rsm, kind: 'scatter', points: dataset.y.map((y, i) => [y, rsmEval.predicted[i]]) })
  if (mlEval) paritySeries.push({ name: `ML (${ml.label})`, color: palette.ml, kind: 'scatter', points: dataset.y.map((y, i) => [y, mlEval.predicted[i]]) })

  const residSeries = []
  if (rsmEval) residSeries.push({ name: 'RSM', color: palette.rsm, kind: 'scatter', points: idx.map((r, i) => [r, dataset.y[i] - rsmEval.predicted[i]]) })
  if (mlEval) residSeries.push({ name: `ML (${ml.label})`, color: palette.ml, kind: 'scatter', points: idx.map((r, i) => [r, dataset.y[i] - mlEval.predicted[i]]) })

  const factorNames = dataset.inputs.map(i => i.name)
  const showInput = (inp, v) => (inp.type === 'categorical' ? inp.categories[v] : fmt(v, 2))

  return (
    <>
      <PageHeader eyebrow="MODEL PERFORMANCE / PLOTS" title="RSM vs ML — Side-by-Side Plots" subtitle={`How closely each model reproduces the measured ${enzymeName || 'enzyme'} response.`} />
      <ModelNote mlLabel={ml?.label || '—'} rsmError={rsm?.error} />

      <div className="kpi-grid four">
        <Kpi label="RSM · FIT R²" value={rsmEval ? fmt(rsmEval.r2, 4) : '—'} note="Training fit (browser)" icon={Gauge} tone="orange" />
        <Kpi label="ML · FIT R²" value={mlEval ? fmt(mlEval.r2, 4) : '—'} note={ml?.label || ''} icon={Gauge} tone="green" />
        <Kpi label="RSM · FIT RMSE" value={rsmEval ? fmt(rsmEval.rmse) : '—'} note="Lower is better" icon={Activity} tone="orange" />
        <Kpi label="ML · FIT RMSE" value={mlEval ? fmt(mlEval.rmse) : '—'} note="Lower is better" icon={Target} tone="green" />
      </div>

      <div className="grid-2">
        <Card title="Actual vs predicted" subtitle={`Observed ${response} against model prediction. Points on the dashed line are perfect.`} actions={<ExportButton svgRef={parityRef} name="actual-vs-predicted" background={palette.surface} />}>
          <XYChart svgRef={parityRef} series={paritySeries} identity xLabel={`Actual ${response}`} yLabel={`Predicted ${response}`} palette={palette} title="Actual vs predicted" />
        </Card>
        <Card title="Residuals by run" subtitle="Observed minus predicted. Random scatter around zero indicates a well-specified model." actions={<ExportButton svgRef={residRef} name="residuals" background={palette.surface} />}>
          <XYChart svgRef={residRef} series={residSeries} zeroLine xLabel="Run number" yLabel="Residual" palette={palette} title="Residuals" />
        </Card>
      </div>

      <Card title="Run-by-run comparison" subtitle="Which model lands closer to each experimental result." flush>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                {factorNames.map(n => <th key={n}>{n}</th>)}
                <th>Actual</th><th>RSM</th><th>ML</th><th>|Err| RSM</th><th>|Err| ML</th><th>Closer</th>
              </tr>
            </thead>
            <tbody>
              {dataset.X.map((row, i) => {
                const y = dataset.y[i]
                const r = rsmEval ? rsmEval.predicted[i] : NaN
                const m = mlEval ? mlEval.predicted[i] : NaN
                const er = Math.abs(y - r)
                const em = Math.abs(y - m)
                return (
                  <tr key={i}>
                    <td className="muted">{i + 1}</td>
                    {row.map((v, j) => <td key={j} className="num">{showInput(dataset.inputs[j], v)}</td>)}
                    <td className="num strong">{fmt(y)}</td>
                    <td className="num">{fmt(r)}</td>
                    <td className="num">{fmt(m)}</td>
                    <td className="num">{fmt(er)}</td>
                    <td className="num">{fmt(em)}</td>
                    <td>{!Number.isFinite(er) || !Number.isFinite(em) ? <Badge>—</Badge> : Math.abs(er - em) < 1e-9 ? <Badge>Tie</Badge> : er < em ? <Badge tone="rsm">RSM</Badge> : <Badge tone="ml">ML</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
