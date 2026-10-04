import { createFileRoute } from "@tanstack/react-router";
import AtlasExperience from "@/components/atlas/AtlasExperience";

export const Route = createFileRoute("/_authenticated/atlas")({
  head: () => ({
    meta: [
      { title: "Explorar el grafo · IluminAI" },
      { name: "description", content: "Explora conexiones trazables entre enfermedades raras, genes, síntomas, estudios y comunidades con Ziva." },
      { property: "og:title", content: "Explorar el grafo · IluminAI" },
      { property: "og:description", content: "Sigue la evidencia de enfermedades raras en un grafo guiado por Ziva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AtlasExperience,
});