import React from 'react'
import type { Lang, TranslationDict } from './i18n'

interface WelcomeModalProps {
  t: TranslationDict
  lang: Lang
  onSelectRole: (role: 'family' | 'organization' | 'researcher') => void
  onDismiss: () => void
  onToggleLang: () => void
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  t,
  lang,
  onSelectRole,
  onDismiss,
  onToggleLang,
}) => {
  return (
    <div className="welcome-backdrop">
      <div className="welcome-card">
        {/* Top brand & language */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <img src="/brand/logo-light.png" alt="IluminAI" style={{ height: 36, objectFit: 'contain' }} />
          <button
            type="button"
            className="lang-switch-btn"
            onClick={onToggleLang}
          >
            {lang === 'en' ? 'ES' : 'EN'}
          </button>
        </div>

        {/* Ziva Host Intro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
          <div className="ziva-avatar-frame" style={{ width: 52, height: 52 }}>
            <img src="/brand/ziva/ziva-saluda.png" alt="Ziva" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          </div>
          <div>
            <span className="eyebrow" style={{ fontSize: 10, margin: 0 }}>
              {lang === 'es' ? 'BIENVENIDO AL ATLAS' : 'WELCOME TO THE ATLAS'}
            </span>
            <h3 style={{ margin: '2px 0 4px', fontSize: 18, color: 'var(--navy)' }}>
              {lang === 'es' ? 'Conoce a Ziva, tu guía de evidencia' : "Meet Ziva, your evidence guide"}
            </h3>
            <p style={{ margin: 0, fontSize: 12.5, color: '#5b6b7c', lineHeight: 1.4 }}>
              {lang === 'es'
                ? 'Conectamos investigación biomédica, datos genómicos y redes de apoyo sin alucinaciones.'
                : 'Connecting biomedical research, genomics, and patient support networks with zero hallucinations.'}
            </p>
          </div>
        </div>

        {/* Role selection */}
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--blue)', margin: '0 0 10px', letterSpacing: '0.05em' }}>
            {lang === 'es' ? '¿Cómo deseas explorar hoy?' : 'How would you like to explore today?'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <button
              type="button"
              className="welcome-role-btn"
              onClick={() => {
                onSelectRole('family')
                onDismiss()
              }}
            >
              <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>🏠</span>
              <strong>{t.roles.family}</strong>
              <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                {lang === 'es' ? 'Lenguaje claro y apoyo comunitario' : 'Plain language & family networks'}
              </span>
            </button>

            <button
              type="button"
              className="welcome-role-btn"
              onClick={() => {
                onSelectRole('organization')
                onDismiss()
              }}
            >
              <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>🤝</span>
              <strong>{t.roles.organization}</strong>
              <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                {lang === 'es' ? 'Mapeo de gaps y alianzas' : 'Gap mapping & partnerships'}
              </span>
            </button>

            <button
              type="button"
              className="welcome-role-btn"
              onClick={() => {
                onSelectRole('researcher')
                onDismiss()
              }}
            >
              <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>🔬</span>
              <strong>{t.roles.researcher}</strong>
              <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                {lang === 'es' ? 'Genómica, ensayos y revisión médica' : 'Genomics, trials & expert review'}
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '12px 14px', background: '#f1f5f9', borderRadius: 10, marginBottom: 20, fontSize: 12 }}>
          <div>
            <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 2 }}>
              {lang === 'es' ? '1. Grafo 3D' : '1. 3D Graph'}
            </strong>
            <span style={{ color: '#475467' }}>
              {lang === 'es' ? 'Ontologías oficiales y biología interactiva.' : 'Official ontologies and interactive biology.'}
            </span>
          </div>
          <div>
            <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 2 }}>
              {lang === 'es' ? '2. IA con OpenAI' : '2. OpenAI Powered'}
            </strong>
            <span style={{ color: '#475467' }}>
              {lang === 'es' ? 'Graph-RAG estricto con alertas de seguridad.' : 'Strict Graph-RAG with safety mechanism alerts.'}
            </span>
          </div>
          <div>
            <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: 2 }}>
              {lang === 'es' ? '3. Comunidad y Expertos' : '3. Community & Experts'}
            </strong>
            <span style={{ color: '#475467' }}>
              {lang === 'es' ? 'Foro nodo a nodo y revisión clínica humana.' : 'Node-linked forum & human expert review.'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="btn btn-mint"
          style={{ width: '100%', height: 42, fontSize: 14, fontWeight: 700 }}
          onClick={onDismiss}
        >
          {lang === 'es' ? 'Entrar al Atlas' : 'Enter the Atlas'} →
        </button>
      </div>
    </div>
  )
}
