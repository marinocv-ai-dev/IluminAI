// POST /api/ask  { question, context }  →  guion { status, steps[], next_step, gaps[] }
// Calls OpenAI (gpt-5.4-mini, Structured Outputs). Model and key come from env: see .env.example
// `context` = output of buildContext() (src/subgraph.ts), already cut to ~2.5k tokens.

const ROLES = ['family', 'organization', 'researcher'] as const
export type Role = typeof ROLES[number]

const BASE_SYSTEM = `You are the guide of the Rare Disease Atlas.
You receive a QUESTION and a SUBGRAPH. Lines: "N id|type|label|summary" are nodes, "L id|source>relation>target|status|confidence" are links.
Use ONLY the subgraph. Never invent ids, facts, names or numbers.
Return ONLY a JSON object:
{"status":"supported|partial|no_route",
 "steps":[{"say":"1-2 short sentences","nodes":["node ids mentioned"],"links":["link ids used"],"focus":"one node id"}],
 "next_step":"one concrete action",
 "mechanism_warning":"warning if diseases have opposite mechanisms, else empty string",
 "gaps":["what is missing"]}
Rules:
- 3 to 6 steps. Walk the route hop by hop; each step only uses ids that appear in the subgraph (clean ids without N or L prefixes).
- Say whether each link is observed (curated database), from a paper (extracted) or inferred (hypothesis).
- Same gene does not mean same disease: if variants act in opposite ways (loss vs gain of function), warn clearly.
- mechanism_warning: if the subgraph shows different mechanisms (e.g. loss-of-function vs gain-of-function) for diseases in the question, explain in one sentence why a therapy for one may not help or may harm the other. Otherwise return an empty string.
- If a link has contradictions, say so.
- If the subgraph does not support an answer, status "no_route": explain what was searched and what evidence is missing.
- Plain words, short sentences. Answer in the same language as the QUESTION.
- Never recommend, suggest, rank or compare treatments, doses or medication changes, and never interpret a person's test results. You may say which treatments appear in the subgraph and what their links state, with their evidence status, then add that treatment decisions belong to the family's physician.
- next_step must never be to start, stop, switch or try a medication; point to a clinician, a patient group, a registry, a study or an expert review instead.`

const ROLE_PROMPTS: Record<Role, string> = {
  family: `ROLE: family (Devon, newly diagnosed family).
- Simple language, calm tone, absolutely no medical jargon.
- Do NOT mention raw database IDs (OMIM, ClinVar, PMID, etc.) in "say". Use plain names.
- Focus on patient communities, treatments, and supportive studies.
- Typical next_step: contacting a patient group, questions to ask the neurologist this week.
- mechanism_warning: in simple terms for parents, explain if one condition lacks channel activity while the other has too much, so a treatment for one could worsen the other.`,
  organization: `ROLE: organization (Maria, foundation leader).
- Semi-technical language focused on reusable assets, translational gaps, and research partnerships.
- Prioritize reusable assets (registries, natural history studies, biobanks, mouse models), clinical studies, patient groups, funders, and researchers.
- Typical next_step: reusing a registry or protocol, funding an unaddressed gap, forming an alliance with another rare disease foundation.
- When the subgraph lacks an asset type for a disease, name it as a gap and suggest who could fill it.
- mechanism_warning: highlight the translational risk of repurposing drugs across opposing mechanisms (LoF vs GoF) without target stratification.`,
  researcher: `ROLE: researcher (Dr. Osei & Priya, scientific and industry researchers).
- Rigorous technical tone. Detail mechanisms, variant effects (LoF/GoF), functional modalities, and experimental paradigms.
- When citing a source in "say", ALWAYS include the subgraph IDs (PMID, NCT, ClinVar, etc.).
- Prioritize mechanisms, variants, peer-reviewed papers, researchers, and experimental assets.
- Typical next_step: validation experiment, collaborating with a key investigator, or reusing an established model.
- mechanism_warning: detail the biophysical divergence (loss-of-function vs gain-of-function gating kinetics) and contraindication of therapeutic modalities.`
}

export function getSystemPrompt(role: Role): string {
  return `${BASE_SYSTEM}\n\n${ROLE_PROMPTS[role]}`
}

const STATUSES = ['supported', 'partial', 'no_route']
const strs = (x: unknown) => (Array.isArray(x) ? x.filter(s => typeof s === 'string') : [])
export const cleanId = (s: string) => s.replace(/^[NL]\s+/, '').split('|')[0].trim()

export type Step = { say: string; nodes: string[]; links: string[]; focus: string }
export type Script = { status: string; steps: Step[]; next_step: string; mechanism_warning: string; gaps: string[] }

