import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import logo from "@/assets/iluminai-logo-completo-positivo.png";
import ziva from "@/assets/mascota-encuentra-positivo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IluminAI · Rare Disease Intelligence" },
      { name: "description", content: "Conecta enfermedades raras, genes, síntomas, estudios y comunidades en un grafo de evidencia trazable." },
      { property: "og:title", content: "IluminAI · Rare Disease Intelligence" },
      { property: "og:description", content: "Explora evidencia conectada sobre enfermedades raras con la guía de Ziva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-card">
      <GraphPattern />
      <header className="relative z-10 mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 sm:px-8 sm:py-5">
        <img src={logo} alt="IluminAI" className="h-9 w-auto sm:h-10" />
        <Button asChild variant="outline" className="h-10 bg-card/80 backdrop-blur-sm sm:h-11"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-64px)] max-w-6xl content-center gap-7 px-5 pb-7 pt-5 sm:min-h-[calc(100dvh-80px)] sm:gap-10 sm:px-8 sm:pb-10 lg:grid-cols-[1fr_380px] lg:items-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-accent-foreground sm:text-sm"><span className="size-2 rounded-full bg-accent" />Grafo Atlas · Rare Disease Intelligence</div>
          <h1 className="mt-5 max-w-3xl font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-primary sm:mt-6 sm:text-6xl">La evidencia conecta. La comunidad acompaña.</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">Explora cómo se relacionan enfermedades raras, genes, síntomas y estudios. Encuentra organizaciones de apoyo conectadas a cada condición y descubre rutas para que ninguna familia avance sola.</p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-12 w-full rounded-xl sm:w-auto"><Link to="/atlas">Explorar el Grafo Atlas</Link></Button>
            <span className="text-center text-xs text-muted-foreground sm:max-w-52 sm:text-left">Evidencia trazable y redes de apoyo alrededor de cada enfermedad.</span>
          </div>
          <div className="mt-7 grid max-w-2xl gap-3 sm:mt-9 sm:grid-cols-2">
            <div className="rounded-xl border bg-card/85 p-4 shadow-sm backdrop-blur-sm"><p className="text-xs font-bold uppercase tracking-wide text-accent-foreground">01 · Comprende</p><p className="mt-1 font-display text-sm font-semibold text-primary">Sigue conexiones respaldadas por evidencia.</p></div>
            <div className="rounded-xl border bg-card/85 p-4 shadow-sm backdrop-blur-sm"><p className="text-xs font-bold uppercase tracking-wide text-accent-foreground">02 · Encuentra apoyo</p><p className="mt-1 font-display text-sm font-semibold text-primary">Ubica organizaciones ligadas a cada enfermedad.</p></div>
          </div>
          <p className="mt-5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground sm:mt-6 sm:text-xs">Información educativa. IluminAI no diagnostica ni sustituye la evaluación de un profesional de salud. Las comunidades de familias se están diseñando con participación voluntaria.</p>
        </div>
        <div className="relative flex min-h-40 items-center justify-center px-8 sm:min-h-80 sm:pt-8">
          <div className="absolute inset-x-4 bottom-4 top-2 rounded-[2rem] bg-gradient-to-b from-accent/20 via-accent/5 to-transparent sm:inset-x-0 sm:bottom-0 sm:top-0" />
          <div className="absolute bottom-2 h-px w-40 bg-border sm:w-56" />
          <div className="absolute size-40 rounded-full bg-accent/10 blur-2xl sm:size-64" />
          <img src={ziva} alt="Ziva encuentra una conexión para explorar" className="ziva-friendly relative z-10 w-full max-w-32 object-contain sm:max-w-72" />
          <div className="absolute bottom-3 right-1 rounded-xl border bg-card/95 px-3 py-2 text-xs font-semibold text-primary shadow-md sm:bottom-12 sm:right-0 sm:px-4 sm:py-3 sm:text-sm"><span className="mr-2 inline-block size-2 rounded-full bg-accent" />Un camino compartido empieza aquí</div>
        </div>
      </section>
    </main>
  );
}

function GraphPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 text-primary" aria-hidden="true">
      <svg className="h-full w-full opacity-[0.075]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="evidence-network" width="148" height="126" patternUnits="userSpaceOnUse">
            <path className="graph-pattern-link" d="M18 20 88 42 42 101 18 20M88 42l48 49M42 101l94-10" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <circle cx="18" cy="20" r="2.5" fill="currentColor" />
            <circle className="graph-pattern-node" cx="88" cy="42" r="3.5" fill="currentColor" />
            <circle cx="42" cy="101" r="2" fill="currentColor" />
            <circle className="graph-pattern-node graph-pattern-node-delay" cx="136" cy="91" r="3" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#evidence-network)" />
      </svg>
    </div>
  );
}
