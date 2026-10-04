// Live eval of /api/ask: 3 questions × 3 roles against a running dev server.
// Usage (from atlas/): npm run dev  →  node --experimental-strip-types eval/ask_eval.ts [port]
import { readFileSync, writeFileSync } from 'node:fs'
import { buildContext } from '../src/subgraph.ts'

const port = process.argv[2] ?? '5173'
const g = JSON.parse(readFileSync('public/data/graph.json', 'utf8'))
const QS = ['What groups exist for episodic ataxia type 2?', 'Can a therapy for FHM1 be used in EA2?', 'What is missing for SCA6 research?']
const out: any[] = []
let cost = 0
for (const question of QS) for (const role of ['family', 'organization', 'researcher']) {
  const { text, nodeIds, linkIds } = buildContext(g, question, role as any)
  const t0 = Date.now()
  const r = await fetch(`http://localhost:${port}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, context: text, role }) })
  const j: any = await r.json()
  const ms = Date.now() - t0
  out.push({ question, role, j })
  if (!r.ok) { console.log(role, '|', question, '| HTTP', r.status, JSON.stringify(j).slice(0, 200)); continue }
  const ids: string[] = j.steps.flatMap((s: any) => s.nodes), lids: string[] = j.steps.flatMap((s: any) => s.links)
  const said = (j.steps.map((s: any) => s.say).join(' ') + ' ' + j.next_step + ' ' + (j.mechanism_warning ?? '')).toLowerCase()
  const u = j.usage ?? {}
  cost += (u.prompt_tokens ?? 0) * 0.75e-6 + (u.completion_tokens ?? 0) * 4.5e-6 // ponytail: gpt-5.4-mini list prices (free under OpenAI data-sharing daily quota); edit for other models
  console.log([role.padEnd(12), question.slice(0, 34).padEnd(34), j.status, `steps:${j.steps.length}`,
    `nodes:${ids.filter(i => nodeIds.has(i)).length}/${ids.length}`, `links:${lids.filter(i => linkIds.has(i)).length}/${lids.length}`,
    `evidence-words:${/observed|extracted|inferred|database|paper|hypothes/.test(said)}`, `lof/gof:${/loss|gain|too little|too much|opposite/.test(said)}`,
    `ids-in-say:${/pmid|nct\d|omim:|hgnc:/.test(said)}`, `${ms}ms`, `tok:${u.prompt_tokens}+${u.completion_tokens}`].join(' | '))
}
console.log(`est. cost: $${cost.toFixed(4)}`)
writeFileSync('eval/ask_eval_out.json', JSON.stringify(out, null, 1))
