import React, { useEffect, useRef, useState } from 'react'
import type { Lang, TranslationDict } from './i18n'

export type ZivaMood = 'tranquila' | 'escuchando' | 'pensando' | 'encuentra' | 'incertidumbre' | 'saluda'

export interface ZivaMessage {
  id: string
  from: 'user' | 'ziva'
  tag?: string // 'DEMO' | 'AGENT RUN'
  text?: string
  steps?: {
    say: string
    isWarn?: boolean
    links?: any[]
  }[]
  mechanismWarning?: string
  nextStep?: string
  unclear?: string
  linksCount?: number
  sourcesCount?: number
}

interface ZivaChatProps {
  lang: Lang
  t: TranslationDict
  mood: ZivaMood
  messages: ZivaMessage[]
  busy: boolean
  isReplaying: boolean
  onSend: (text: string) => void
  onStop: () => void
  onSuggestionClick: (text: string) => void
  onWatchDemo: () => void
}

const MOOD_ASSETS: Record<ZivaMood, string> = {
  tranquila: '/brand/ziva/ziva-tranquila.png',
  escuchando: '/brand/ziva/ziva-escuchando.png',
  pensando: '/brand/ziva/ziva-pensando.png',
  encuentra: '/brand/ziva/ziva-encuentra.png',
  incertidumbre: '/brand/ziva/ziva-incertidumbre.png',
  saluda: '/brand/ziva/ziva-saluda.png',
}

