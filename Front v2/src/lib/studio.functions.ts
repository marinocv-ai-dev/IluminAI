import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BrandGuide = {
  nombre: string;
  resumen: string;
  personalidad: string[];
  tono: { descripcion: string; ejemplos: string[] };
  paleta: { nombre: string; hex: string; uso: string }[];
  tipografia: { titulos: string; cuerpo: string; razon: string };
  principios_ui: string[];
};

export type UiReview = {
  puntuacion: number;
  resumen: string;
  fortalezas: string[];
  problemas: { titulo: string; gravedad: "alta" | "media" | "baja"; detalle: string; solucion: string }[];
};

export type StudioResult = {
  id: string;
  kind: "brand" | "review";
  title: string;
  input: string;
  output: BrandGuide | UiReview;
  created_at: string;
};

const BRAND_SYSTEM = `Eres directora de branding corporativo y diseño UI/UX. Responde SIEMPRE en español y SOLO con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{"nombre": string, "resumen": string (2-3 frases), "personalidad": string[] (4 rasgos), "tono": {"descripcion": string, "ejemplos": string[] (3 frases de ejemplo)}, "paleta": [{"nombre": string, "hex": "#RRGGBB", "uso": string}] (5 colores con buen contraste), "tipografia": {"titulos": string (fuente de Google Fonts), "cuerpo": string (fuente de Google Fonts), "razon": string}, "principios_ui": string[] (5 principios concretos de interfaz)}`;

const REVIEW_SYSTEM = `Eres experta en diseño UI/UX y accesibilidad. Analiza la captura de pantalla. Responde SIEMPRE en español y SOLO con un objeto JSON válido, sin texto adicional, con esta forma exacta:
{"puntuacion": number (0-100), "resumen": string (2-3 frases), "fortalezas": string[] (3 puntos), "problemas": [{"titulo": string, "gravedad": "alta"|"media"|"baja", "detalle": string, "solucion": string}] (3 a 6, ordenados por gravedad)}`;

async function save(
  supabase: SupabaseClient<Database>,
  row: { kind: "brand" | "review"; title: string; input: string; output: unknown },
) {
  const { data, error } = await supabase
    .from("studio_results")
    .insert({ ...row, output: row.output as Json })
    .select()
    .single();
  if (error) throw new Error("No se pudo guardar el resultado: " + error.message);
  return data as unknown as StudioResult;
}

export const generateBrandGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ brief: z.string().trim().min(10).max(3000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runGemini, parseJson } = await import("./ai/gateway.server");
    const text = await runGemini(BRAND_SYSTEM, [
      { role: "user", content: `Descripción de la marca o proyecto:\n${data.brief}` },
    ]);
    const guide = parseJson<BrandGuide>(text);
    return save(context.supabase, {
      kind: "brand",
      title: guide.nombre || "Guía de marca",
      input: data.brief,
      output: guide,
    });
  });

export const reviewScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        image: z.string().startsWith("data:image/").max(6_000_000),
        context: z.string().trim().max(1000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runGemini, parseJson } = await import("./ai/gateway.server");
    const text = await runGemini(REVIEW_SYSTEM, [
      {
        role: "user",
        content: [
          { type: "text", text: data.context ? `Contexto: ${data.context}` : "Revisa esta pantalla." },
          { type: "image", image: data.image },
        ],
      },
    ]);
    const review = parseJson<UiReview>(text);
    return save(context.supabase, {
      kind: "review",
      title: data.context ? data.context.slice(0, 60) : "Revisión de pantalla",
      input: data.context,
      output: review,
    });
  });

export const listResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("studio_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as StudioResult[];
  });

export const deleteResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("studio_results").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
