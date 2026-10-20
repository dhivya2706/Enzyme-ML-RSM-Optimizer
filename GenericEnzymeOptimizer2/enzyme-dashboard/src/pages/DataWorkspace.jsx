import React, { useState } from 'react'
import { CircleCheck, Database, Download, FileSpreadsheet, Loader2, Play, Upload } from 'lucide-react'
import { Badge, Card, Notice, PageHeader, Select } from '../components/ui'
import { fmt } from '../lib/format'

function Step({ n, title, text, state }) {
  return (
    <div className={`step step-${state}`}>
      <div className="step-n">{state === 'done' ? <CircleCheck size={15} /> : n}</div>
      <div><b>{title}</b><small>{text}</small></div>
    </div>
  )
}

export default function DataWorkspace({
  file, onFile, parsed, parsing, parseError, upload, uploading, onUpload,
  targetColumn, setTargetColumn, enzymeName, setEnzymeName, dataset,
  onDownloadTemplate, onRun, canRun, running, result,
}) {
  const [dragging, setDragging] = useState(false)
  const columns = parsed?.columns || upload?.columns || []
  const previewRows = parsed?.rows?.slice(0, 10) || []

  const drop = e => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <>
      <PageHeader
        eyebrow="DATA / WORKSPACE"
        title="Data Workspace"
        subtitle="Load your design-of-experiments table, choose the measured response, and send it to the backend."
        actions={<button className="btn btn-primary" onClick={onRun} disabled={!canRun || running}>{running ? <Loader2 size={15} className="spin" /> : <Play size={15} />}{running ? 'Running models…' : 'Run ML + RSM'}</button>}
      />

      <div className="steps">
        <Step n="1" title="Choose file" text="CSV, XLS or XLSX" state={file ? 'done' : 'active'} />
        <Step n="2" title="Upload to backend" text="Stores the dataset for training" state={upload ? 'done' : file ? 'active' : 'idle'} />
        <Step n="3" title="Run ML + RSM" text="Cross-validated comparison" state={result ? 'done' : upload ? 'active' : 'idle'} />
      </div>

      <div className="grid-2 uneven">
        <Card title="Experiment" subtitle="Labels used across charts and reports.">
          <label className="field">
            <span>Target enzyme name</span>
            <input type="text" value={enzymeName} onChange={e => setEnzymeName(e.target.value)} placeholder="e.g. Cellulase" />
          </label>
          {columns.length > 0 ? (
            <Select
              label="Target (response) column"
              value={targetColumn}
              onChange={setTargetColumn}
              options={[{ value: '', label: 'Select a column…' }, ...columns.map(c => ({ value: c, label: c }))]}
            />
          ) : (
            <p className="hint">Choose a file to pick the measured response column.</p>
          )}
        </Card>

        <Card title="Experimental dataset" subtitle="XLSX, XLS or CSV — first row must be column headers.">
          <label
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          >
            <input type="file" accept=".csv,.xls,.xlsx" onChange={e => onFile(e.target.files?.[0] || null)} />
            <div className="dropzone-icon"><FileSpreadsheet size={22} /></div>
            <div className="dropzone-copy">
              <b>{file ? file.name : 'Drop a file here, or click to browse'}</b>
              <small>{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Used to train and evaluate the models'}</small>
            </div>
            <span className="link">Browse</span>
          </label>
          <div className="row-actions">
            <button className="btn btn-ghost btn-sm" onClick={onDownloadTemplate}><Download size={14} />Download template</button>
            <button className="btn btn-secondary btn-sm" onClick={onUpload} disabled={!file || uploading}>
              {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}{uploading ? 'Uploading…' : upload ? 'Re-upload' : 'Upload dataset'}
            </button>
          </div>
          {parsing && <p className="hint">Reading file…</p>}
          {parseError && <Notice tone="warn">{parseError}</Notice>}
          {upload && <Notice tone="ok">Uploaded to backend — {upload.rowCount ?? '—'} rows, {(upload.columns || []).length} columns.</Notice>}
        </Card>
      </div>

      {dataset && (
        <>
          <div className="kpi-grid four">
            <div className="stat"><small>Valid rows</small><b>{dataset.rowsUsed}</b><span>of {dataset.totalRows} in file</span></div>
            <div className="stat"><small>Input factors</small><b>{dataset.inputs.length}</b><span>{dataset.inputs.filter(i => i.type === 'numeric').length} numeric · {dataset.inputs.filter(i => i.type === 'categorical').length} categorical</span></div>
            <div className="stat"><small>Response</small><b className="mono-sm" title={dataset.targetColumn}>{dataset.targetColumn}</b><span>min {fmt(Math.min(...dataset.y))} · max {fmt(Math.max(...dataset.y))}</span></div>
            <div className="stat"><small>Response mean</small><b>{fmt(dataset.y.reduce((a, b) => a + b, 0) / dataset.y.length)}</b><span>across {dataset.rowsUsed} runs</span></div>
          </div>

          <Card title="Detected factors" subtitle="Inputs the backend will use (IDs, coded and prediction columns are excluded)." flush>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Factor</th><th>Type</th><th>Min</th><th>Max</th><th>Mean / levels</th></tr></thead>
                <tbody>
                  {dataset.inputs.map(inp => (
                    <tr key={inp.name}>
                      <td>{inp.name}</td>
                      <td><Badge tone={inp.type === 'numeric' ? 'ml' : 'rsm'}>{inp.type}</Badge></td>
                      <td className="num">{inp.type === 'numeric' ? fmt(inp.min, 3) : '—'}</td>
                      <td className="num">{inp.type === 'numeric' ? fmt(inp.max, 3) : '—'}</td>
                      <td className="num">{inp.type === 'numeric' ? fmt(inp.mean, 3) : inp.categories.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {previewRows.length > 0 && (
        <Card title="Data preview" subtitle={`First ${previewRows.length} of ${parsed.rows.length} rows`} flush>
          <div className="table-scroll">
            <table className="table">
              <thead><tr>{columns.map(c => <th key={c} className={c === targetColumn ? 'target-col' : ''}>{c}{c === targetColumn ? ' ★' : ''}</th>)}</tr></thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i}>{columns.map(c => <td key={c} className={c === targetColumn ? 'num target-col' : 'num'}>{r[c]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!file && !upload && (
        <Card>
          <div className="empty compact">
            <div className="empty-icon"><Database size={24} /></div>
            <h3>No dataset yet</h3>
            <p>Use the template to see the expected layout, or drop in your own experiment results.</p>
          </div>
        </Card>
      )}
    </>
  )
}
