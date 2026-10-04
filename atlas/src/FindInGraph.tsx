import React, { useState } from 'react'
import type { TranslationDict } from './i18n'

interface FindInGraphProps {
  t: TranslationDict
  nodes: any[]
  onSelectNode: (node: any) => void
}

export const FindInGraph: React.FC<FindInGraphProps> = ({ t, nodes, onSelectNode }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const cleanQ = query.trim().toLowerCase()
  const matches = cleanQ
    ? nodes
        .filter((n) => {
          const lbl = (n.label || '').toLowerCase()
          const syns = (n.synonyms || []).map((s: string) => s.toLowerCase())
          const id = (n.id || '').toLowerCase()
          return lbl.includes(cleanQ) || id.includes(cleanQ) || syns.some((s: string) => s.includes(cleanQ))
        })
        .slice(0, 8)
    : []

  return (
    <div className="find-in-graph-container">
      <input
        type="text"
        className="find-in-graph-input"
        value={query}
        placeholder={t.graph.findInGraphPlaceholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />

      {open && cleanQ.length > 0 && (
        <div className="find-in-graph-dropdown">
          {matches.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 12, color: '#667085' }}>
              {t.graph.noResults}
            </div>
          ) : (
            matches.map((n) => (
              <button
                key={n.id}
                type="button"
                className="find-result-item"
                onClick={() => {
                  onSelectNode(n)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{n.label}</span>
                <span style={{ fontSize: 11, color: '#667085', marginLeft: 8 }}>({n.type})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
