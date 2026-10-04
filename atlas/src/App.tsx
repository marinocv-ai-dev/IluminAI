import { useEffect, useRef, useState } from 'react'
import Graph3D, { type Highlight } from './Graph3D'
import { buildContext } from './subgraph'
import { i18n, type Lang } from './i18n'
import { ZivaChat, type ZivaMood, type ZivaMessage } from './ZivaChat'
import { SidePanel, type SideTab } from './SidePanel'
import { FindInGraph } from './FindInGraph'
import { WelcomeModal } from './WelcomeModal'
import { CommunityForum } from './CommunityForum'

type Step = {
  say: string
  say_es?: string
  nodes: string[]
  links: string[]
  focus: string
  isWarn?: boolean
}

// Scripted demo on the real graph with loyal Mexican Spanish translations (say_es)
const DEMO: Step[] = [
  {
    say: 'Your child has episodic ataxia type 2. Let us start there.',
    say_es: 'Tu hijo tiene ataxia episódica tipo 2. Empecemos por ahí.',
    nodes: ['OMIM:108500'],
    links: [],
    focus: 'OMIM:108500',
  },
  {
    say: 'It comes from the CACNA1A gene, which builds a calcium channel in nerve cells.',
    say_es: 'Proviene del gen CACNA1A, que forma un canal de calcio en las neuronas.',
    nodes: ['OMIM:108500', 'HGNC:1388'],
    links: [],
    focus: 'HGNC:1388',
  },
  {
    say: 'The same gene causes other conditions with different names: hemiplegic migraine, spinocerebellar ataxia 6 and an early epilepsy.',
    say_es: 'El mismo gen causa otras condiciones con diferentes nombres: migraña hemipléjica, ataxia espinocerebelosa 6 y una epilepsia temprana.',
    nodes: ['HGNC:1388', 'OMIM:108500', 'OMIM:141500', 'OMIM:183086', 'OMIM:617106'],
    links: [],
    focus: 'HGNC:1388',
  },
  {
    say: 'Careful: in your case the channel lets too little calcium in. In hemiplegic migraine it lets in too much. A therapy for one could harm the other.',
    say_es: 'Cuidado: en tu caso el canal deja pasar muy poco calcio. En la migraña hemipléjica deja pasar demasiado. Una terapia para una podría perjudicar la otra.',
    nodes: ['OMIM:108500', 'mech:loss-of-function', 'OMIM:141500', 'mech:gain-of-function'],
    links: [],
    focus: 'mech:loss-of-function',
  },
  {
    say: 'Mouse models already exist for both conditions: tottering and leaner mice for your condition, and a knock-in mouse for hemiplegic migraine. Researchers do not have to start from zero.',
    say_es: 'Ya existen modelos de ratón para ambas condiciones: ratones tottering y leaner para tu condición, y un ratón knock-in para migraña hemipléjica. Los investigadores no tienen que empezar de cero.',
    nodes: ['asset:tottering-mouse-model', 'asset:leaner-mouse-model', 'OMIM:108500', 'asset:r192q-knockin-mouse', 'OMIM:141500'],
    links: [],
    focus: 'asset:tottering-mouse-model',
  },
  {
    say: 'A phase 3 trial is recruiting right now, and it pools three CACNA1A conditions in one study: ataxia type 6, your condition, and hemiplegic migraine.',
    say_es: 'Un ensayo de fase 3 está reclutando ahora mismo, y agrupa tres condiciones de CACNA1A en un solo estudio: ataxia tipo 6, tu condición y migraña hemipléjica.',
    nodes: ['NCT07221292', 'OMIM:183086', 'OMIM:108500', 'OMIM:141500'],
    links: [],
    focus: 'NCT07221292',
  },
  {
    say: 'The CACNA1A Foundation also runs a natural history study with Dr. Wendy Chung. That data is what future trials will need.',
    say_es: 'La Fundación CACNA1A también lleva a cabo un estudio de historia natural con la Dra. Wendy Chung. Esos datos son lo que necesitarán futuros ensayos.',
    nodes: ['org:cacna1a-foundation', 'asset:cacna1a-natural-history-study', 'person:wendy-chung'],
    links: [],
    focus: 'asset:cacna1a-natural-history-study',
  },
  {
    say: 'CACNA1E belongs to the same calcium channel family. Mouse models built for CACNA1A could inform research on it. This is a hypothesis that needs expert review.',
    say_es: 'CACNA1E pertenece a la misma familia de canales de calcio. Los modelos de ratón creados para CACNA1A podrían orientar la investigación en él. Esta es una hipótesis que requiere revisión experta.',
    nodes: ['HGNC:1392', 'asset:tottering-mouse-model', 'HGNC:1388'],
    links: [],
    focus: 'HGNC:1392',
  },
  {
    say: 'Next step this week: ask your neurologist whether your child is eligible for the trial, and enroll in the foundation natural history study.',
    say_es: 'Siguiente paso esta semana: pregúntale a tu neurólogo si tu hijo es elegible para el ensayo, e inscríbete en el estudio de historia natural de la fundación.',
    nodes: ['NCT07221292', 'asset:cacna1a-natural-history-study', 'OMIM:108500'],
    links: [],
    focus: 'NCT07221292',
  },
]

