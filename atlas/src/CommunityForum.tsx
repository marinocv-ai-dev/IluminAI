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
  }[]
}

const SAMPLE_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    nodeId: 'OMIM:108500',
    nodeLabel: 'Episodic Ataxia Type 2',
    nodeType: 'disease',
    title: 'How can newly diagnosed families connect with EA2 support networks?',
    author: 'A parent (example)',
    role: 'family',
    date: 'Yesterday',
    content: 'We received our genetic test result for CACNA1A. Where can we find peer support groups or registered registries for episodic ataxia type 2?',
    answersCount: 1,
    replies: [
      {
        author: 'A patient organization (example)',
        role: 'organization',
        text: 'You can check the Community tab on this disease node in the atlas to find verified patient foundations and active natural history registries.',
        date: '12h ago',
      },
    ],
  },
  {
    id: 'post-2',
    nodeId: 'OMIM:618285',
    nodeLabel: 'Developmental And Epileptic Encephalopathy 69',
    nodeType: 'disease',
    title: 'Are there shared registries for CACNA1E families?',
    author: 'A parent (example)',
    role: 'family',
    date: '2 days ago',
    content: 'Our doctor mentioned CACNA1E is newly characterized. Are patient organizations organizing contact lists or registries for upcoming studies?',
    answersCount: 1,
    replies: [
      {
        author: 'A patient organization (example)',
        role: 'organization',
        text: 'Yes, international family advocacy groups coordinate voluntary contact lists. Inspect the Community tab to see registered initiatives.',
        date: '1 day ago',
      },
    ],
  },
  {
    id: 'post-3',
    nodeId: 'mech:gain-of-function',
    nodeLabel: 'Gain of Function',
    nodeType: 'mechanism',
    title: 'Collaborative interest in functional assays for CACNA1A VUS?',
    author: 'A researcher (example)',
    role: 'researcher',
    date: '3 days ago',
    content: 'We are mapping patch-clamp experimental workflows to distinguish loss versus gain of function in uncharacterized variants. Looking for academic labs interested in protocol alignment.',
    answersCount: 1,
    replies: [
      {
        author: 'A researcher (example)',
        role: 'researcher',
        text: 'We are compiling variant electrophysiology protocols. We recommend checking the Gain of Function node links in the graph for connected literature.',
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

  return (
    <div className="community-forum-overlay">
      <div className="community-forum-card">
        {/* Banner: Design Preview & Disclaimers */}
        <div
          style={{
            background: '#fef3c7',
            color: '#92400e',
            borderBottom: '1px solid #fde68a',
            padding: '10px 16px',
            fontSize: '12.5px',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
          }}
        >
          <span>⚠</span>
          <span>
            {lang === 'es'
              ? 'Vista previa de diseño · Publicaciones ilustrativas. No son usuarios, organizaciones ni afirmaciones médicas reales. El espacio comunitario está en desarrollo.'
              : 'Design preview · Illustrative posts. These are not real users, organizations or medical claims. The community space is in development.'}
          </span>
        </div>

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
                {lang === 'es' ? 'Espacio Seguro (Vista Previa)' : 'Community Space (Preview)'}
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
                      onClick={() => onFocusGraphNode(selectedPost.nodeId)}
                    >
                      🎯 {lang === 'es' ? 'Ver en Grafo 3D' : 'Focus in 3D Graph'}
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
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                          👤 {rep.author}
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>
                            ({rep.role})
                          </span>
                        </span>
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{rep.date}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--navy)', lineHeight: 1.45 }}>
                        {rep.text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Add Reply Composer */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={
                        lang === 'es'
                          ? 'Escribe una respuesta comunitaria ilustrativa…'
                          : 'Write an illustrative community reply…'
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
                  <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 6 }}>
                    ℹ {lang === 'es' ? 'Las publicaciones no se guardan en esta vista previa.' : 'Posts are not saved in this preview.'}
                  </div>
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
