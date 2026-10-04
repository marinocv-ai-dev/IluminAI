import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type ModelMessage } from "ai";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const GEMINI_MODEL = "google/gemini-3.8-flash";

export class AiGatewayError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function createProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_URL,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

function friendly(status: number, fallback: string) {
  if (status === 429) return "Hay demasiadas solicitudes en este momento. Intenta de nuevo en un minuto.";
  if (status === 402) return "Se agotaron los créditos de IA del espacio de trabajo. Añade créditos en Ajustes → Planes y créditos.";
  if (status === 403) return "El acceso a la IA está bloqueado para este espacio de trabajo.";
  return fallback;
}

/** Streams a Gemini call server-side and returns the final text. */
export async function runGemini(system: string, messages: ModelMessage[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiGatewayError("Falta configurar la clave de IA.", 401);
  const provider = createProvider(apiKey);
  let streamError: unknown;
  const result = streamText({
    model: provider(GEMINI_MODEL),
    system,
    messages,
    onError: ({ error }) => {
      streamError = error;
    },
  });
  let text = "";
  try {
    text = await result.text;
  } catch (e) {
    streamError ??= e;
  }
  if (streamError || !text.trim()) {
    const err = streamError as { statusCode?: number; message?: string } | undefined;
    const status = err?.statusCode ?? 500;
    throw new AiGatewayError(friendly(status, "La IA no pudo completar la solicitud. Intenta de nuevo."), status);
  }
  return text;
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new AiGatewayError("La IA devolvió una respuesta incompleta. Intenta de nuevo.", 500);
  }
}