// Normalizes LLM output; throws if unusable. Filtering ids against the graph happens in the browser.
export function parseScript(raw: string): Script {
  const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  const steps: Step[] = (Array.isArray(j.steps) ? j.steps : [])
    .filter((s: any) => typeof s?.say === 'string' && s.say.trim())
    .slice(0, 8)
    .map((s: any) => {
      const nodes = strs(s.nodes).map(cleanId).filter(Boolean)
      const links = strs(s.links).map(cleanId).filter(Boolean)
      const focus = typeof s.focus === 'string' ? cleanId(s.focus) : nodes[0] ?? ''
      return { say: s.say.trim(), nodes, links, focus }
    })
  if (!steps.length) throw new Error('script has no steps')
  return {
    status: STATUSES.includes(j.status) ? j.status : 'partial',
    steps,
    next_step: typeof j.next_step === 'string' ? j.next_step : '',
    mechanism_warning: typeof j.mechanism_warning === 'string' ? j.mechanism_warning.trim() : '',
    gaps: strs(j.gaps),
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const SCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'steps', 'next_step', 'mechanism_warning', 'gaps'],
  properties: {
    status: { type: 'string', enum: ['supported', 'partial', 'no_route'] },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['say', 'nodes', 'links', 'focus'],
        properties: {
          say: { type: 'string' },
          nodes: { type: 'array', items: { type: 'string' } },
          links: { type: 'array', items: { type: 'string' } },
          focus: { type: 'string' },
        },
      },
    },
    next_step: { type: 'string' },
    mechanism_warning: { type: 'string' },
    gaps: { type: 'array', items: { type: 'string' } },
  },
}

export async function POST(req: Request): Promise<Response> {
  const env = (globalThis as any).process.env
  const { question, context, role: rawRole } = await req.json().catch(() => ({}))
  const role: Role = rawRole === undefined ? 'family' : rawRole
  if (!ROLES.includes(role)) {
    return json({ error: 'invalid role: must be family | organization | researcher' }, 400)
  }

  // limits at the trust boundary: protect the token budget and the key
  if (typeof question !== 'string' || !question.trim() || question.length > 500)
    return json({ error: 'question required (max 500 chars)' }, 400)
  if (typeof context !== 'string' || context.length > 12000)
    return json({ error: 'context required (max 12000 chars)' }, 400)
  if (!env.LLM_KEY) return json({ error: 'LLM_KEY missing in .env.local' }, 500)

  const systemContent = getSystemPrompt(role)

  const r = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.LLM_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: `QUESTION: ${question}\n\nSUBGRAPH:\n${context || '(empty: no matching nodes)'}` },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'evidence_script', strict: true, schema: SCRIPT_SCHEMA } },
      max_completion_tokens: 1500,
      ...JSON.parse(env.LLM_EXTRA || '{}'), // provider-specific params or overrides (e.g. override response_format if provider lacks json_schema)
    }),
  })
  if (!r.ok) return json({ error: `LLM ${r.status}`, detail: (await r.text()).slice(0, 500) }, r.status === 429 ? 429 : 502)

  const data = await r.json()
  try {
    return json({ ...parseScript(data.choices?.[0]?.message?.content ?? ''), usage: data.usage })
  } catch (e) {
    return json({ error: 'invalid LLM response', detail: String(e) }, 502)
  }
}

// self-check: node --experimental-strip-types api/ask.ts
const argv1: string | undefined = (globalThis as any).process?.argv?.[1]
if (argv1 && import.meta.url.endsWith(argv1.replace(/\\/g, '/'))) {
  const s = parseScript('leading text {"status":"raro","steps":[{"say":" Hola ","nodes":["A",3]},{"say":""}],"mechanism_warning":"warn","gaps":"x"}')
  console.assert(s.status === 'partial', 'unknown status → partial')
  console.assert(s.steps.length === 1 && s.steps[0].say === 'Hola', 'empty steps dropped')
  console.assert(s.steps[0].focus === 'A' && s.steps[0].nodes.join() === 'A', 'default focus + non-string ids dropped')
  console.assert(s.mechanism_warning === 'warn', 'mechanism_warning parsed')
  console.assert(Array.isArray(s.gaps) && s.gaps.length === 0, 'non-array gaps → []')
  let threw = false
  try { parseScript('{"steps":[]}') } catch { threw = true }
  console.assert(threw, 'no steps → error')

  // F1 cleanId self-checks
  console.assert(cleanId('L L118') === 'L118', 'cleanId strips "L " prefix')
  console.assert(cleanId('N NCT01543750') === 'NCT01543750', 'cleanId strips "N " prefix')
  console.assert(cleanId('HGNC:1388|gene|CACNA1A') === 'HGNC:1388', 'cleanId strips pipe details')

  const parsedPrefixed = parseScript('{"status":"supported","steps":[{"say":"test","nodes":["N NCT01543750","HGNC:1388|gene|CACNA1A"],"links":["L L118"],"focus":"N NCT01543750"}],"mechanism_warning":"","gaps":[]}')
  console.assert(parsedPrefixed.steps[0].nodes[0] === 'NCT01543750', 'normalized node id 0')
  console.assert(parsedPrefixed.steps[0].nodes[1] === 'HGNC:1388', 'normalized node id 1')
  console.assert(parsedPrefixed.steps[0].links[0] === 'L118', 'normalized link id')
  console.assert(parsedPrefixed.steps[0].focus === 'NCT01543750', 'normalized focus')

  // role self-check
  console.assert(ROLES.includes('family') && ROLES.includes('organization') && ROLES.includes('researcher'), 'valid roles exist')
  console.assert(getSystemPrompt('family').includes('ROLE: family'), 'system prompt contains role family')
  console.assert(getSystemPrompt('family').includes('Never recommend'), 'system prompt contains brand treatment rule')
  console.assert(getSystemPrompt('researcher').includes('ALWAYS include the subgraph IDs'), 'system prompt contains researcher rules')
  console.log('OK')
}
