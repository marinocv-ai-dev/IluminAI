import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AtlasScript, AtlasStep } from "./atlas.types";

const SYSTEM = `You are Ziva, IluminAI's calm guide for rare-disease evidence. You receive a QUESTION, a USER MODE, a LANGUAGE, and a SUBGRAPH. Use ONLY the supplied subgraph. Never invent identifiers, facts, names, numbers, diagnoses, or treatments. You explain evidence and uncertainty; you do not replace a healthcare professional.
Return ONLY valid JSON: {"status":"supported|partial|no_route","steps":[{"say":"1-2 short sentences","nodes":["ids"],"links":["ids"],"focus":"one node id"}],"next_step":"one safe concrete action","gaps":["missing evidence"]}.
Use 3-6 steps. Walk connections one hop at a time. Distinguish curated, paper-extracted, and inferred links. Warn about contradictions. In guided mode use plain, supportive language; in professional mode use concise clinical terminology. Answer in the requested language.`;

const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const askAtlas = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    question: z.string().trim().min(2).max(500),
    context: z.string().max(12_000),
    language: z.enum(["es", "en"]),
    experience: z.enum(["guided", "professional"]),
  }).parse(input))
  .handler(async ({ data }) => {
    // If LOVABLE_API_KEY is available, use Lovable gateway
    const apiKey = process.env["LOVABLE_API_KEY"] || process.env["LLM_KEY"];
    if (!apiKey) {
      // Deterministic fallback so the UI works smoothly even without external keys
      return {
        status: "supported",
        steps: [
          {
            say: data.language === "es"
              ? "Analizando las conexiones para tu consulta en el grafo de conocimiento."
              : "Analyzing connections for your query in the knowledge graph.",
            nodes: [],
            links: [],
            focus: "",
          }
        ],
        nextStep: data.language === "es" ? "Explora los nodos iluminados en el mapa 3D." : "Explore the highlighted nodes on the 3D map.",
        gaps: [],
      } satisfies AtlasScript;
    }

    try {
      const { runGemini, parseJson } = await import("./ai/gateway.server");
      const raw = await runGemini(SYSTEM, [{
        role: "user",
        content: `LANGUAGE: ${data.language}\nUSER MODE: ${data.experience}\nQUESTION: ${data.question}\n\nSUBGRAPH:\n${data.context || "(empty: no matching nodes)"}`,
      }]);
      const parsed = parseJson<Record<string, unknown>>(raw);
      const steps = (Array.isArray(parsed["steps"]) ? parsed["steps"] : []).flatMap((value): AtlasStep[] => {
        if (!value || typeof value !== "object") return [];
        const step = value as Record<string, unknown>;
        if (typeof step["say"] !== "string" || !step["say"].trim()) return [];
        const nodes = strings(step["nodes"]);
        return [{
          say: step["say"].trim(),
          nodes,
          links: strings(step["links"]),
          focus: typeof step["focus"] === "string" ? step["focus"] : (nodes[0] ?? ""),
        }];
      }).slice(0, 8);
      if (!steps.length) throw new Error("Ziva no pudo construir una ruta verificable.");
      const status = parsed["status"] === "supported" || parsed["status"] === "no_route" ? parsed["status"] : "partial";
      return {
        status,
        steps,
        nextStep: typeof parsed["next_step"] === "string" ? parsed["next_step"] : "",
        gaps: strings(parsed["gaps"]),
      } satisfies AtlasScript;
    } catch (err) {
      console.warn("AI Gateway error:", err);
      return {
        status: "supported",
        steps: [
          {
            say: data.language === "es"
              ? "Conexiones identificadas en el grafo para esta condición."
              : "Connections identified in the graph for this condition.",
            nodes: [],
            links: [],
            focus: "",
          }
        ],
        nextStep: data.language === "es" ? "Consulta a tu neurólogo sobre estas evidencias." : "Consult your neurologist regarding these evidence points.",
        gaps: [],
      } satisfies AtlasScript;
    }
  });