function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] || ''
  const counts = { ',': 0, ';': 0, '\t': 0 }
  for (const ch of firstLine) if (ch in counts) counts[ch]++
  const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]

  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function tableToRows(table) {
  const nonEmpty = table.filter(r => r.some(c => String(c ?? '').trim() !== ''))
  if (nonEmpty.length < 2) throw new Error('The file has no data rows.')
  const columns = nonEmpty[0].map((c, i) => String(c ?? '').trim() || `Column ${i + 1}`)
  const rows = nonEmpty.slice(1).map(r => {
    const obj = {}
    columns.forEach((c, i) => { obj[c] = String(r[i] ?? '').trim() })
    return obj
  })
  return { columns, rows }
}

export async function parseDatasetFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return tableToRows(parseCSV(await file.text()))

  const mod = await import('xlsx')
  const XLSX = mod.default || mod
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const table = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  return tableToRows(table)
}

const isIdentifier = column => {
  const c = column.toLowerCase().replace(/[_\- ]/g, '')
  return ['id', 'run', 'std', 'index', 'no', 'number', 'experiment', 'trial', 'sampleid', 'sample'].includes(c)
}

const isNumericColumn = (rows, column) => {
  let valid = 0
  let numeric = 0
  for (const row of rows) {
    const v = (row[column] ?? '').trim()
    if (v === '') continue
    valid++
    if (Number.isFinite(Number(v))) numeric++
  }
  return valid > 0 && numeric >= Math.max(1, Math.floor(valid / 2))
}

export function guessTarget(columns) {
  if (columns.includes('ObservedActivity_U_ml')) return 'ObservedActivity_U_ml'
  return columns.find(c => /activity|response|target|yield/i.test(c)) || columns[columns.length - 1] || ''
}

export function buildDataset(parsed, targetColumn) {
  if (!parsed || !targetColumn) return null
  const { columns, rows } = parsed
  if (!columns.includes(targetColumn) || !isNumericColumn(rows, targetColumn)) return null

  const inputs = []
  for (const column of columns) {
    if (column.toLowerCase() === targetColumn.toLowerCase()) continue
    const lower = column.toLowerCase()
    if (lower.endsWith('_coded') || lower.includes('predicted') || lower.includes('prediction')) continue
    if (isIdentifier(column)) continue

    if (isNumericColumn(rows, column)) inputs.push({ name: column, type: 'numeric' })
    else {
      const categories = [...new Set(rows.map(r => (r[column] ?? '').trim()).filter(Boolean))]
      if (categories.length >= 2) inputs.push({ name: column, type: 'categorical', categories })
    }
  }
  if (!inputs.length) return null

  const X = []
  const y = []
  for (const row of rows) {
    const vec = []
    let ok = true
    for (const input of inputs) {
      const raw = (row[input.name] ?? '').trim()
      if (raw === '') { ok = false; break }
      if (input.type === 'numeric') {
        const n = Number(raw)
        if (!Number.isFinite(n)) { ok = false; break }
        vec.push(n)
      } else vec.push(input.categories.indexOf(raw))
    }
    const t = (row[targetColumn] ?? '').trim()
    if (!ok || t === '' || !Number.isFinite(Number(t))) continue
    X.push(vec)
    y.push(Number(t))
  }
  if (X.length < 2) return null

  inputs.forEach((input, j) => {
    const col = X.map(r => r[j])
    input.min = Math.min(...col)
    input.max = Math.max(...col)
    input.mean = col.reduce((a, b) => a + b, 0) / col.length
    if (input.type === 'categorical') {
      const counts = new Array(input.categories.length).fill(0)
      col.forEach(v => counts[v]++)
      input.mode = counts.indexOf(Math.max(...counts))
    }
  })

  return { inputs, X, y, targetColumn, rowsUsed: X.length, totalRows: rows.length }
}
