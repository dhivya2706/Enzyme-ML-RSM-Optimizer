import React from 'react'
import {
  LayoutDashboard, Database, GitCompare, Box, SlidersHorizontal, Play, Sun, Moon,
  PanelLeftClose, PanelLeftOpen, Menu, X, FlaskConical, Activity, Loader2,
} from 'lucide-react'

export const NAV = [
  { id: 'overview', label: 'Overview', hint: 'Model leaderboard', icon: LayoutDashboard },
  { id: 'data', label: 'Data Workspace', hint: 'Upload & configure', icon: Database },
  { id: 'comparison', label: 'RSM vs ML Plots', hint: 'Fit & residuals', icon: GitCompare },
  { id: 'surfaces', label: 'Response Surfaces', hint: '3D & contour maps', icon: Box },
  { id: 'predictor', label: 'Live Predictor', hint: 'Optimum & what-if', icon: SlidersHorizontal },
]

export function Sidebar({
  page, setPage, collapsed, setCollapsed, mobileOpen, setMobileOpen,
  enzymeName, fileName, rows, bestName, canRun, running, onRun,
}) {
  const go = id => { setPage(id); setMobileOpen(false) }
  return (
    <>
      {mobileOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`} aria-label="Primary">
        <div className="brand">
          <div className="brand-mark"><FlaskConical size={20} /></div>
          <div className="brand-copy">
            <div className="brand-name">Enzyme<span>ML</span></div>
            <div className="brand-sub">OPTIMIZATION STUDIO</div>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={16} /></button>
        </div>

        <div className="side-label">WORKSPACE</div>
        <div className="workspace-card" title={enzymeName}>
          <div className="workspace-icon"><FlaskConical size={16} /></div>
          <div className="workspace-copy">
            <b>{enzymeName || 'Enzyme'}</b>
            <small>{fileName ? fileName : 'No dataset loaded'}</small>
          </div>
        </div>

        <div className="side-label">ANALYTICS</div>
        <nav className="nav">
          {NAV.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => go(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} />
                <span className="nav-copy">
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="side-bottom">
          <div className="run-card">
            <div className="run-stats">
              <div><small>Rows</small><b>{rows ?? '—'}</b></div>
              <div><small>Best model</small><b title={bestName}>{bestName || '—'}</b></div>
            </div>
            <button className="btn btn-primary btn-block" onClick={onRun} disabled={!canRun || running}>
              {running ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
              <span>{running ? 'Running…' : 'Run ML + RSM'}</span>
            </button>
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            <span>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export function Topbar({ page, theme, setTheme, apiState, hasResult, onMenu, onRun, canRun, running }) {
  const current = NAV.find(n => n.id === page)
  const apiLabel = apiState === 'online' ? 'API online' : apiState === 'offline' ? 'API offline' : 'Checking API…'
  return (
    <header className="topbar">
      <div className="top-left">
        <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Open menu"><Menu size={18} /></button>
        <div>
          <div className="eyebrow">ENZYME OPTIMIZATION <span>/</span> {current?.label?.toUpperCase()}</div>
          <div className="top-title">{current?.label}</div>
        </div>
      </div>
      <div className="top-actions">
        <div className={`pill pill-${apiState}`}><span className="dot" />{apiLabel}</div>
        <div className={`pill ${hasResult ? 'pill-online' : ''}`}><Activity size={13} />{hasResult ? 'Live results' : 'Awaiting run'}</div>
        <button className="btn btn-primary btn-sm hide-sm" onClick={onRun} disabled={!canRun || running}>
          {running ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
          <span>{running ? 'Running…' : 'Run'}</span>
        </button>
        <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" title="Toggle light / dark theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