export const ZivaChat: React.FC<ZivaChatProps> = ({
  lang,
  t,
  mood,
  messages,
  busy,
  isReplaying,
  onSend,
  onStop,
  onSuggestionClick,
  onWatchDemo,
}) => {
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, busy])

  // Setup Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = lang === 'es' ? 'es-MX' : 'en-US'
      rec.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript
        if (transcript) {
          setInput(transcript)
          onSend(transcript)
        }
        setListening(false)
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      recognitionRef.current = rec
    } else {
      setSpeechSupported(false)
    }
  }, [lang, onSend])

  const toggleMic = () => {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      recognitionRef.current.lang = lang === 'es' ? 'es-MX' : 'en-US'
      recognitionRef.current.start()
      setListening(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !busy && !isReplaying) {
        onSend(input.trim())
        setInput('')
      }
    }
  }

  const moodLabel =
    mood === 'saluda'
      ? t.ziva.greeting
      : mood === 'escuchando'
      ? t.ziva.listening
      : mood === 'pensando'
      ? t.ziva.thinking
      : mood === 'encuentra'
      ? t.ziva.found
      : mood === 'incertidumbre'
      ? t.ziva.uncertain
      : t.ziva.ready

  return (
    <aside className="ziva-col">
      {/* Header Ziva */}
      <div className="ziva-header">
        <div className="ziva-avatar-frame">
          <img
            src={MOOD_ASSETS[mood]}
            alt="Ziva"
            className="ziva-avatar-img"
          />
        </div>
        <div className="ziva-header-meta">
          <span className="eyebrow" style={{ margin: 0, fontSize: 10 }}>{t.ziva.guideEyebrow}</span>
          <div className="ziva-name-state">
            <span style={{ fontWeight: 800, color: 'var(--navy)' }}>Ziva</span>
            <span className="ziva-state-pill">· {moodLabel}</span>
          </div>
        </div>
      </div>

      {/* Messages / Conversation flow */}
      <div className="ziva-scroll" ref={chatScrollRef}>
        {messages.length === 0 ? (
          <div className="ziva-empty-state">
            <h3 style={{ fontSize: 20, color: 'var(--navy)', margin: '0 0 8px' }}>
              {t.chat.emptyTitle}
            </h3>
            <p style={{ fontSize: 13.5, color: '#5b6b7c', lineHeight: 1.5, margin: '0 0 16px' }}>
              {t.chat.emptySubtitle}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {t.chat.suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  className="ziva-suggestion-btn"
                  onClick={() => onSuggestionClick(sug)}
                  disabled={busy || isReplaying}
                >
                  <span style={{ color: 'var(--mint)', fontWeight: 700, marginRight: 6 }}>›</span>
                  {sug}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #dde5ee' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', borderColor: 'var(--blue)', color: 'var(--blue)', background: '#fff' }}
                onClick={onWatchDemo}
                disabled={busy || isReplaying}
              >
                {t.menu.watchDemo}
              </button>
            </div>
          </div>
        ) : (
          <div className="ziva-messages-list">
            {messages.map((m) => {
              if (m.from === 'user') {
                return (
                  <div key={m.id} className="user-bubble-container">
                    <span className="eyebrow" style={{ fontSize: 10, color: '#667085' }}>{t.chat.yourQuestion}</span>
                    <div className="user-bubble">{m.text}</div>
                  </div>
                )
              }

              return (
                <div key={m.id} className="ziva-card-response">
                  {m.tag && (
                    <div className="ziva-tag-pill">
                      {m.tag}
                    </div>
                  )}

                  {m.text && <div className="ziva-text-body">{m.text}</div>}

                  {m.steps && m.steps.length > 0 && (
                    <ol className="ziva-steps-ol">
                      {m.steps.map((st, i) => (
                        <li key={i} className="ziva-step-item">
                          <div className={st.isWarn ? 'warn' : ''} style={{ fontSize: 14, color: 'var(--navy)' }}>
                            {st.say}
                          </div>
                          {st.links && st.links.length > 0 && (
                            <div className="ziva-step-chips">
                              {st.links.filter((l: any) => l.status === 'observed').length > 0 && (
                                <span className="chip-pill chip-mint">● observed</span>
                              )}
                              {st.links.filter((l: any) => l.status === 'extracted').length > 0 && (
                                <span className="chip-pill chip-blue">● from paper</span>
                              )}
                              {st.links.filter((l: any) => l.status === 'inferred').length > 0 && (
                                <span className="chip-pill chip-light">● hypothesis</span>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}

                  {m.mechanismWarning && (
                    <div className="warn" style={{ marginTop: 10 }}>
                      <strong>⚠ {t.chat.mechanismWarningTitle}:</strong> {m.mechanismWarning}
                    </div>
                  )}

                  {m.nextStep && (
                    <div className="ziva-next-step-box">
                      <span className="eyebrow" style={{ color: 'var(--navy)', margin: '0 0 4px', fontSize: 10 }}>
                        {t.chat.nextStepTitle}
                      </span>
                      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--navy)' }}>{m.nextStep}</p>
                    </div>
                  )}

                  {m.unclear && (
                    <details className="ziva-unclear-details">
                      <summary className="eyebrow" style={{ cursor: 'pointer', outline: 'none' }}>
                        {t.chat.unclearTitle}
                      </summary>
                      <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#5b6b7c' }}>{m.unclear}</p>
                    </details>
                  )}

                  <div className="ziva-foot-chips">
                    {m.steps && m.steps.length > 0 && (
                      <span className="chip-counter">{t.chat.stepsCount(m.steps.length)}</span>
                    )}
                    <span className="chip-counter">✓ {t.chat.verifiableSources}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Composer bottom */}
      <div className="ziva-composer-wrap">
        {isReplaying ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>
              Playing simulation…
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginLeft: 'auto', height: 34, borderColor: '#fcd34d', color: '#b45309' }}
              onClick={onStop}
            >
              {t.menu.stop}
            </button>
          </div>
        ) : (
          <>
            <div className="ziva-input-box">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.chat.placeholder}
                rows={2}
                disabled={busy}
              />
              <div className="ziva-input-actions">
                {speechSupported && (
                  <button
                    type="button"
                    className={`mic-btn ${listening ? 'mic-active' : ''}`}
                    onClick={toggleMic}
                    title="Dictate with voice"
                    disabled={busy}
                  >
                    🎤
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-mint"
                  style={{ height: 32, padding: '0 12px', fontSize: 12 }}
                  onClick={() => {
                    if (input.trim()) {
                      onSend(input.trim())
                      setInput('')
                    }
                  }}
                  disabled={busy || !input.trim()}
                >
                  {busy ? '…' : t.chat.send}
                </button>
              </div>
            </div>
            <p className="ziva-disclaimer">{t.chat.educationalDisclaimer}</p>
          </>
        )}
      </div>
    </aside>
  )
}
