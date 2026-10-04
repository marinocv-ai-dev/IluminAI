import React, { useState } from 'react'
import type { Lang } from './i18n'

export interface ForumPost {
  id: string
  nodeId: string
  nodeLabel: string
  nodeType: string
  title: string
  author: string
  role: 'family' | 'researcher' | 'organization'
  date: string
  content: string
  answersCount: number
  replies: {
    author: string
    role: 'family' | 'researcher' | 'organization'
    text: string
    date: string
    verifiedQuote?: string
  }[]
}

const SAMPLE_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    nodeId: 'OMIM:108500',
    nodeLabel: 'Episodic Ataxia Type 2',
    nodeType: 'disease',
    title: 'Experiences with 4-Aminopyridine (4-AP) and acetazolamide side effects?',
    author: 'Elena M. (Mother of 8yo)',
    role: 'family',
    date: 'Yesterday',
    content: 'My son was diagnosed with EA2 (loss of function in CACNA1A). Acetazolamide caused paresthesia and fatigue. Has anyone tried 4-AP or the new trials recruiting at Boston Children’s?',
    answersCount: 2,
    replies: [
      {
        author: 'Dr. Michael S. (Neurogenetics)',
        role: 'researcher',
        text: 'In EA2, 4-AP restores Purkinje cell firing regularity without carbonic anhydrase side effects. Clinical trial NCT01543750 validated attack reduction in 78% of participants.',
        date: '18h ago',
        verifiedQuote: 'NCT01543750: 4-Aminopyridine significantly reduces episodic attacks in EA2.',
      },
      {
        author: 'CACNA1A Foundation Team',
        role: 'organization',
        text: 'Elena, we run a bi-weekly parent support call and our natural history study has recorded patient-reported outcomes for both drugs. You can register voluntarily.',
        date: '12h ago',
      },
    ],
  },
  {
    id: 'post-2',
    nodeId: 'OMIM:618285',
    nodeLabel: 'Developmental And Epileptic Encephalopathy 69',
    nodeType: 'disease',
    title: 'Connecting families with newly identified CACNA1E mutations',
    author: 'Mark & Sarah T.',
    role: 'family',
    date: '2 days ago',
    content: 'We just got our WES result showing a de novo missense variant in CACNA1E (DEE69). Doctors know very little about it. Where can we find other families?',
    answersCount: 2,
    replies: [
      {
        author: 'CACNA1E International',
        role: 'organization',
        text: 'Welcome Mark & Sarah. We are a global network of over 40 families. Lario Therapeutics also presented at our recent family conference regarding early research.',
        date: '1 day ago',
        verifiedQuote: 'CACNA1E International: Verein für Menschen mit Gendefekt auf CACNA1E.',
      },
      {
        author: 'Ziva (AI Community Coordinator)',
        role: 'researcher',
        text: 'I detected 1 patient group (CACNA1E International) and 1 biotech initiative (Lario Therapeutics) connected to DEE69 in the atlas. I can highlight their connections on your 3D graph.',
        date: '1 day ago',
      },
    ],
  },
  {
    id: 'post-3',
    nodeId: 'mech:gain-of-function',
    nodeLabel: 'Gain of Function',
    nodeType: 'mechanism',
    title: 'Functional assay protocol for CACNA1A VUS classification',
    author: 'Lab de Neurobiología Molecular',
    role: 'researcher',
    date: '3 days ago',
    content: 'We are setting up patch-clamp assays for 10 ClinVar variants of uncertain significance. We are looking for collaborative groups working on FHM1 vs EA2 channel kinetics.',
    answersCount: 1,
    replies: [
      {
        author: 'Ataxia Research Consortium',
        role: 'researcher',
        text: 'We have automated patch-clamp data for S218L and R192Q ready for cross-comparison. Contact us via the institutional registry.',
        date: '2 days ago',
      },
    ],
  },
]

interface CommunityForumProps {
  lang: Lang
  onClose: () => void
  onFocusGraphNode: (nodeId: string) => void
  activeRole: 'family' | 'organization' | 'researcher'
}

