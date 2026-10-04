// 3D graph the AI can illuminate · IluminAI identity (Brand Book v3)
// Usage: <Graph3D data={graph} highlight={{ nodes, links, focus }} onLinkClick={showEvidence} />
import { useEffect, useMemo, useRef } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'

export type Highlight = { nodes: Set<string>; links: Set<string>; focus?: string; trail?: Set<string>; fit?: boolean }

// Official palette. Mint is reserved for "signals of discovery" = what the AI illuminates.
export const BRAND = { navy: '#0A2E4E', blue: '#1E6091', mint: '#4CC9B0', mist: '#F4F7FA' }

// As on the brand book cover: white and blue nodes on navy; the exact type goes in the tag (GEN, HPO…).
// ponytail: blue is lightened (#3D85C6) because #1E6091 on navy lacks contrast in 3D
export const GROUPS = [
  { name: 'Diseases', color: BRAND.mist, types: ['disease'] },
  { name: 'Biology', color: '#3D85C6', types: ['gene', 'variant', 'mechanism', 'phenotype'] },
  { name: 'Community & evidence', color: '#8FB3D1', types: ['patient_group', 'researcher', 'funder', 'study', 'asset', 'treatment', 'paper', 'company'] },
]
const GROUP_COLOR = Object.fromEntries(GROUPS.flatMap(g => g.types.map(t => [t, g.color])))
export const TAG: Record<string, string> = {
  disease: 'DX', gene: 'GEN', variant: 'VAR', mechanism: 'MECH', phenotype: 'HPO', patient_group: 'GROUP',
  researcher: 'RES', funder: 'FUND', study: 'STUDY', asset: 'ASSET', treatment: 'TX', paper: 'EVID',
  company: 'BIO',
}
const CONTRADICTION = '#F2B134'     // only off-palette color: a semantic alert, not decoration
const PENDING_COLOR = '#F2B134'
const idOf = (x: any) => (typeof x === 'object' ? x.id : x)

