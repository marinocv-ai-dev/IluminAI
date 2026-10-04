import React from 'react'
import type { TranslationDict } from './i18n'
import { BRAND, TAG } from './Graph3D'

export type SideTab = 'evidence' | 'community' | 'missing' | 'review'

interface SidePanelProps {
  t: TranslationDict
  activeTab: SideTab
  onTabChange: (tab: SideTab) => void
  onClose: () => void
  evidence: any
  selectedDisease: any // node obj
  diseaseGaps: any // from gaps.json
  allGaps: any
  allNodes: any[]
  allLinks: any[]
  reviewQueueData: any
  onReplayDee69: () => void
  activeRole: 'family' | 'organization' | 'researcher'
}

const idOf = (x: any) => (typeof x === 'object' ? x.id : x)

export const SidePanel: React.FC<SidePanelProps> = ({
  t,
  activeTab,
  onTabChange,
  onClose,
  evidence,
  selectedDisease,
  diseaseGaps,
  allGaps,
  allNodes,
  allLinks,
  reviewQueueData,
  onReplayDee69,
  activeRole,
}) => {
  // Derive community nodes for the selected disease: patient_group and company
  const diseaseId = selectedDisease ? selectedDisease.id : null
  const connectedOrgLinks = diseaseId
    ? allLinks.filter(
        (l) =>
          (idOf(l.source) === diseaseId || idOf(l.target) === diseaseId) &&
          (l.type === 'registry_for' || l.type === 'investigates' || l.type === 'supports')
      )
    : []

  const connectedOrgNodes = connectedOrgLinks.map((l) => {
    const otherId = idOf(l.source) === diseaseId ? idOf(l.target) : idOf(l.source)
    const nodeObj = allNodes.find((n) => n.id === otherId)
    return {
      node: nodeObj || { id: otherId, label: otherId, type: 'org' },
      edge: l,
    }
  })

  const patientGroups = connectedOrgNodes.filter(
    (item) => item.node.type === 'patient_group' || item.node.id?.startsWith('org:') && item.node.type !== 'company'
  )
  const companies = connectedOrgNodes.filter((item) => item.node.type === 'company')

  return (
    <aside className="side-panel-wrap">
      {/* Tabs Bar */}
      <div className="side-panel-tabs">
        <button
          type="button"
          className={`side-tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => onTabChange('evidence')}
        >
          {t.panels.tabs.evidence}
        </button>
        <button
          type="button"
          className={`side-tab-btn ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => onTabChange('community')}
        >
          {t.panels.tabs.community}
        </button>
        <button
          type="button"
          className={`side-tab-btn ${activeTab === 'missing' ? 'active' : ''}`}
          onClick={() => onTabChange('missing')}
        >
          {t.panels.tabs.missing}
        </button>
        {activeRole === 'researcher' && (
          <button
            type="button"
            className={`side-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => onTabChange('review')}
          >
            {t.panels.tabs.review} ({reviewQueueData?.count ?? 43})
          </button>
        )}
        <button
          type="button"
          className="side-panel-close-btn"
          onClick={onClose}
          title="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="side-panel-content">
        {/* TAB 1: EVIDENCE */}
        {activeTab === 'evidence' && (
          <div>
            {!evidence ? (
              <p style={{ color: '#5b6b7c', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                {t.panels.evidence.empty}
              </p>
            ) : (
              <div>
                <p className="eyebrow">
                  {TAG[allNodes.find((n) => n.id === idOf(evidence.source))?.type] ?? ''} ·{' '}
                  {t.panels.evidence.connection}
                </p>
                <h3 style={{ margin: '0 0 6px', fontSize: 20 }}>
                  {evidence.type.replace(/_/g, ' ')}
                </h3>
                <p style={{ fontSize: 13, color: '#475467', margin: '0 0 12px' }}>
                  <b>{evidence.status}</b> · {t.panels.evidence.confidence(Math.round(evidence.confidence * 100))}
                </p>

                {evidence.status === 'contributed' && (
                  <p className="warn" style={{ background: '#eef4fa', color: '#1E6091', border: '1px solid #c5d3e0' }}>
                    {t.panels.evidence.contributed}
                  </p>
                )}
                {evidence.needs_review && (
                  <p className="warn" style={{ background: '#fdf1d6', color: '#b45309', border: '1px solid #fcd34d' }}>
                    {t.panels.evidence.needsReview}
                  </p>
                )}
                {evidence.review && (
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 10,
                      background: evidence.review.verdict === 'disputed' ? '#fdf1d6' : '#dcfce7',
                      color: evidence.review.verdict === 'disputed' ? '#b45309' : '#166534',
                    }}
                  >
                    {t.panels.evidence.expertReviewed(evidence.review.by, evidence.review.date)}
                  </div>
                )}

                {evidence.evidence?.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 13.5, margin: '0 0 4px', lineHeight: 1.45 }}>
                      <a href={e.url} target="_blank" rel="noreferrer" style={{ color: BRAND.blue }}>
                        {e.source}
                      </a>{' '}
                      —{' '}
                      {e.quote ? (
                        `“${e.quote}”`
                      ) : (
                        <span style={{ color: '#b45309', fontStyle: 'italic' }}>
                          {t.panels.evidence.noQuoteYet}
                        </span>
                      )}
                    </p>
                    {e.verified_verbatim && (
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: '#dcfce7',
                          color: '#166534',
                        }}
                      >
                        {t.panels.evidence.quoteExtractedBy(e.extracted_by || 'OpenAI')}
                      </div>
                    )}
                  </div>
                ))}

                {evidence.contradicts?.length > 0 && (
                  <p className="warn">⚠ {t.panels.evidence.contradicts}: {evidence.contradicts.join(', ')}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMMUNITY */}
        {activeTab === 'community' && (
          <div>
            {!selectedDisease ? (
              <p style={{ color: '#5b6b7c', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                {t.panels.community.empty}
              </p>
            ) : (
              <div>
                <p className="eyebrow">{selectedDisease.id}</p>
                <h3 style={{ margin: '0 0 12px', fontSize: 20 }}>{selectedDisease.label}</h3>

                {/* Patient Groups */}
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--blue)', margin: '0 0 8px' }}>
                    {t.panels.community.patientGroups} ({patientGroups.length})
                  </h4>
                  {patientGroups.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: '#667085', margin: 0 }}>None connected in graph.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {patientGroups.map((pg, idx) => {
                        const quote = pg.edge.evidence?.[0]?.quote
                        const url = pg.edge.evidence?.[0]?.url
                        return (
                          <div key={idx} style={{ padding: '8px 10px', background: '#ffffff', borderRadius: 8, border: '1px solid #dde5ee' }}>
                            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 13 }}>{pg.node.label}</div>
                            {quote && <p style={{ fontSize: 12, color: '#475467', margin: '4px 0', fontStyle: 'italic' }}>“{quote}”</p>}
                            {url && (
                              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>
                                {t.panels.community.visit} →
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Biotech Initiatives */}
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--blue)', margin: '0 0 8px' }}>
                    {t.panels.community.companies} ({companies.length})
                  </h4>
                  {companies.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: '#667085', margin: 0 }}>None connected in graph.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {companies.map((co, idx) => {
                        const quote = co.edge.evidence?.[0]?.quote
                        const url = co.edge.evidence?.[0]?.url
                        return (
                          <div key={idx} style={{ padding: '8px 10px', background: '#ffffff', borderRadius: 8, border: '1px solid #dde5ee' }}>
                            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 13 }}>{co.node.label}</div>
                            {quote && <p style={{ fontSize: 12, color: '#475467', margin: '4px 0', fontStyle: 'italic' }}>“{quote}”</p>}
                            {url && (
                              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>
                                {t.panels.community.visit} →
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Shared Space Mockup banner */}
                <div style={{ padding: '12px 14px', background: 'var(--navy)', color: '#fff', borderRadius: 10, marginTop: 16 }}>
                  <span className="eyebrow" style={{ color: 'var(--mint)', fontSize: 10, margin: '0 0 4px', display: 'block' }}>
                    {t.panels.community.cardTitle}
                  </span>
                  <p style={{ fontSize: 12.5, margin: '0 0 8px', color: '#e4e7ec' }}>
                    {t.panels.community.cardSubtitle}
                  </p>
                  <span style={{ fontSize: 11, color: 'var(--mint)', fontWeight: 700 }}>
                    {t.panels.community.cardAction}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WHAT'S MISSING */}
        {activeTab === 'missing' && (
          <div>
            {!selectedDisease ? (
              <p style={{ color: '#5b6b7c', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                {t.panels.missing.empty}
              </p>
            ) : (
              <div>
                <p className="eyebrow">{selectedDisease.id} · GAPS</p>
                <h3 style={{ margin: '0 0 12px', fontSize: 20 }}>{selectedDisease.label}</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', margin: '0 0 16px', fontSize: 13 }}>
                  {[
                    ['animal_model', 'Animal model'],
                    ['cell_model', 'Cell model'],
                    ['registry_or_group', 'Registry / group'],
                    ['natural_history', 'Natural history'],
                    ['trial', 'Clinical trial'],
                    ['treatment', 'Known therapy'],
                    ['researcher', 'Lead researcher'],
                  ].map(([key, label]) => {
                    const present = diseaseGaps?.present ? diseaseGaps.present[key] : false
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: present ? BRAND.mint : '#8FB3D1', fontWeight: 800, fontSize: 15 }}>
                          {present ? '✓' : '✗'}
                        </span>
                        <span style={{ color: present ? BRAND.navy : '#667085' }}>{label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* VUS banner */}
                {(diseaseGaps?.vus_count || allGaps?.cacna1a_vus?.vus_count) && (
                  <div style={{ margin: '0 0 14px', padding: '8px 10px', background: '#fdf1d6', borderRadius: 6, fontSize: 12.5, color: '#b45309', border: '1px solid #fcd34d' }}>
                    <strong>{diseaseGaps?.vus_count || allGaps?.cacna1a_vus?.vus_count} CACNA1A variants of uncertain significance in ClinVar:</strong> functional effect (LoF/GoF) unknown.{' '}
                    <a
                      href={diseaseGaps?.vus_query_url || allGaps?.cacna1a_vus?.vus_query_url || allGaps?.cacna1a_vus?.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#b45309', textDecoration: 'underline' }}
                    >
                      View in ClinVar
                    </a>
                  </div>
                )}

                <p style={{ fontSize: 11.5, color: '#5b6b7c', lineHeight: 1.4, margin: '0 0 14px' }}>
                  {t.panels.missing.notSearchedNote}
                </p>

                <button
                  type="button"
                  className="btn btn-mint"
                  style={{ width: '100%', height: 34, fontSize: 12 }}
                  onClick={onReplayDee69}
                >
                  {t.panels.missing.runAgentBtn}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REVIEW QUEUE */}
        {activeTab === 'review' && (
          <div>
            <p className="eyebrow">{t.panels.review.eyebrow}</p>
            <h3 style={{ margin: '0 0 8px', fontSize: 20 }}>{t.panels.review.title}</h3>
            <p style={{ fontSize: 13, color: '#475467', lineHeight: 1.45, margin: '0 0 14px' }}>
              {t.panels.review.explanation}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', paddingRight: 2 }}>
              {reviewQueueData?.items?.map((item: any, idx: number) => (
                <div key={idx} style={{ padding: '8px 10px', background: '#ffffff', borderRadius: 8, border: '1px solid #dde5ee', fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 3 }}>
                    <span>{item.source_label}</span>
                    <span style={{ color: 'var(--blue)', margin: '0 4px', fontWeight: 500 }}>
                      → {item.type.replace(/_/g, ' ')} →
                    </span>
                    <span>{item.target_label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#667085', marginBottom: 5 }}>
                    {item.reason}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {item.source_url ? (
                      <a href={item.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--blue)', textDecoration: 'underline' }}>
                        {t.panels.review.viewSource}
                      </a>
                    ) : (
                      <span style={{ fontSize: 11.5, color: '#98a2b3' }}>{t.panels.review.noSource}</span>
                    )}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        disabled
                        title={t.panels.review.tooltip}
                        style={{ padding: '2px 6px', fontSize: 10.5, fontWeight: 600, borderRadius: 4, border: '1px solid #d0d5dd', background: '#f2f4f7', color: '#98a2b3', cursor: 'not-allowed' }}
                      >
                        {t.panels.review.confirm}
                      </button>
                      <button
                        type="button"
                        disabled
                        title={t.panels.review.tooltip}
                        style={{ padding: '2px 6px', fontSize: 10.5, fontWeight: 600, borderRadius: 4, border: '1px solid #d0d5dd', background: '#f2f4f7', color: '#98a2b3', cursor: 'not-allowed' }}
                      >
                        {t.panels.review.dispute}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
