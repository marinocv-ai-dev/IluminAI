// Cuts the graph down to what is relevant for a question, within a token budget (Graph-RAG retrieval).
// Usage: const { text, nodeIds, linkIds } = buildContext(graph, question)  → `text` goes to the LLM.

type Node = { id: string; type: string; label: string; synonyms?: string[]; summary_plain?: string }
type Link = { id: string; source: any; target: any; type: string; status: string; confidence: number }
type Graph = { nodes: Node[]; links: Link[] }

// ponytail: tokens ≈ chars/4; use a real tokenizer if the budget gets tight
const BUDGET_TOKENS = 2500
const STATUS_RANK: Record<string, number> = { observed: 3, extracted: 2, inferred: 1 }
// word in the question (EN/ES) → node type to prioritize
const INTENT: [RegExp, string][] = [
  [/famil|grupo|group|communit|patient|comunidad/i, 'patient_group'],
  [/trat|treat|drug|medic|terap|therap/i, 'treatment'],
  [/ensayo|trial|estudio|study|registr/i, 'study'],
  [/investig|research|doctor|lab|quien|who/i, 'researcher'],
  [/s[ií]ntoma|symptom|phenotyp/i, 'phenotype'],
  [/modelo|model|asset|biomark/i, 'asset'],
]

export type Role = 'family' | 'organization' | 'researcher'
const ROLE_TYPES: Record<Role, string[]> = {
  family: ['patient_group', 'treatment', 'study'],
  organization: ['asset', 'study', 'patient_group', 'funder', 'researcher'],
  researcher: ['mechanism', 'variant', 'paper', 'researcher', 'asset'],
}

const idOf = (x: any) => (typeof x === 'object' ? x.id : x) // force-graph replaces ids with objects
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function buildContext(g: Graph, question: string, role: Role = 'family') {
  const q = norm(question)
  const byId = new Map(g.nodes.map(n => [n.id, n]))
  const adj = new Map<string, Link[]>()
  for (const l of g.links)
    for (const end of [idOf(l.source), idOf(l.target)]) (adj.get(end) ?? adj.set(end, []).get(end)!).push(l)

  // 1. seeds: nodes whose label/synonym appears in the question (min. 3 chars)
  const seeds = g.nodes.filter(n =>
    [n.label, ...(n.synonyms ?? [])].some(s => s.length >= 3 && q.includes(norm(s))))
  const wanted = new Set(INTENT.filter(([re]) => re.test(question)).map(([, t]) => t))
  const roleTypes = new Set(ROLE_TYPES[role] ?? [])

  // 2. 2-hop BFS; links are scored by relevance, then added until the budget is full
  const dist = new Map(seeds.map(n => [n.id, 0]))
  const cand: { l: Link; score: number }[] = []
  let frontier = seeds.map(n => n.id)
  for (let hop = 1; hop <= 2; hop++) {
    const next: string[] = []
    for (const id of frontier)
      for (const l of adj.get(id) ?? []) {
        const other = idOf(l.source) === id ? idOf(l.target) : idOf(l.source)
        const t = byId.get(other)?.type ?? ''
        const roleBonus = roleTypes.has(t) ? 4 : 0
        cand.push({ l, score: (3 - hop) * 10 + STATUS_RANK[l.status] * 2 + l.confidence + (wanted.has(t) ? 8 : 0) + roleBonus })
        if (!dist.has(other)) { dist.set(other, hop); next.push(other) }
      }
    frontier = next
  }
  cand.sort((a, b) => b.score - a.score)

  // 3. compact serialization (no URLs or quotes: the UI shows those from graph.json)
  const nodeLine = (n: Node) => `${n.id}|${n.type}|${n.label}|${(n.summary_plain ?? '').slice(0, 90)}`
  const nodeIds = new Set<string>(), linkIds = new Set<string>(), lines: string[] = []
  let chars = 0
  const add = (s: string) => { lines.push(s); chars += s.length + 1 }
  const addNode = (id: string) => { if (!nodeIds.has(id) && byId.has(id)) { nodeIds.add(id); add('N ' + nodeLine(byId.get(id)!)) } }

  seeds.forEach(n => addNode(n.id))

  // F2: if seeds contain disease or gene, always include `disrupts` links from `mechanism` nodes
  // towards those diseases and towards diseases caused by seed genes.
  const relevantDiseases = new Set<string>()
  for (const n of seeds) {
    if (n.type === 'disease') relevantDiseases.add(n.id)
    if (n.type === 'gene') {
      for (const l of adj.get(n.id) ?? []) {
        if (l.type === 'causes' && idOf(l.source) === n.id) {
          const tgtId = idOf(l.target)
          if (byId.get(tgtId)?.type === 'disease') relevantDiseases.add(tgtId)
        }
      }
    }
  }

  for (const dId of relevantDiseases) {
    for (const l of adj.get(dId) ?? []) {
      if (l.type === 'disrupts' && idOf(l.target) === dId) {
        const srcNode = byId.get(idOf(l.source))
        if (srcNode?.type === 'mechanism') {
          if (!linkIds.has(l.id)) {
            linkIds.add(l.id)
            addNode(idOf(l.source)); addNode(idOf(l.target))
            add(`L ${l.id}|${idOf(l.source)}>${l.type}>${idOf(l.target)}|${l.status}|${l.confidence}`)
          }
        }
      }
    }
  }

  for (const { l } of cand) {
    if (chars / 4 > BUDGET_TOKENS) break
    if (linkIds.has(l.id)) continue
    linkIds.add(l.id)
    addNode(idOf(l.source)); addNode(idOf(l.target))
    add(`L ${l.id}|${idOf(l.source)}>${l.type}>${idOf(l.target)}|${l.status}|${l.confidence}`)
  }
  return { text: lines.join('\n'), nodeIds, linkIds, seeds: seeds.map(n => n.id) }
}

