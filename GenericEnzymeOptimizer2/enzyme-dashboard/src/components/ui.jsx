import React from 'react'
import { Info, TriangleAlert, CircleCheck, Download } from 'lucide-react'
import { downloadSvgAsPng } from '../lib/format'

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className = '', flush = false }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'card-body flush' : 'card-body'}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, note, icon: Icon, tone = 'teal' }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={`kpi-icon tone-${tone}`}>{Icon && <Icon size={16} />}</span>
      </div>
      <div className="kpi-value" title={String(value)}>{value}</div>
      <div className={`kpi-note tone-text-${tone}`}>{note}</div>
    </div>
  )
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'seg active' : 'seg'}
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
          title={o.title}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Notice({ tone = 'info', children }) {
  const Icon = tone === 'warn' ? TriangleAlert : tone === 'ok' ? CircleCheck : Info
  return (
    <div className={`notice notice-${tone}`} role={tone === 'warn' ? 'alert' : 'status'}>
      <Icon size={16} />
      <div>{children}</div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <div className="empty-icon"><Icon size={26} /></div>}
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function HBars({ rows, min = 0, max }) {
  const hi = max ?? Math.max(...rows.map(r => r.value), 1e-9)
  const span = hi - min || 1
  return (
    <div className="hbars">
      {rows.map(r => {
        const width = Math.max(0, Math.min(100, ((r.value - min) / span) * 100))
        return (
          <div className="hbar-row" key={r.label}>
            <div className="hbar-label" title={r.label}>{r.label}</div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${width}%`, background: r.color }} />
            </div>
            <div className="hbar-value">{r.display}</div>
          </div>
        )
      })}
    </div>
  )
}

export function Slider({ label, value, min, max, step, onChange, disabled, format }) {
  return (
    <div className={`slider ${disabled ? 'is-disabled' : ''}`}>
      <div className="slider-head">
        <label>{label}</label>
        <output>{format ? format(value) : value}</output>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
      <div className="slider-range"><span>{format ? format(min) : min}</span><span>{format ? format(max) : max}</span></div>
    </div>
  )
}

export function ExportButton({ svgRef, name, background }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => downloadSvgAsPng(svgRef.current, `${name}.png`, background)}
      title="Download this figure as a PNG image"
    >
      <Download size={14} />PNG
    </button>
  )
}