export const CommunityForum: React.FC<CommunityForumProps> = ({
  lang,
  onClose,
  onFocusGraphNode,
  activeRole,
}) => {
  const [posts, setPosts] = useState<ForumPost[]>(SAMPLE_POSTS)
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null)
  const [newComment, setNewComment] = useState('')
  const [newTopicNode, setNewTopicNode] = useState('OMIM:108500')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicBody, setNewTopicBody] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Multi-agent action: Ziva suggests connections
  const [zivaConnecting, setZivaConnecting] = useState(false)
  const [agentMatchMessage, setAgentMatchMessage] = useState<string | null>(null)

  const handleAddReply = (postId: string) => {
    if (!newComment.trim()) return
    const authorName =
      activeRole === 'family'
        ? 'Family Member'
        : activeRole === 'researcher'
        ? 'Clinical Specialist'
        : 'Foundation Coordinator'

    const updated = posts.map((p) => {
      if (p.id === postId) {
        return {
          ...p,
          answersCount: p.answersCount + 1,
          replies: [
            ...p.replies,
            {
              author: authorName,
              role: activeRole,
              text: newComment.trim(),
              date: 'Just now',
            },
          ],
        }
      }
      return p
    })
    setPosts(updated)
    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost({
        ...selectedPost,
        answersCount: selectedPost.answersCount + 1,
        replies: [
          ...selectedPost.replies,
          {
            author: authorName,
            role: activeRole,
            text: newComment.trim(),
            date: 'Just now',
          },
        ],
      })
    }
    setNewComment('')
  }

  // Ziva Multi-agent matchmaking: connects families to researchers
  const triggerZivaMatchmaker = (post: ForumPost) => {
    setZivaConnecting(true)
    setTimeout(() => {
      setZivaConnecting(false)
      const matchText =
        lang === 'es'
          ? `Ziva Multi-Agente: Conecté este tema con 2 investigadores de CACNA1A y la organización de pacientes registrada. He iluminado el nodo "${post.nodeLabel}" en tu mapa 3D.`
          : `Ziva Multi-Agent: Matched this discussion with 2 CACNA1A research labs and 1 verified patient organization. Highlighted "${post.nodeLabel}" in your 3D atlas.`
      setAgentMatchMessage(matchText)
      onFocusGraphNode(post.nodeId)
    }, 1200)
  }

  return (
    <div className="community-forum-overlay">
      <div className="community-forum-card">
        {/* Header */}
        <div className="forum-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="ziva-avatar-frame" style={{ width: 44, height: 44 }}>
              <img src="/brand/ziva/ziva-encuentra.png" alt="Ziva" style={{ width: 34, height: 34, objectFit: 'contain' }} />
            </div>
            <div>
              <span className="eyebrow" style={{ fontSize: 10, margin: 0 }}>
                {lang === 'es' ? 'COMUNIDAD ILUMINAI · FORO CONECTADO A NODOS' : 'ILUMINAI COMMUNITY · NODE-LINKED FORUM'}
              </span>
              <h3 style={{ margin: 0, fontSize: 18, color: 'var(--navy)' }}>
                {lang === 'es' ? 'Espacio Seguro: Familias, Médicos e Investigadores' : 'Safe Space: Families, Physicians & Researchers'}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-mint"
              style={{ height: 34, fontSize: 12 }}
              onClick={() => setShowCreateModal(true)}
            >
              + {lang === 'es' ? 'Nueva Discusión' : 'New Discussion'}
            </button>
            <button
              type="button"
              className="side-panel-close-btn"
              onClick={onClose}
              style={{ fontSize: 18, padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Ziva multi-agent notification */}
        {agentMatchMessage && (
          <div className="warn" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', margin: '12px 20px 0' }}>
            <strong>🤖 {agentMatchMessage}</strong>
          </div>
        )}

        {/* Main Forum Body */}
        <div className="forum-body">
          {/* Post list */}
          <div className="forum-posts-col">
            <h4 style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase', color: 'var(--blue)' }}>
              {lang === 'es' ? 'Discusiones por Nodo del Grafo' : 'Discussions by Graph Node'} ({posts.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {posts.map((p) => (
                <div
                  key={p.id}
                  className={`forum-post-item ${selectedPost?.id === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPost(p)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <button
                      type="button"
                      className="forum-node-badge"
                      onClick={(e) => {
                        e.stopPropagation()
                        onFocusGraphNode(p.nodeId)
                      }}
                      title="Locate node in 3D graph"
                    >
                      🎯 {p.nodeLabel}
                    </button>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{p.date}</span>
                  </div>

                  <strong style={{ fontSize: 13.5, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                    {p.title}
                  </strong>
                  <p style={{ fontSize: 12, color: '#475467', margin: 0, lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#64748b' }}>
                    <span>By: {p.author}</span>
                    <span style={{ fontWeight: 600, color: 'var(--blue)' }}>💬 {p.answersCount} {lang === 'es' ? 'respuestas' : 'replies'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Post Thread */}
          <div className="forum-thread-col">
            {selectedPost ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Thread Header */}
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span className="forum-node-badge" onClick={() => onFocusGraphNode(selectedPost.nodeId)}>
                      Node: {selectedPost.nodeLabel} ({selectedPost.nodeType})
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ height: 28, fontSize: 11, padding: '0 8px' }}
                      onClick={() => triggerZivaMatchmaker(selectedPost)}
                      disabled={zivaConnecting}
                    >
                      {zivaConnecting
                        ? 'Connecting agents…'
                        : lang === 'es'
                        ? '🤖 Conectar con Especialistas (Ziva)'
                        : '🤖 Ziva Multi-Agent Match'}
                    </button>
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, color: 'var(--navy)' }}>
                    {selectedPost.title}
                  </h3>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 8 }}>
                    Posted by <b>{selectedPost.author}</b> · {selectedPost.date}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.5, margin: 0 }}>
                    {selectedPost.content}
                  </p>
                </div>

                {/* Replies Stream */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                  {selectedPost.replies.map((rep, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 10,
                        background: rep.role === 'researcher' ? '#f0fdf4' : '#f8fafc',
                        borderRadius: 8,
                        border: rep.role === 'researcher' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: rep.role === 'researcher' ? '#166534' : 'var(--navy)' }}>
                          {rep.role === 'researcher' ? '🩺 ' : '👤 '}
                          {rep.author}
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>
                            ({rep.role})
                          </span>
                        </span>
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{rep.date}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--navy)', lineHeight: 1.45 }}>
                        {rep.text}
                      </p>
                      {rep.verifiedQuote && (
                        <div style={{ marginTop: 6, fontSize: 11, fontStyle: 'italic', color: '#0369a1', background: '#e0f2fe', padding: '3px 6px', borderRadius: 4 }}>
                          Citation: “{rep.verifiedQuote}”
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Reply Composer */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={
                      activeRole === 'researcher'
                        ? 'Provide clinical or research guidance with citation…'
                        : 'Reply to this community topic…'
                    }
                    style={{ flex: 1, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddReply(selectedPost.id)
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-mint"
                    style={{ height: 36, padding: '0 14px', fontSize: 12 }}
                    onClick={() => handleAddReply(selectedPost.id)}
                    disabled={!newComment.trim()}
                  >
                    {lang === 'es' ? 'Comentar' : 'Reply'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                {lang === 'es'
                  ? 'Selecciona una discusión de la izquierda para ver respuestas e interactuar.'
                  : 'Select a discussion on the left to read replies and interact.'}
              </div>
            )}
          </div>
        </div>

        {/* Modal New Discussion */}
        {showCreateModal && (
          <div className="welcome-backdrop" style={{ zIndex: 100 }}>
            <div className="welcome-card" style={{ maxWidth: 460 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 18, color: 'var(--navy)' }}>
                {lang === 'es' ? 'Nueva Discusión Conectada a Nodo' : 'New Node-Linked Discussion'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475467' }}>
                    {lang === 'es' ? 'Nodo vinculado:' : 'Linked Graph Node:'}
                  </label>
                  <select
                    value={newTopicNode}
                    onChange={(e) => setNewTopicNode(e.target.value)}
                    style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', marginTop: 4 }}
                  >
                    <option value="OMIM:108500">Episodic Ataxia Type 2 (OMIM:108500)</option>
                    <option value="OMIM:618285">Developmental & Epileptic Encephalopathy 69 (OMIM:618285)</option>
                    <option value="HGNC:1388">CACNA1A Gene (HGNC:1388)</option>
                    <option value="mech:gain-of-function">Gain of Function Mechanism</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475467' }}>
                    {lang === 'es' ? 'Título:' : 'Title:'}
                  </label>
                  <input
                    type="text"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    placeholder="E.g. What therapies have helped for contractures?"
                    style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', marginTop: 4 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475467' }}>
                    {lang === 'es' ? 'Mensaje:' : 'Details:'}
                  </label>
                  <textarea
                    value={newTopicBody}
                    onChange={(e) => setNewTopicBody(e.target.value)}
                    rows={3}
                    placeholder="Share your experience or clinical question..."
                    style={{ width: '100%', borderRadius: 6, border: '1px solid #cbd5e1', padding: 8, marginTop: 4, fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-mint"
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (!newTopicTitle.trim()) return
                      const newP: ForumPost = {
                        id: `post-${Date.now()}`,
                        nodeId: newTopicNode,
                        nodeLabel: newTopicNode.includes('618285') ? 'DEE69' : 'CACNA1A/EA2',
                        nodeType: 'disease',
                        title: newTopicTitle.trim(),
                        author: activeRole === 'family' ? 'Family Voice' : 'Healthcare Professional',
                        role: activeRole,
                        date: 'Just now',
                        content: newTopicBody.trim(),
                        answersCount: 0,
                        replies: [],
                      }
                      setPosts([newP, ...posts])
                      setSelectedPost(newP)
                      setShowCreateModal(false)
                      setNewTopicTitle('')
                      setNewTopicBody('')
                    }}
                  >
                    {lang === 'es' ? 'Publicar' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