const EMPTY: Highlight = { nodes: new Set(), links: new Set() }
const idOf = (x: any) => (typeof x === 'object' ? x.id : x)

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('iluminai_lang') as Lang) || 'en'
  })
  const t = i18n[lang]

  const [graph, setGraph] = useState<{ nodes: any[]; links: any[] } | null>(null)
  const [hl, setHl] = useState<Highlight>(EMPTY)
  const [role, setRole] = useState<'family' | 'organization' | 'researcher'>('family')
  const [evidence, setEvidence] = useState<any>(null)
  const [selectedDisease, setSelectedDisease] = useState<any>(null)
  const [gapsData, setGapsData] = useState<any>(null)
  const [reviewQueueData, setReviewQueueData] = useState<any>(null)

  // Ziva States
  const [mood, setMood] = useState<ZivaMood>('saluda')
  const [messages, setMessages] = useState<ZivaMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)

  // Right Side Panel Tabs
  const [activeTab, setActiveTab] = useState<SideTab>('evidence')
  const [panelOpen, setPanelOpen] = useState(false)

  // Modals & Menus
  const [showWelcome, setShowWelcome] = useState(false)
  const [showForum, setShowForum] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Mobile active view: 'chat' | 'graph' | 'panel'
  const [mobileView, setMobileView] = useState<'chat' | 'graph' | 'panel'>('graph')

  // Graph column dimensions
  const graphColRef = useRef<HTMLElement | null>(null)
  const [graphDims, setGraphDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  const originalGraphRef = useRef<{ nodes: any[]; links: any[] } | null>(null)
  const abortReplayRef = useRef(false)

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang)
    localStorage.setItem('iluminai_lang', newLang)
  }

  // ResizeObserver for graph dimensions (P5)
  useEffect(() => {
    if (!graphColRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setGraphDims({ width: Math.round(width), height: Math.round(height) })
        }
      }
    })
    ro.observe(graphColRef.current)
    return () => ro.disconnect()
  }, [])

  // Initial greeting 2s -> ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setMood('tranquila')
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  // Load initial graph & data
  useEffect(() => {
    fetch('/data/graph.json')
      .then((r) => r.json())
      .then((g) => {
        setGraph(g)
        originalGraphRef.current = JSON.parse(JSON.stringify(g))
      })
    fetch('/data/gaps.json')
      .then((r) => r.json())
      .then(setGapsData)
      .catch(() => {})
    fetch('/data/review_queue.json')
      .then((r) => r.json())
      .then(setReviewQueueData)
      .catch(() => {})
  }, [])

  // Speech helper
  const speak = (text: string) =>
    new Promise<void>((res) => {
      if (abortReplayRef.current) return res()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang === 'es' || /[áéíóúñ¿¡]/i.test(text) ? 'es-MX' : 'en-US'
      u.onend = u.onerror = () => res()
      speechSynthesis.speak(u)
    })

  // ?step=N shows demo step N without voice (for video verification)
  useEffect(() => {
    const n = Number(new URLSearchParams(location.search).get('step'))
    if (!graph || !n || !DEMO[n - 1]) return
    const s = DEMO[n - 1]
    const nodes = new Set(s.nodes)
    const between = graph.links
      .filter((l) => nodes.has(idOf(l.source)) && nodes.has(idOf(l.target)))
      .map((l) => l.id)

    const timer = setTimeout(() => {
      setHl({ nodes, links: new Set(between), focus: s.focus })
      const demoSteps = DEMO.slice(0, n).map((d) => ({
        say: lang === 'es' && d.say_es ? d.say_es : d.say,
        isWarn: false,
        links: graph.links.filter(
          (l) =>
            d.links?.includes(l.id) ||
            (d.nodes.includes(idOf(l.source)) && d.nodes.includes(idOf(l.target)))
        ),
      }))

      setMessages([
        {
          id: 'step-demo',
          from: 'ziva',
          tag: 'DEMO',
          steps: demoSteps,
        },
      ])
      setMood('encuentra')
    }, 4500)
    return () => clearTimeout(timer)
  }, [graph, lang])

  // ?run=slug replay agent expansion run without voice
  const runOnce = useRef(false)
  useEffect(() => {
    const runSlug = new URLSearchParams(location.search).get('run')
    if (!graph || !runSlug || runOnce.current) return
    const tTimer = setTimeout(() => {
      runOnce.current = true
      replayRun(runSlug, false)
    }, 2000)
    return () => clearTimeout(tTimer)
  }, [graph])

  // STOP Action
  const handleStop = () => {
    abortReplayRef.current = true
    speechSynthesis.cancel()
    setIsReplaying(false)
    setBusy(false)
    setMood('tranquila')
  }

  // RESET Action
  const handleReset = () => {
    handleStop()
    setHl(EMPTY)
    setMessages([])
    setEvidence(null)
    setSelectedDisease(null)
    setPanelOpen(false)
    if (originalGraphRef.current) {
      setGraph(JSON.parse(JSON.stringify(originalGraphRef.current)))
    }
  }

  // Play fixed DEMO script
  const playDemo = async () => {
    if (!graph || isReplaying) return
    abortReplayRef.current = false
    setIsReplaying(true)
    setMood('pensando')
    speechSynthesis.cancel()

    const demoMsgId = `demo-${Date.now()}`
    const accumulatedSteps: { say: string; isWarn?: boolean; links?: any[] }[] = []

    setMessages((prev) => [
      ...prev,
      {
        id: demoMsgId,
        from: 'ziva',
        tag: 'DEMO',
        steps: [],
      },
    ])

    for (let i = 0; i < DEMO.length; i++) {
      if (abortReplayRef.current) break
      const s = DEMO[i]
      const nodes = new Set(s.nodes)
      const between = graph.links
        .filter((l) => nodes.has(idOf(l.source)) && nodes.has(idOf(l.target)))
        .map((l) => l.id)
      const stepLinks = new Set([...s.links, ...between])
      setHl({ nodes, links: stepLinks, focus: s.focus })

      const textToSpeak = lang === 'es' && s.say_es ? s.say_es : s.say
      const activeObjs = graph.links.filter((l) => stepLinks.has(l.id))
      accumulatedSteps.push({ say: textToSpeak, isWarn: !!s.isWarn, links: activeObjs })

      setMessages((prev) =>
        prev.map((m) => (m.id === demoMsgId ? { ...m, steps: [...accumulatedSteps] } : m))
      )

      await speak(textToSpeak)
      if (!abortReplayRef.current) {
        await new Promise((r) => setTimeout(r, 600))
      }
    }

    setMood('encuentra')
    setIsReplaying(false)
  }

  // Replay Agent Expansion Run (e.g. DEE69)
  const replayRun = async (slug: string, withVoice: boolean = true) => {
    try {
      abortReplayRef.current = false
      setIsReplaying(true)
      setMood('pensando')
      speechSynthesis.cancel()

      const res = await fetch(`/data/runs/${slug}.json`)
      if (!res.ok) {
        setIsReplaying(false)
        setMood('tranquila')
        return
      }
      const runData = await res.json()
      if (!runData?.events) {
        setIsReplaying(false)
        setMood('tranquila')
        return
      }

      const agentMsgId = `agent-${Date.now()}`
      const accumulatedSteps: { say: string; isWarn?: boolean; links?: any[] }[] = []

      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          from: 'ziva',
          tag: 'AGENT RUN',
          steps: [],
        },
      ])

      const accumNodes = new Set<string>()
      const accumLinks = new Set<string>()
      const allAddedNodes = new Set<string>()
      const allAddedLinks = new Set<string>()

      for (const ev of runData.events) {
        if (abortReplayRef.current) break

        setGraph((prev) => {
          if (!prev) return prev
          const nodeMap = new Map<string, any>(prev.nodes.map((n) => [n.id, n]))
          const existingLinkIds = new Set(prev.links.map((l) => l.id))

          const rawNodesToAdd = (ev.add_nodes || []).filter((n: any) => !nodeMap.has(n.id))
          const linksCandidates = (ev.add_links || []).filter((l: any) => !existingLinkIds.has(l.id))

          const nodesToAdd = rawNodesToAdd.map((node: any) => {
            const newNode = { ...node }
            let anchorNode = null

            const connectedLink = linksCandidates.find(
              (l: any) => idOf(l.source) === node.id || idOf(l.target) === node.id
            )
            if (connectedLink) {
              const otherId =
                idOf(connectedLink.source) === node.id ? idOf(connectedLink.target) : idOf(connectedLink.source)
              anchorNode = nodeMap.get(otherId)
            }
            if (!anchorNode && ev.focus && nodeMap.has(ev.focus)) {
              anchorNode = nodeMap.get(ev.focus)
            }
            if (!anchorNode && (node.id.includes('618285') || node.id === 'org:dee69') && nodeMap.has('HGNC:1392')) {
              anchorNode = nodeMap.get('HGNC:1392')
            }

            if (anchorNode && anchorNode.x !== undefined) {
              const jitter = () => (Math.random() - 0.5) * 30
              newNode.x = anchorNode.x + jitter()
              newNode.y = anchorNode.y + jitter()
              newNode.z = (anchorNode.z ?? 0) + jitter()
            }
            return newNode
          })

          const availableNodeIds = new Set([...nodeMap.keys(), ...nodesToAdd.map((n: any) => n.id)])
          const linksToAdd = linksCandidates.filter(
            (l: any) => availableNodeIds.has(idOf(l.source)) && availableNodeIds.has(idOf(l.target))
          )

          if (nodesToAdd.length === 0 && linksToAdd.length === 0) return prev
          return {
            nodes: [...prev.nodes, ...nodesToAdd],
            links: [...prev.links, ...linksToAdd],
          }
        })

        const currentEventNodes = new Set<string>((ev.add_nodes || []).map((n: any) => String(n.id)))
        if (ev.focus) currentEventNodes.add(String(ev.focus))
        const currentEventLinks = new Set<string>((ev.add_links || []).map((l: any) => String(l.id)))

        currentEventNodes.forEach((id) => allAddedNodes.add(id))
        currentEventLinks.forEach((id) => allAddedLinks.add(id))

        setHl({
          nodes: currentEventNodes,
          links: currentEventLinks,
          focus: ev.focus || '',
          trail: new Set(accumNodes),
        })

        currentEventNodes.forEach((id) => accumNodes.add(id))
        currentEventLinks.forEach((id) => accumLinks.add(id))

        accumulatedSteps.push({
          say: `[${ev.phase}] ${ev.say}`,
          isWarn: false,
          links: ev.add_links || [],
        })

        setMessages((prev) =>
          prev.map((m) => (m.id === agentMsgId ? { ...m, steps: [...accumulatedSteps] } : m))
        )

        if (withVoice) {
          await speak(ev.say)
          if (!abortReplayRef.current) await new Promise((r) => setTimeout(r, 600))
        } else {
          await new Promise((r) => setTimeout(r, 2500))
        }
      }

      if (!abortReplayRef.current) {
        const pendingReviewCount = allAddedLinks.size
        setHl({
          nodes: allAddedNodes,
          links: allAddedLinks,
          focus: '',
          fit: true,
          trail: undefined,
        })

        const summaryText = `Agent run complete: ${allAddedNodes.size} nodes and ${allAddedLinks.size} links added, ${pendingReviewCount} pending expert review.`
        accumulatedSteps.push({
          say: `[summary] ${summaryText}`,
          isWarn: false,
          links: [],
        })

        setMessages((prev) =>
          prev.map((m) => (m.id === agentMsgId ? { ...m, steps: [...accumulatedSteps] } : m))
        )

        if (withVoice) await speak(summaryText)
        setMood('encuentra')
      }
    } catch (err) {
      console.error('Failed to replay run', err)
      setMood('incertidumbre')
    } finally {
      setIsReplaying(false)
    }
  }

  // Real LLM ask question via API
  const handleAsk = async (questionText: string) => {
    if (!graph || !questionText.trim()) return
    abortReplayRef.current = false
    setBusy(true)
    setMood('pensando')

    // Append user message immediately
    const userMsgId = `user-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        from: 'user',
        text: questionText,
      },
    ])

    try {
      const { text, nodeIds, linkIds } = buildContext(graph as any, questionText, role)
      
      // Empty subgraph edge case
      if (nodeIds.size === 0) {
        setBusy(false)
        setMood('incertidumbre')
        setMessages((prev) => [
          ...prev,
          {
            id: `ziva-${Date.now()}`,
            from: 'ziva',
            text: t.chat.noMatch,
          },
        ])
        return
      }

      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: questionText, context: text, role }),
      })
      const out = await r.json()
      setBusy(false)

      if (!r.ok) {
        setMood('incertidumbre')
        setMessages((prev) => [
          ...prev,
          {
            id: `ziva-${Date.now()}`,
            from: 'ziva',
            text: `⚠ ${out.error || 'Request failed'}: ${out.detail || ''}`,
          },
        ])
        return
      }

      const steps: Step[] = (out.steps || []).map((s: Step) => ({
        ...s,
        nodes: s.nodes.filter((id) => nodeIds.has(id)),
        links: s.links.filter((id) => linkIds.has(id)),
        focus: nodeIds.has(s.focus) ? s.focus : s.nodes.find((id) => nodeIds.has(id)) ?? '',
      }))

      // Prepare UI steps and light graph
      const uiSteps: { say: string; isWarn?: boolean; links?: any[] }[] = []
      speechSynthesis.cancel()

      const zivaMsgId = `ziva-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: zivaMsgId,
          from: 'ziva',
          steps: [],
          mechanismWarning: out.mechanism_warning?.trim(),
          nextStep: out.next_step?.trim(),
          unclear: out.gaps?.length ? `Gaps: ${out.gaps.join(', ')}` : undefined,
        },
      ])

      for (const s of steps) {
        if (abortReplayRef.current) break
        const nodes = new Set(s.nodes)
        const between = graph.links
          .filter((l) => nodes.has(idOf(l.source)) && nodes.has(idOf(l.target)))
          .map((l) => l.id)
        const stepLinks = new Set([...s.links, ...between])
        setHl({ nodes, links: stepLinks, focus: s.focus })

        const activeObjs = graph.links.filter((l) => stepLinks.has(l.id))
        uiSteps.push({ say: s.say, isWarn: !!s.isWarn, links: activeObjs })

        setMessages((prev) =>
          prev.map((m) => (m.id === zivaMsgId ? { ...m, steps: [...uiSteps] } : m))
        )

        await speak(s.say)
      }

      if (out.mechanism_warning && !abortReplayRef.current) {
        const mechNodes = [...nodeIds].filter((id) => id.startsWith('mech:'))
        setHl({ nodes: new Set(mechNodes), links: new Set(), focus: mechNodes[0] || '' })
        await speak(out.mechanism_warning)
      }

      if (out.next_step && !abortReplayRef.current) {
        await speak(out.next_step)
      }

      setMood(out.route_status === 'no_route' ? 'incertidumbre' : 'encuentra')
    } catch (err: any) {
      setBusy(false)
      setMood('incertidumbre')
      setMessages((prev) => [
        ...prev,
        {
          id: `ziva-${Date.now()}`,
          from: 'ziva',
          text: `⚠ Network error: ${err.message || 'Could not connect to server'}.`,
        },
      ])
    }
  }

  // Handle client-side selection in FindInGraph (no LLM)
  const handleFindSelect = (node: any) => {
    if (!graph || !node) return
    const neighbors = new Set<string>()
    const connectingLinks = new Set<string>()
    neighbors.add(node.id)

    graph.links.forEach((l) => {
      const s = idOf(l.source)
      const tgt = idOf(l.target)
      if (s === node.id) {
        neighbors.add(tgt)
        connectingLinks.add(l.id)
      } else if (tgt === node.id) {
        neighbors.add(s)
        connectingLinks.add(l.id)
      }
    })

    setHl({
      nodes: neighbors,
      links: connectingLinks,
      focus: node.id,
    })

    if (node.type === 'disease') {
      setSelectedDisease(node)
      setActiveTab('community')
      setPanelOpen(true)
      setMobileView('panel')
    }
  }

  // Node Click in 3D
  const handleNodeClick = (n: any) => {
    if (!n) return
    if (n.type === 'disease') {
      setSelectedDisease(n)
      setEvidence(null)
      setActiveTab('community')
      setPanelOpen(true)
      setMobileView('panel')
    }
  }

  // Link Click in 3D
  const handleLinkClick = (l: any) => {
    if (!l) return
    setEvidence(l)
    setActiveTab('evidence')
    setPanelOpen(true)
    setMobileView('panel')
  }

  const selectedDiseaseGaps = selectedDisease
    ? gapsData?.diseases?.find((d: any) => d.id === selectedDisease.id)
    : null

  return (
    <div className="app-container">
      {/* 1. Header (64 px, White) */}
      <header className="topbar">
        <img src="/brand/logo-light.png" alt="IluminAI" className="topbar-logo" />
        <div className="topbar-divider" />
        <div className="topbar-title-block">
          <span className="eyebrow">{t.rareDiseaseAtlas}</span>
          <h1>{t.evidenceSupportGraph}</h1>
        </div>

        <div className="topbar-right-controls">
          <span className="traceable-sources-pill">● {t.traceableSources}</span>

          {/* Desktop Role Segmented Control */}
          <div className="role-segmented-control desktop-only-control">
            <button
              type="button"
              className={`role-segment-btn ${role === 'family' ? 'active' : ''}`}
              onClick={() => setRole('family')}
            >
              {t.roles.family}
            </button>
            <button
              type="button"
              className={`role-segment-btn ${role === 'organization' ? 'active' : ''}`}
              onClick={() => setRole('organization')}
            >
              {t.roles.organization}
            </button>
            <button
              type="button"
              className={`role-segment-btn ${role === 'researcher' ? 'active' : ''}`}
              onClick={() => setRole('researcher')}
            >
              {t.roles.researcher}
            </button>
          </div>

          {/* Mobile Role Compact Selector */}
          <select
            className="mobile-role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            aria-label="Select role"
          >
            <option value="family">{t.roles.family}</option>
            <option value="organization">{t.roles.organization}</option>
            <option value="researcher">{t.roles.researcher}</option>
          </select>

          {/* Language Switch */}
          <button
            type="button"
            className="lang-switch-btn desktop-only-control"
            onClick={() => handleLangChange(lang === 'en' ? 'es' : 'en')}
            title="Switch Language"
          >
            {lang === 'en' ? 'ES' : 'EN'}
          </button>

          {/* Desktop Primary Action Buttons (P4) */}
          <button
            type="button"
            className="btn btn-ghost desktop-only-control"
            onClick={playDemo}
            disabled={isReplaying || busy}
          >
            {t.menu.watchDemo}
          </button>
          <button
            type="button"
            className="btn btn-mint desktop-only-control"
            onClick={() => replayRun('dee69', true)}
            disabled={isReplaying || busy}
          >
            {t.menu.runAgent}
          </button>

          {/* Desktop ⋯ More Dropdown (P4) */}
          <div className="more-menu-wrapper desktop-only-control">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMoreMenuOpen((v) => !v)}
              title="More actions"
            >
              {t.menu.more}
            </button>
            {moreMenuOpen && (
              <div className="more-menu-dropdown">
                <button
                  type="button"
                  className="more-menu-item"
                  onClick={() => {
                    setShowForum(true)
                    setMoreMenuOpen(false)
                  }}
                >
                  💬 {t.menu.communityPreview}
                </button>
                {role === 'researcher' && (
                  <button
                    type="button"
                    className="more-menu-item"
                    onClick={() => {
                      setActiveTab('review')
                      setPanelOpen(true)
                      setMoreMenuOpen(false)
                    }}
                  >
                    ⚖ {t.menu.reviewQueue} ({reviewQueueData?.count ?? 43})
                  </button>
                )}
                <button
                  type="button"
                  className="more-menu-item"
                  onClick={() => {
                    setShowWelcome(true)
                    setMoreMenuOpen(false)
                  }}
                >
                  ❓ {lang === 'es' ? 'Ayuda y Bienvenida' : 'Help & Welcome'}
                </button>
                <button
                  type="button"
                  className="more-menu-item"
                  onClick={() => {
                    handleReset()
                    setMoreMenuOpen(false)
                  }}
                >
                  🔄 {t.menu.reset}
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button (P3) */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu (P3) */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy)' }}>Menu</h3>
              <button
                type="button"
                className="side-panel-close-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="mobile-drawer-body">
              <button
                type="button"
                className="mobile-drawer-item"
                onClick={() => {
                  setMobileMenuOpen(false)
                  playDemo()
                }}
                disabled={isReplaying || busy}
              >
                {t.menu.watchDemo}
              </button>
              <button
                type="button"
                className="mobile-drawer-item mobile-item-highlight"
                onClick={() => {
                  setMobileMenuOpen(false)
                  replayRun('dee69', true)
                }}
                disabled={isReplaying || busy}
              >
                {t.menu.runAgent}
              </button>
              <button
                type="button"
                className="mobile-drawer-item"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setShowForum(true)
                }}
              >
                💬 {t.menu.communityPreview}
              </button>
              {role === 'researcher' && (
                <button
                  type="button"
                  className="mobile-drawer-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setActiveTab('review')
                    setPanelOpen(true)
                    setMobileView('panel')
                  }}
                >
                  ⚖ {t.menu.reviewQueue} ({reviewQueueData?.count ?? 43})
                </button>
              )}
              <button
                type="button"
                className="mobile-drawer-item"
                onClick={() => {
                  handleLangChange(lang === 'en' ? 'es' : 'en')
                  setMobileMenuOpen(false)
                }}
              >
                🌐 {lang === 'en' ? 'Cambiar a Español (ES)' : 'Switch to English (EN)'}
              </button>
              <button
                type="button"
                className="mobile-drawer-item"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setShowWelcome(true)
                }}
              >
                ❓ {lang === 'es' ? 'Ayuda & Bienvenida' : 'Help & Welcome'}
              </button>
              <button
                type="button"
                className="mobile-drawer-item"
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleReset()
                }}
              >
                🔄 {t.menu.reset}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. App Body */}
      <div className={`app-body mobile-view-${mobileView}`}>
        {/* Left: Ziva Chat */}
        <div className={`ziva-col-wrapper ${mobileView === 'chat' ? 'mobile-active' : ''}`}>
          <ZivaChat
            lang={lang}
            t={t}
            mood={mood}
            messages={messages}
            busy={busy}
            isReplaying={isReplaying}
            onSend={handleAsk}
            onStop={handleStop}
            onSuggestionClick={handleAsk}
            onWatchDemo={playDemo}
          />
        </div>

        {/* Center: 3D Graph (P5) */}
        <main ref={graphColRef as any} className={`graph-col ${mobileView === 'graph' ? 'mobile-active' : ''}`}>
          {graph ? (
            <>
              <div className="graph-top-overlay">
                {t.graph.evidencePath(graph.nodes.length, graph.links.length)}
              </div>

              <Graph3D
                data={graph}
                highlight={hl}
                onNodeClick={handleNodeClick}
                onLinkClick={handleLinkClick}
                width={graphDims.width > 0 ? graphDims.width : undefined}
                height={graphDims.height > 0 ? graphDims.height : undefined}
              />

              <FindInGraph
                t={t}
                nodes={graph.nodes}
                onSelectNode={handleFindSelect}
              />
            </>
          ) : (
            <div style={{ padding: 40, color: '#ffffff' }}>Loading 3D graph…</div>
          )}
        </main>

        {/* Right: Side Panel (Evidence, Community, Missing, Review) */}
        {(panelOpen || mobileView === 'panel') && (
          <div className={`side-panel-wrapper ${mobileView === 'panel' ? 'mobile-active' : ''}`}>
            <SidePanel
              t={t}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onClose={() => {
                setPanelOpen(false)
                if (mobileView === 'panel') setMobileView('graph')
              }}
              evidence={evidence}
              selectedDisease={selectedDisease}
              diseaseGaps={selectedDiseaseGaps}
              allGaps={gapsData}
              allNodes={graph?.nodes || []}
              allLinks={graph?.links || []}
              reviewQueueData={reviewQueueData}
              onReplayDee69={() => replayRun('dee69', true)}
              activeRole={role}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-btn ${mobileView === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileView('chat')}
        >
          <span className="mobile-nav-icon">🤖</span>
          <span className="mobile-nav-label">Ziva</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${mobileView === 'graph' ? 'active' : ''}`}
          onClick={() => setMobileView('graph')}
        >
          <span className="mobile-nav-icon">🌐</span>
          <span className="mobile-nav-label">{lang === 'es' ? 'Grafo 3D' : '3D Graph'}</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${mobileView === 'panel' ? 'active' : ''}`}
          onClick={() => {
            setPanelOpen(true)
            setMobileView('panel')
          }}
        >
          <span className="mobile-nav-icon">📋</span>
          <span className="mobile-nav-label">{lang === 'es' ? 'Evidencia' : 'Evidence'}</span>
        </button>
      </nav>

      {/* 3. Welcome / Onboarding Modal */}
      {showWelcome && (
        <WelcomeModal
          t={t}
          lang={lang}
          onSelectRole={(r) => setRole(r)}
          onDismiss={() => setShowWelcome(false)}
          onToggleLang={() => handleLangChange(lang === 'en' ? 'es' : 'en')}
        />
      )}

      {/* 4. Community Forum Modal */}
      {showForum && (
        <CommunityForum
          lang={lang}
          activeRole={role}
          onClose={() => setShowForum(false)}
          onFocusGraphNode={(nodeId: string) => {
            const found = graph?.nodes.find((n) => n.id === nodeId)
            if (found) handleFindSelect(found)
            setShowForum(false)
          }}
        />
      )}
    </div>
  )
}
