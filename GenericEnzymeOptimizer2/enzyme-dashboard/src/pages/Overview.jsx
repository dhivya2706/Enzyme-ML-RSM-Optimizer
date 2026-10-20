import React, { useState } from 'react'
import { Activity, Database, Gauge, Play, Sparkles, Target, TrendingUp, Trophy, Upload, Zap, FlaskConical } from 'lucide-react'
import { Badge, Card, EmptyState, HBars, Kpi, PageHeader, Segmented, Notice } from '../components/ui'
import { fmt, percent } from '../lib/format'
import { isAnn, isRsm, namedParameters, pickBestOverall, rankModels } from '../lib/results'

const METRICS = [
  { value: 'r2', label: 'R²' },
  { value: 'rmse', label: 'RMSE' },
  { value: 'mae', label: 'MAE' },
]

function Winner({ a, b, higherBetter }) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return <Badge>—</Badge>
  if (a === b) return <Badge>Tie</Badge>
  const rsmWins = higherBetter ? a > b : a < b
  return rsmWins ? <Badge tone="rsm">RSM</Badge> : <Badge tone="ml">ML</Badge>
}

export default function Overview({ result, dataset, go, onRun, canRun, running, palette, hasFile }) {
  const [metric, setMetric] = useState('r2')

  if (!result) {
    return (
      <>
        <PageHeader
          eyebrow="MODEL PERFORMANCE / OVERVIEW"
          title="RSM vs. Machine Learning"
          subtitle="Compare response-surface and machine-learning models on your experimental dataset."
        />
        <Card>
          <EmptyState
            icon={FlaskConical}
            title="Ready to optimize"
            text="Upload your dataset, confirm the target column, then run the backend to train and cross-validate every model."
            action={(
              <div className="empty-actions">
                <button className="btn btn-secondary" onClick={() => go('data')}><Upload size={15} />{hasFile ? 'Review dataset' : 'Upload dataset'}</button>
                <button className="btn btn-primary" onClick={onRun} disabled={!canRun || running}><Play size={15} />Run ML + RSM</button>
              </div>
            )}
          />
        </Card>
      </>
    )
  }

  const models = result.models || []
  const best = pickBestOverall(models)
  const bestML = result.bestMLModel
  const rsm = result.rsmModel
  const ranked = rankModels(models)
  const optimum = result.mlOptimum
  const params = namedParameters(optimum?.parameters || [], dataset)
  const rowCount = result.rowCount ?? result.rowsUsed

  const barRows = ranked.map(m => {
    const v = Number(m[metric])
    const color = isRsm(m) ? palette.rsm : isAnn(m) ? palette.ann : m.modelName === bestML?.modelName ? palette.ml : palette.muted
    return { label: m.modelName, value: metric === 'r2' ? Math.max(0, v) : v, display: metric === 'r2' ? fmt(v, 4) : fmt(v, 2), color }
  })
  const ordered = metric === 'r2' ? barRows : [...barRows].sort((a, b) => a.value - b.value)

  return (
    <>
      <PageHeader
        eyebrow="MODEL PERFORMANCE / OVERVIEW"
        title="RSM vs. Machine Learning"
        subtitle="Cross-validated metrics returned by your Java ML / RSM backend."
        actions={<button className="btn btn-primary" onClick={onRun} disabled={!canRun || running}><Play size={15} />{running ? 'Running models…' : 'Re-run'}</button>}
      />

      <div className="hero">
        <div className="hero-icon"><Sparkles size={22} /></div>
        <div className="hero-copy">
          <div className="hero-tag">LIVE BACKEND RESULTS</div>
          <h2>{best?.modelName || 'Optimization completed'}</h2>
          <p>
            Design: <b>{result.design || 'Not specified'}</b> · Target: <b>{result.targetColumn || '—'}</b> · Rows: <b>{rowCount ?? '—'}</b>
          </p>
        </div>
        <div className="hero-stat">
          <small>BEST OVERALL R²</small>
          <b>{percent(best?.r2)}</b>
          <span>cross-validated</span>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="BEST OVERALL MODEL" value={best?.modelName || '—'} note="Highest cross-validated R²" icon={Trophy} tone="teal" />
        <Kpi label="R² (DETERMINATION)" value={fmt(best?.r2, 4)} note="Higher is better" icon={Gauge} tone="green" />
        <Kpi label="RMSE" value={fmt(best?.rmse)} note="Lower is better" icon={Activity} tone="purple" />
        <Kpi label="MEAN ABS. ERROR" value={fmt(best?.mae)} note="Lower is better" icon={Target} tone="orange" />
        <Kpi label="BEST ML MODEL" value={bestML?.modelName || '—'} note={`R² ${fmt(bestML?.r2, 4)}`} icon={TrendingUp} tone="cyan" />
        <Kpi label="DATASET ROWS" value={String(rowCount ?? '—')} note="Processed by backend" icon={Database} tone="teal" />
      </div>

      <div className="grid-2">
        <Card title="Head-to-head: RSM vs best ML" subtitle="Cross-validated on the same folds (5-fold, seed 42).">
          {rsm && bestML ? (
            <div className="table-scroll"><table className="table compact">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th><span className="legend-dot" style={{ background: palette.rsm }} />RSM Quadratic</th>
                  <th><span className="legend-dot" style={{ background: palette.ml }} />{bestML.modelName}</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>R²</td><td className="num">{fmt(rsm.r2, 4)}</td><td className="num">{fmt(bestML.r2, 4)}</td><td><Winner a={Number(rsm.r2)} b={Number(bestML.r2)} higherBetter /></td></tr>
                <tr><td>RMSE</td><td className="num">{fmt(rsm.rmse)}</td><td className="num">{fmt(bestML.rmse)}</td><td><Winner a={Number(rsm.rmse)} b={Number(bestML.rmse)} /></td></tr>
                <tr><td>MAE</td><td className="num">{fmt(rsm.mae)}</td><td className="num">{fmt(bestML.mae)}</td><td><Winner a={Number(rsm.mae)} b={Number(bestML.mae)} /></td></tr>
              </tbody>
            </table></div>
          ) : (
            <Notice tone="info">
              The backend did not evaluate an RSM for this dataset{result.design ? ` (detected design: ${result.design})` : ''}. RSM needs three numeric factors in a design suited to quadratic modelling, so only machine-learning models are compared here.
            </Notice>
          )}
        </Card>

        <Card title="Optimum candidate" subtitle="Best factor settings found by the ML model (5,000-point search).">
          {optimum ? (
            <>
              <div className="optimum-value">
                <small>PREDICTED RESPONSE</small>
                <b>{fmt(optimum.predictedActivity)}</b>
              </div>
              <div className="chips">
                {params.map(p => (
                  <span className="chip" key={p.name}>{p.name}<b>{p.display}</b></span>
                ))}
              </div>
              <p className="hint"><Zap size={13} /> Verify factor ranges and units before running a confirmation experiment.</p>
            </>
          ) : <Notice tone="info">No ML optimum was returned.</Notice>}
        </Card>
      </div>

      <Card
        title="Model leaderboard"
        subtitle="Every model the adaptive strategy evaluated."
        actions={<Segmented label="Metric" options={METRICS} value={metric} onChange={setMetric} />}
      >
        <div className="legend-row">
          <span><i style={{ background: palette.rsm }} />RSM</span>
          <span><i style={{ background: palette.ml }} />Best ML</span>
          <span><i style={{ background: palette.muted }} />Other ML</span>
        </div>
        <HBars rows={ordered} min={0} max={metric === 'r2' ? 1 : undefined} />
      </Card>

      {result.annModel && (
        <Card title="Neural network (ANN)" subtitle="Feed-forward network trained with back-propagation; its architecture and training length were chosen by cross-validation.">
          <div className="chips">
            {result.annModel.details?.hiddenLayers != null && <span className="chip">Hidden layers<b>{result.annModel.details.hiddenLayers}</b></span>}
            {result.annModel.details?.learningRate != null && <span className="chip">Learning rate<b>{result.annModel.details.learningRate}</b></span>}
            {result.annModel.details?.momentum != null && <span className="chip">Momentum<b>{result.annModel.details.momentum}</b></span>}
            {result.annModel.details?.epochs != null && <span className="chip">Epochs<b>{result.annModel.details.epochs}</b></span>}
            <span className="chip">CV R²<b>{fmt(result.annModel.r2, 4)}</b></span>
            <span className="chip">CV RMSE<b>{fmt(result.annModel.rmse)}</b></span>
          </div>
          <p className="hint">
            <Badge tone="ann">ANN</Badge> With only a few experimental runs a neural network can over-fit. Judge it by the cross-validated R² and RMSE, not by how closely it reproduces the training data. Use the Live Predictor page to get ANN predictions for any factor setting.
          </p>
        </Card>
      )}

      <Card title="Model training results" subtitle="Sorted by R² (higher is better)." flush>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>#</th><th>Model</th><th>R²</th><th>RMSE</th><th>MAE</th><th>Status</th></tr></thead>
            <tbody>
              {ranked.map((m, i) => (
                <tr key={m.modelName || i}>
                  <td className="muted">{i + 1}</td>
                  <td>{m.modelName}</td>
                  <td className="num">{fmt(m.r2, 4)}</td>
                  <td className="num">{fmt(m.rmse)}</td>
                  <td className="num">{fmt(m.mae)}</td>
                  <td>
                    {m.modelName === best?.modelName ? <Badge tone="ml">Best overall</Badge>
                      : m.modelName === bestML?.modelName ? <Badge tone="ml">Best ML</Badge>
                      : isRsm(m) ? <Badge tone="rsm">RSM</Badge>
                      : isAnn(m) ? <Badge tone="ann">ANN</Badge>
                      : <Badge>Evaluated</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <details className="raw">
        <summary>Raw backend response</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </>
  )
}