// self-check: node --experimental-strip-types ref/subgraph.ts
const argv1: string | undefined = (globalThis as any).process?.argv?.[1] // undefined in the browser
if (argv1 && import.meta.url.endsWith(argv1.replace(/\\/g, '/'))) {
  const g: Graph = {
    nodes: [
      { id: 'G', type: 'gene', label: 'CACNA1A', synonyms: ['Cav2.1'] },
      { id: 'D1', type: 'disease', label: 'Episodic ataxia type 2', synonyms: ['EA2'] },
      { id: 'D2', type: 'disease', label: 'FHM1' },
      { id: 'P', type: 'patient_group', label: 'CACNA1A Foundation' },
      { id: 'X', type: 'gene', label: 'UNRELATED' },
    ],
    links: [
      { id: 'L1', source: 'G', target: 'D1', type: 'causes', status: 'observed', confidence: 0.9 },
      { id: 'L2', source: 'G', target: 'D2', type: 'causes', status: 'observed', confidence: 0.9 },
      { id: 'L3', source: 'P', target: 'D1', type: 'member_of', status: 'extracted', confidence: 0.7 },
    ],
  }
  const r = buildContext(g, '¿Qué grupo de familias hay para EA2?')
  console.assert(r.seeds.join() === 'D1', 'seed by synonym')
  console.assert(r.linkIds.has('L3') && r.nodeIds.has('P'), 'patient group included')
  console.assert(!r.nodeIds.has('X'), 'unrelated node excluded')
  console.assert([...r.linkIds][0] === 'L3', '"group" intent prioritizes patient_group')

  // role assert: with role='researcher', a link to a mechanism node scores higher than with 'family'
  const gMech: Graph = {
    nodes: [
      { id: 'D1', type: 'disease', label: 'Episodic ataxia type 2', synonyms: ['EA2'] },
      { id: 'M', type: 'mechanism', label: 'Loss of function' },
      { id: 'PG', type: 'patient_group', label: 'Ataxia Group' },
    ],
    links: [
      { id: 'LM', source: 'D1', target: 'M', type: 'disrupts', status: 'observed', confidence: 0.9 },
      { id: 'LP', source: 'D1', target: 'PG', type: 'member_of', status: 'observed', confidence: 0.9 },
    ],
  }
  const rFam = buildContext(gMech, 'EA2', 'family')
  const rRes = buildContext(gMech, 'EA2', 'researcher')
  console.assert([...rFam.linkIds][0] === 'LP', 'family prioritizes patient_group over mechanism')
  console.assert([...rRes.linkIds][0] === 'LM', 'researcher prioritizes mechanism over patient_group')

  // F2 assert: mechanism disrupts link towards seed disease is always included
  const gDisrupts: Graph = {
    nodes: [
      { id: 'D1', type: 'disease', label: 'Episodic ataxia type 2', synonyms: ['EA2'] },
      { id: 'M', type: 'mechanism', label: 'Loss of function' },
    ],
    links: [
      { id: 'LD', source: 'M', target: 'D1', type: 'disrupts', status: 'extracted', confidence: 0.95 },
    ],
  }
  const rDisrupts = buildContext(gDisrupts, 'EA2')
  console.assert(rDisrupts.linkIds.has('LD') && rDisrupts.nodeIds.has('M'), 'disrupts link from mechanism always included for seed disease')

  console.log(r.text, '\nOK')
}
