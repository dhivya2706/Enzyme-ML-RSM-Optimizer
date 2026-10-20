import React from 'react'
import { Notice } from './ui'

export default function ModelNote({ mlLabel, rsmError }) {
  return (
    <Notice tone="info">
      Curves and surfaces on this page are drawn in your browser from the uploaded data. The <b>RSM</b> is the same quadratic least-squares model the backend fits.
      The <b>ML</b> curve re-implements the backend's best model (<b>{mlLabel}</b>) as a close approximation, so use the cross-validated metrics on the Overview page as the authoritative scores.
      {rsmError ? <> <b>RSM unavailable:</b> {rsmError}</> : null}
    </Notice>
  )
}
