import { useMemo } from "react";
import { ArrowUpRight, Compass, HeartHandshake, Network, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import mascotFindNegative from "@/assets/mascota-encuentra-negativo.png";
import type { AtlasLanguage, GraphData, GraphLink, GraphNode } from "@/lib/atlas.types";
import { graphId } from "@/lib/atlas.types";

export default function AtlasCommunityPanel({
  graph,
  disease,
  language,
  onExplore,
  onFocusOrganization,
}: {
  graph: GraphData;
  disease: GraphNode | null;
  language: AtlasLanguage;
  onExplore: (question: string) => void;
  onFocusOrganization: (organization: GraphNode, link: GraphLink) => void;
}) {
  const resources = useMemo(() => {
    if (!disease) return [];
    const organizations = new Map<string, { node: GraphNode; link: GraphLink }>();
    graph.links.forEach((link) => {
      const sourceId = graphId(link.source);
      const targetId = graphId(link.target);
      const organizationId = sourceId === disease.id ? targetId : targetId === disease.id ? sourceId : null;
      if (!organizationId) return;
      const node = graph.nodes.find((item) => item.id === organizationId && item.type === "patient_group");
      if (node) organizations.set(node.id, { node, link });
    });
    return [...organizations.values()].sort((a, b) => a.node.label.localeCompare(b.node.label));
  }, [disease, graph]);

  const spanish = language === "es";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card text-foreground shadow-2xl" aria-label={spanish ? "Comunidades por enfermedad" : "Communities by disease"}>
      <header className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground"><UsersRound className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-foreground">{spanish ? "Red de apoyo" : "Support network"}</p>
          <h2 className="mt-1 font-display text-lg font-semibold">{spanish ? "Comunidades por enfermedad" : "Communities by disease"}</h2>
        </div>
        <Badge variant="outline" className="shrink-0">{spanish ? "Atlas" : "Atlas"}</Badge>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        {disease ? (
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{spanish ? "Enfermedad seleccionada" : "Selected condition"}</p>
            <h3 className="mt-1 font-display text-lg font-semibold">{disease.label}</h3>
            {disease.summary_plain && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{disease.summary_plain}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-background px-4 py-5 text-center">
            <Compass className="mx-auto size-6 text-accent-foreground" />
            <h3 className="mt-2 font-display font-semibold">{spanish ? "Empieza por una enfermedad" : "Start with a condition"}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{spanish ? "Al elegir una enfermedad, Atlas reúne evidencia y recursos de apoyo relacionados." : "Choose a condition and Atlas will bring together related evidence and support resources."}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onExplore(spanish ? "Explorar síndrome de Dravet" : "Explore Dravet syndrome")}>{spanish ? "Síndrome de Dravet" : "Dravet syndrome"}</Button>
              <Button variant="outline" size="sm" onClick={() => onExplore(spanish ? "Explorar ataxia episódica tipo 2" : "Explore episodic ataxia type 2")}>{spanish ? "Ataxia episódica tipo 2" : "Episodic ataxia type 2"}</Button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold">{spanish ? "Organizaciones conectadas" : "Connected organizations"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{spanish ? "Recursos de apoyo enlazados en el grafo" : "Support resources linked in the graph"}</p>
            </div>
            <Network className="size-4 shrink-0 text-muted-foreground" />
          </div>
          {resources.length ? (
            <ul className="space-y-2">
              {resources.map(({ node, link }) => {
                const source = link.evidence?.[0];
                return (
                  <li key={node.id} className="rounded-xl border bg-background p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><HeartHandshake className="size-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug">{node.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{node.summary_plain}</p>
                        {source && <p className="mt-2 text-[11px] text-muted-foreground">{spanish ? "Fuente del vínculo" : "Connection source"}: {source.source}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                      <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => onFocusOrganization(node, link)}><Network className="size-4" />{spanish ? "Ver conexión" : "View connection"}</Button>
                      {source?.url && <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:bg-secondary">{spanish ? "Visitar" : "Visit"}<ArrowUpRight className="size-3.5" /></a>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">{spanish ? "Aún no hay organizaciones enlazadas a esta enfermedad en el grafo." : "There are no organizations linked to this condition in the graph yet."}</p>
          )}
        </div>

        <div className="relative overflow-hidden rounded-xl bg-primary p-4 text-primary-foreground">
          <img src={mascotFindNegative} alt="" aria-hidden="true" className="absolute -right-1 -top-2 size-[4.5rem] object-contain opacity-95" />
          <div className="relative pr-14">
            <div className="flex items-center gap-2"><UsersRound className="size-4 text-accent" /><p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">{spanish ? "Familias y pacientes" : "Families and patients"}</p></div>
            <h3 className="mt-2 font-display text-base font-semibold">{spanish ? "Un espacio compartido por enfermedad" : "A shared space for each condition"}</h3>
            <p className="mt-1 text-sm leading-relaxed text-primary-foreground/75">{spanish ? "La siguiente capa de Atlas reunirá a personas que quieran participar en una comunidad moderada para esta enfermedad. La conexión será voluntaria y estará bajo su control." : "The next Atlas layer will bring together people who choose to join a moderated community for this condition. Participation will be voluntary and in their control."}</p>
          </div>
          <Badge variant="outline" className="mt-3 border-primary-foreground/20 text-primary-foreground">{spanish ? "En diseño" : "In design"}</Badge>
        </div>
      </div>
    </section>
  );
}