export default function Graph3D({ data, highlight, onNodeClick, onLinkClick }: {
  data: { nodes: any[]; links: any[] }
  highlight: Highlight
  onNodeClick?: (n: any) => void
  onLinkClick?: (l: any) => void
}) {
  const fg = useRef<any>(null)
  const fitted = useRef(false)
  const active = highlight.nodes.size > 0 || (highlight.trail?.size ?? 0) > 0
  const graphData = useMemo(() => data, [data]) // same reference = simulation does not restart

  const degree = useMemo(() => {
    const d: Record<string, number> = {}
    data.links.forEach(l => [idOf(l.source), idOf(l.target)].forEach(k => (d[k] = (d[k] ?? 0) + 1)))
    return d
  }, [data])

  // Track nodes that have contributed links
  const contributedNodeIds = useMemo(() => {
    // pending = every link of the node is a community/agent contribution (a fact node with one extra contribution stays a fact)
    const any = new Set<string>(), solid = new Set<string>()
    data.links.forEach(l => [idOf(l.source), idOf(l.target)].forEach(k => (l.status === 'contributed' ? any : solid).add(k)))
    return new Set([...any].filter(k => !solid.has(k)))
  }, [data])

  // spread the layout so clusters separate (defaults pack ~100 nodes into a tight ball)
  useEffect(() => {
    fg.current?.d3Force('charge').strength(-140)
    fg.current?.d3Force('link').distance((l: any) => (l.type === 'has_phenotype' ? 30 : 55))
  }, [])

  // camera flight to the focus node with retry if node hasn't computed position yet
  const flyTo = (id?: string) => {
    if (!id || !fg.current) return false
    const n = data.nodes.find(node => node.id === id)
    if (!n || n.x === undefined) return false
    const ratio = 1 + 280 / Math.hypot(n.x, n.y, n.z || 1)
    fg.current.cameraPosition({ x: n.x * ratio, y: n.y * ratio, z: n.z * ratio }, n, 1400)
    return true
  }

  useEffect(() => {
    if (highlight.fit) { fg.current?.zoomToFit(1200, 80, (n: any) => highlight.nodes.has(n.id)); return }
    if (!highlight.focus) return
    if (!flyTo(highlight.focus)) {
      let attempts = 0
      const iv = setInterval(() => {
        attempts++
        if (flyTo(highlight.focus) || attempts >= 10) clearInterval(iv)
      }, 200)
      return () => clearInterval(iv)
    }
  }, [highlight.focus, highlight.fit, data])

  const nodeColor = (n: any) => {
    if (highlight.nodes.has(n.id)) return BRAND.mint
    if (highlight.trail?.has(n.id)) return 'rgba(76, 201, 176, 0.55)' // L1: mint 55%
    if (active) {
      // L1: color de su grupo al 35%
      const base = GROUP_COLOR[n.type] ?? '#8FB3D1'
      return base.startsWith('#') ? `${base}59` : base
    }
    return GROUP_COLOR[n.type] ?? '#8FB3D1'
  }

  const linkColor = (l: any) => {
    const lit = highlight.links.has(l.id)
    if (l.contradicts?.length && (lit || !active)) return CONTRADICTION
    if (lit) return BRAND.mint
    const s = idOf(l.source), t = idOf(l.target)
    const inTrail = highlight.trail && (highlight.trail.has(s) || highlight.nodes.has(s)) && (highlight.trail.has(t) || highlight.nodes.has(t))
    if (inTrail) return 'rgba(76, 201, 176, 0.35)' // L1: mint al 35%
    if (active) return 'rgba(143,179,209,0.15)'   // L1: 0.15 resto con highlight activo
    if (l.status === 'inferred' || l.status === 'contributed') return 'rgba(143,179,209,0.25)'
    return `rgba(143,179,209,${l.status === 'observed' ? 0.6 : 0.42})`
  }

  return (
    <ForceGraph3D
      ref={fg}
      graphData={graphData}
      backgroundColor={BRAND.navy}
      nodeVal={n => (n.id === highlight.focus ? 10 : 2) + (degree[n.id] ?? 0)}
      nodeColor={nodeColor}
      nodeOpacity={1}
      nodeResolution={24}
      nodeLabel={n => `<div class="tip"><span class="tag">${TAG[n.type] ?? n.type}</span> <b>${n.label}</b>${contributedNodeIds.has(n.id) ? ' <span style="color:#F2B134">[CONTRIBUTED]</span>' : ''}<br/>${n.summary_plain ?? ''}</div>`}
      // brand book tag only on current illuminated nodes (trail has no label per L1)
      nodeThreeObjectExtend
      nodeThreeObject={(n: any) => {
        if (!highlight.nodes.has(n.id)) return undefined as any
        // ponytail: >6 lit nodes → label only focus + key types, otherwise labels cover the graph
        if (highlight.nodes.size > 6 && n.id !== highlight.focus && !['disease', 'gene', 'patient_group', 'company', 'study'].includes(n.type)) return undefined as any
        const isPending = contributedNodeIds.has(n.id)
        const prefix = isPending ? 'PENDING · ' : ''
        const s = new SpriteText(`${prefix}${TAG[n.type] ?? ''}  ${n.label}`)
        s.fontFace = 'Manrope, sans-serif'
        s.fontWeight = '600'
        s.color = n.id === highlight.focus ? BRAND.navy : isPending ? '#F2B134' : BRAND.mint
        s.backgroundColor = n.id === highlight.focus ? (isPending ? '#F2B134' : BRAND.mint) : 'rgba(10,46,78,0.92)'
        if (isPending) {
          s.borderColor = PENDING_COLOR
          s.borderWidth = 1
        }
        s.padding = [3, 2]
        s.borderRadius = 2
        s.textHeight = n.id === highlight.focus ? 7 : 5
        s.position.y = 4 * Math.cbrt((n.id === highlight.focus ? 10 : 2) + (degree[n.id] ?? 0)) + 6
        return s
      }}
      cooldownTime={4000}
      onEngineStop={() => { if (fitted.current) return; fitted.current = true; if (!flyTo(highlight.focus)) fg.current?.zoomToFit(800, 60) }}
      linkColor={linkColor}
      linkWidth={l => (highlight.links.has(l.id) ? 1 + 1.5 * l.confidence : 0)}
      linkDirectionalParticles={l => (highlight.links.has(l.id) ? 3 : 0)}
      linkDirectionalParticleColor={() => BRAND.mint}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleSpeed={0.007}
      linkLabel={l => `<div class="tip">${l.type} · ${l.status} · ${Math.round(l.confidence * 100)}%</div>`}
      onNodeClick={onNodeClick}
      onLinkClick={onLinkClick}
    />
  )
}
