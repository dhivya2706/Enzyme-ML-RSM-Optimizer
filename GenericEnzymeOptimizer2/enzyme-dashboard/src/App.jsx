import React, { useEffect, useMemo, useRef, useState } from 'react'
import api, { uploadDataset, runOptimization } from './services/api'
import { Sidebar, Topbar } from './components/Layout'
import { Notice } from './components/ui'
import Overview from './pages/Overview'
import DataWorkspace from './pages/DataWorkspace'
import Comparison from './pages/Comparison'
import Surfaces from './pages/Surfaces'
import Predictor from './pages/Predictor'
import { buildDataset, guessTarget, parseDatasetFile } from './lib/data'
import { buildMLSurrogate, evaluateOnData, fitRSM, rsmOptimum } from './lib/models'
import { pickBestOverall } from './lib/results'
import { palettes } from './lib/theme'

function downloadTemplate() {
  const csv =
    'Carbon Substrate (%),Nitrogen Source (%),Fermentation Temp (°C),ObservedActivity_U_ml\n'

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'enzyme_dataset_template.csv'
  anchor.click()

  URL.revokeObjectURL(url)
}

const readStored = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
  }
}

export default function App() {
  const [page, setPage] = useState('overview')
  const [theme, setThemeState] = useState(() => readStored('enzyme-theme', 'dark'))
  const [collapsed, setCollapsedState] = useState(() => readStored('enzyme-collapsed', '0') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [apiState, setApiState] = useState('checking')

  const [enzymeName, setEnzymeName] = useState('Cellulase')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [upload, setUpload] = useState(null)
  const [targetColumn, setTargetColumn] = useState('ObservedActivity_U_ml')

  const [uploading, setUploading] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [runId, setRunId] = useState(0)
  const parseToken = useRef(0)

  const palette = palettes[theme] || palettes.dark

  const setTheme = value => { setThemeState(value); writeStored('enzyme-theme', value) }
  const setCollapsed = value => { setCollapsedState(value); writeStored('enzyme-collapsed', value ? '1' : '0') }

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  useEffect(() => {
    let cancelled = false
    api.get('/health')
      .then(() => !cancelled && setApiState('online'))
      .catch(() => !cancelled && setApiState('offline'))
    return () => { cancelled = true }
  }, [])

  async function handleFile(nextFile) {
    setFile(nextFile)
    setUpload(null)
    setResult(null)
    setMessage('')
    setError('')
    setParseError('')
    setParsed(null)
    if (!nextFile) return

    const token = ++parseToken.current
    setParsing(true)
    try {
      const table = await parseDatasetFile(nextFile)
      if (token !== parseToken.current) return
      setParsed(table)
      setTargetColumn(guessTarget(table.columns))
    } catch (err) {
      if (token === parseToken.current) {
        setParseError(
          /\.xls$/i.test(nextFile.name)
            ? 'Old .xls files can be uploaded to the backend, but charts need .xlsx or .csv. Save the sheet as .xlsx to enable surfaces.'
            : `Could not read this file in the browser: ${err.message}`
        )
      }
    } finally {
      if (token === parseToken.current) setParsing(false)
    }
  }

  async function handleUpload() {
    if (!file) {
      setError('Please select a CSV or Excel file.')
      return
    }

    setUploading(true)
    setError('')
    setMessage('')
    setResult(null)

    try {
      const response = await uploadDataset(file)
      const payload = response?.data ?? response

      setUpload(payload)

      const columns = payload.columns || []

      const preferredTarget =
        payload.defaultTargetColumn ||
        (columns.includes('ObservedActivity_U_ml')
          ? 'ObservedActivity_U_ml'
          : columns.find(column => /activity|response|target|yield/i.test(column))) ||
        targetColumn ||
        ''

      setTargetColumn(preferredTarget)
      setMessage(`Dataset uploaded successfully. Rows: ${payload.rowCount ?? '—'}`)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Dataset upload failed.'
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleRun() {
    if (!upload) {
      setError('Upload a dataset before running optimization.')
      setPage('data')
      return
    }

    if (!targetColumn) {
      setError('Please select a target column.')
      setPage('data')
      return
    }

    setRunning(true)
    setError('')
    setMessage('Training ML and RSM models…')
    setResult(null)

    try {
      const response = await runOptimization({ targetColumn })
      const payload = response?.data ?? response

      if (!payload || !Array.isArray(payload.models)) {
        throw new Error('The backend response does not contain a models array.')
      }

      setResult(payload)
      setRunId(id => id + 1)
      setMessage(`Optimization successful. ${payload.rowCount ?? payload.rowsUsed ?? 'Unknown'} rows processed.`)
      setPage('overview')
    } catch (err) {
      console.error('Optimization API error:', err)
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Optimization failed.'
      )
      setMessage('')
    } finally {
      setRunning(false)
    }
  }

  const dataset = useMemo(() => buildDataset(parsed, targetColumn), [parsed, targetColumn])

  const models = useMemo(() => {
    if (!result || !dataset) return null
    const rsm = fitRSM(dataset)
    const ml = buildMLSurrogate(result.bestMLModel?.modelName, dataset, result.bestMLModel?.details)
    return {
      rsm,
      ml,
      rsmEval: rsm.error ? null : evaluateOnData(rsm, dataset),
      mlEval: ml.error ? null : evaluateOnData(ml, dataset),
      rsmOpt: rsm.error ? null : rsmOptimum(rsm, dataset),
    }
  }, [result, dataset])

  const canRun = Boolean(upload && targetColumn)
  const best = pickBestOverall(result?.models)
  const rowsMismatch =
    result && dataset && Number.isFinite(Number(result.rowCount)) && Number(result.rowCount) !== dataset.rowsUsed

  const shared = { result, dataset, models, palette, enzymeName, go: setPage, onRun: handleRun, canRun, running }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        enzymeName={enzymeName}
        fileName={file?.name || upload?.fileName}
        rows={dataset?.rowsUsed ?? upload?.rowCount}
        bestName={best?.modelName}
        canRun={canRun}
        running={running}
        onRun={handleRun}
      />

      <main className={`main-area ${collapsed ? 'rail' : ''}`}>
        <Topbar
          page={page}
          theme={theme}
          setTheme={setTheme}
          apiState={apiState}
          hasResult={Boolean(result)}
          onMenu={() => setMobileOpen(true)}
          onRun={handleRun}
          canRun={canRun}
          running={running}
        />

        <div className="content">
          {message && !error && <Notice tone="ok">{message}</Notice>}
          {error && <Notice tone="warn">{error}</Notice>}
          {rowsMismatch && (
            <Notice tone="warn">
              The backend processed {result.rowCount} rows but the browser read {dataset.rowsUsed}. Charts may differ slightly from backend results.
            </Notice>
          )}

          {page === 'overview' && (
            <Overview {...shared} hasFile={Boolean(file)} />
          )}

          {page === 'data' && (
            <DataWorkspace
              {...shared}
              file={file}
              onFile={handleFile}
              parsed={parsed}
              parsing={parsing}
              parseError={parseError}
              upload={upload}
              uploading={uploading}
              onUpload={handleUpload}
              targetColumn={targetColumn}
              setTargetColumn={setTargetColumn}
              setEnzymeName={setEnzymeName}
              onDownloadTemplate={downloadTemplate}
            />
          )}

          {page === 'comparison' && <Comparison {...shared} />}
          {page === 'surfaces' && <Surfaces key={runId} {...shared} />}
          {page === 'predictor' && <Predictor key={runId} {...shared} />}

          <footer className="app-footer">
            <span>EnzymeML Predictor <b>v1.0</b></span>
            <span>Spring Boot API · {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'}</span>
          </footer>
        </div>
      </main>
    </div>
  )
}
