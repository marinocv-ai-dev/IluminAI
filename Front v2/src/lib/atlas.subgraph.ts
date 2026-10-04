import type { GraphData, GraphLink, GraphNode } from "./atlas.types";
import { graphId } from "./atlas.types";

const BUDGET_TOKENS = 2500;
const STATUS_RANK: Record<string, number> = { observed: 3, extracted: 2, inferred: 1 };
const INTENT: [RegExp, string][] = [
  [/famil|grupo|group|communit|patient|comunidad/i, "patient_group"],
  [/trat|treat|drug|medic|terap|therap/i, "treatment"],
  [/ensayo|trial|estudio|study|registr/i, "study"],
  [/investig|research|doctor|lab|quien|who/i, "researcher"],
  [/s[ií]ntoma|symptom|phenotyp/i, "phenotype"],
  [/modelo|model|asset|biomark/i, "asset"],
];

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const SPANISH_TERMS: Record<string, string[]> = {
  "ataxia episodica": ["OMIM:108500", "OMIM:160120", "OMIM:613855", "OMIM:612656"],
  "migrana hemiplejica": ["OMIM:141500", "OMIM:602481", "OMIM:609634"],
  "sindrome de dravet": ["OMIM:607208"],
  "convulsion": ["HP:0001250"],
  "convulsiones": ["HP:0001250"],
  "retraso del desarrollo": ["HP:0001263"],
  "mareo": ["HP:0002321"],
  "vertigo": ["HP:0002321"],
  "dolor de cabeza": ["HP:0002315"],
  "hipotonia": ["HP:0001252"],
  "distonia": ["HP:0001332"],
  "espasticidad": ["HP:0001257"],
};

export function buildAtlasContext(graph: GraphData, question: string) {
  const normalizedQuestion = normalize(question);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, GraphLink[]>();
  for (const link of graph.links) {
    for (const endpoint of [graphId(link.source), graphId(link.target)]) {
      const links = adjacency.get(endpoint) ?? [];
      links.push(link);
      adjacency.set(endpoint, links);
    }
  }

  const matchedIds = new Set(Object.entries(SPANISH_TERMS).flatMap(([term, ids]) => normalizedQuestion.includes(term) ? ids : []));
  const seeds = graph.nodes.filter((node) => matchedIds.has(node.id) ||
    [node.label, ...(node.synonyms ?? [])].some((value) => value.length >= 3 && normalizedQuestion.includes(normalize(value))),
  );
  const wanted = new Set(INTENT.filter(([pattern]) => pattern.test(question)).map(([, type]) => type));
  const distance = new Map(seeds.map((node) => [node.id, 0]));
  const candidates: { link: GraphLink; score: number }[] = [];
  let frontier = seeds.map((node) => node.id);

  for (let hop = 1; hop <= 2; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const link of adjacency.get(id) ?? []) {
        const source = graphId(link.source);
        const target = graphId(link.target);
        const other = source === id ? target : source;
        const type = byId.get(other)?.type ?? "";
        candidates.push({
          link,
          score: (3 - hop) * 10 + (STATUS_RANK[link.status] ?? 0) * 2 + link.confidence + (wanted.has(type) ? 8 : 0),
        });
        if (!distance.has(other)) {
          distance.set(other, hop);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  candidates.sort((a, b) => b.score - a.score);

  const nodeIds = new Set<string>();
  const linkIds = new Set<string>();
  const lines: string[] = [];
  let characters = 0;
  const add = (line: string) => { lines.push(line); characters += line.length + 1; };
  const addNode = (id: string) => {
    const node = byId.get(id);
    if (!node || nodeIds.has(id)) return;
    nodeIds.add(id);
    add(`N ${node.id}|${node.type}|${node.label}|${(node.summary_plain ?? "").slice(0, 90)}`);
  };

  seeds.forEach((node) => addNode(node.id));
  for (const { link } of candidates) {
    if (characters / 4 > BUDGET_TOKENS) break;
    if (linkIds.has(link.id)) continue;
    linkIds.add(link.id);
    const source = graphId(link.source);
    const target = graphId(link.target);
    addNode(source);
    addNode(target);
    add(`L ${link.id}|${source}>${link.type}>${target}|${link.status}|${link.confidence}`);
  }
  return { text: lines.join("\n"), nodeIds, linkIds, seeds: seeds.map((node) => node.id) };
}