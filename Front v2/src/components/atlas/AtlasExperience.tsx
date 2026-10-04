"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Languages, Library, LogOut, Network, RotateCcw, Settings2, UsersRound, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";

import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { askAtlas } from "@/lib/atlas.functions";
import { buildAtlasContext } from "@/lib/atlas.subgraph";
import type { AtlasExperience as Experience, AtlasLanguage, AtlasProfile, AtlasScript, AtlasUserType, GraphData, GraphHighlight, GraphLink, GraphNode } from "@/lib/atlas.types";
import { graphId } from "@/lib/atlas.types";
import AtlasCommunityPanel from "@/components/atlas/AtlasCommunityPanel";
import { getProfile, saveProfile } from "@/lib/profile.functions";
import logo from "@/assets/iluminai-logo-completo-positivo.png";
import logoNegative from "@/assets/iluminai-logo-completo-negativo.png";
import zivaCalm from "@/assets/ziva-tranquila.png";
import zivaThink from "@/assets/ziva-pensando.png";
import zivaFind from "@/assets/mascota-encuentra-positivo.png";
import zivaUnsure from "@/assets/ziva-incertidumbre.png";

const GraphScene = lazy(() => import("./GraphScene"));
const EMPTY_HIGHLIGHT: GraphHighlight = { nodes: new Set(), links: new Set() };

const copy = {
  es: {
    question: "¿Qué quieres entender hoy?",
    placeholder: "Busca una enfermedad, gen o síntoma… o haz una pregunta",
    explore: "Explorar",
    evidencePath: "Ruta de evidencia",
    start: "Pregunta por una enfermedad, gen o síntoma. Ziva iluminará únicamente las conexiones respaldadas por este grafo.",
    evidence: "Evidencia",
    select: "Selecciona una conexión iluminada para revisar su fuente y nivel de confianza.",
    next: "Siguiente paso",
    gaps: "Lo que aún no está claro",
    noMatch: "No encontré una coincidencia directa en este grafo. Prueba con CACNA1A, ataxia episódica o migraña hemipléjica.",
    disclaimer: "Información educativa. Ziva no diagnostica ni sustituye a un profesional de salud.",
    reset: "Limpiar recorrido",
    profile: "Perfil y preferencias",
    logout: "Cerrar sesión",
    guided: "Guiado",
    professional: "Profesional",
    explorer: "Explorador de evidencia",
    ready: "Grafo listo",
    readyToExplore: "Lista para explorar",
    verifiedSources: "Fuentes verificables",
    evidenceFirst: "Cada conexión muestra su fuente y nivel de confianza.",
    askStage: "Haz una pregunta",
    traceStage: "Ziva traza las conexiones",
    reviewStage: "Revisa evidencia y confianza",
    startHere: "Empieza por una pregunta",
    startHint: "Elige un ejemplo o escribe lo que necesitas entender. Ziva trazará una ruta y mostrará sus fuentes.",
    zivaIntro: "Dime qué enfermedad, gen o síntoma quieres entender. Te mostraré las conexiones, sus fuentes y lo que aún no está claro.",
    viewGraph: "Ver grafo",
    backToChat: "Volver a la conversación",
    suggestions: ["¿Qué conecta CACNA1A con la ataxia episódica?", "Explorar síndrome de Dravet", "Relacionar convulsiones y retraso del desarrollo"],
  },
  en: {
    question: "What do you want to understand today?",
    placeholder: "Search a disease, gene, or symptom… or ask a question",
    explore: "Explore",
    evidencePath: "Evidence path",
    start: "Ask about a disease, gene, or symptom. Ziva will illuminate only connections supported by this graph.",
    evidence: "Evidence",
    select: "Select an illuminated connection to review its source and confidence.",
    next: "Next step",
    gaps: "What remains unclear",
    noMatch: "I couldn't find a direct match in this graph. Try CACNA1A, episodic ataxia, or hemiplegic migraine.",
    disclaimer: "Educational information. Ziva does not diagnose or replace a healthcare professional.",
    reset: "Clear path",
    profile: "Profile and preferences",
    logout: "Sign out",
    guided: "Guided",
    professional: "Professional",
    explorer: "Evidence explorer",
    ready: "Graph ready",
    readyToExplore: "Ready to explore",
    verifiedSources: "Verifiable sources",
    evidenceFirst: "Every connection shows its source and confidence level.",
    askStage: "Ask a question",
    traceStage: "Ziva traces the connections",
    reviewStage: "Review evidence and confidence",
    startHere: "Start with a question",
    startHint: "Choose an example or type what you need to understand. Ziva will trace a path and show its sources.",
    zivaIntro: "Tell me which disease, gene, or symptom you want to understand. I'll show you the connections, their sources, and what remains unclear.",
    viewGraph: "View graph",
    backToChat: "Back to conversation",
    suggestions: ["How is CACNA1A connected to episodic ataxia?", "Explore Dravet syndrome", "Connect seizures and developmental delay"],
  },
} as const;

const ROLE_LABEL: Record<AtlasLanguage, Record<AtlasUserType, string>> = {
  es: { family: "Paciente o familia", professional: "Profesional de salud", organization: "Organización" },
  en: { family: "Patient or family", professional: "Healthcare professional", organization: "Organization" },
};

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : "No pudimos completar la solicitud.";
}

function preferredLanguage(): AtlasLanguage {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

export default function AtlasExperience() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const loadProfile = useServerFn(getProfile);
  const persistProfile = useServerFn(saveProfile);
  const ask = useServerFn(askAtlas);
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => loadProfile() });
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [language, setLanguage] = useState<AtlasLanguage>(preferredLanguage);
  const [profile, setProfile] = useState<AtlasProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [activeQuestion, setActiveQuestion] = useState("");
  const [script, setScript] = useState<AtlasScript | null>(null);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [highlight, setHighlight] = useState<GraphHighlight>(EMPTY_HIGHLIGHT);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "graph">("chat");
  const [graphPanel, setGraphPanel] = useState<"evidence" | "community">("evidence");
  const text = copy[language];

  useEffect(() => {
    fetch("/data/graph.json").then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el grafo.");
      return response.json() as Promise<GraphData>;
    }).then(setGraph).catch((error: unknown) => toast.error(errorMessage(error)));
  }, []);

  useEffect(() => {
    if (profileQuery.data) {
      setProfile(profileQuery.data);
      if (profileQuery.data.language) setLanguage(profileQuery.data.language);
    }
  }, [profileQuery.data]);

  const allowed = useMemo(() => {
    if (!graph || !activeQuestion) return null;
    return buildAtlasContext(graph, activeQuestion);
  }, [activeQuestion, graph]);

  const selectedDisease = useMemo(() => {
    if (!graph) return null;
    if (selectedNode?.type === "disease") return selectedNode;
    const selectedIds = new Set<string>();
    if (selectedNode) selectedIds.add(selectedNode.id);
    if (selectedLink) {
      selectedIds.add(graphId(selectedLink.source));
      selectedIds.add(graphId(selectedLink.target));
    }
    const linkedDisease = graph.nodes.find((node) => node.type === "disease" && selectedIds.has(node.id));
    if (linkedDisease) return linkedDisease;
    for (const link of graph.links) {
      if (!selectedIds.has(graphId(link.source)) && !selectedIds.has(graphId(link.target))) continue;
      const other = selectedIds.has(graphId(link.source)) ? graphId(link.target) : graphId(link.source);
      const disease = graph.nodes.find((node) => node.id === other && node.type === "disease");
      if (disease) return disease;
    }
    return graph.nodes.find((node) => node.id === highlight.focus && node.type === "disease")
      ?? graph.nodes.find((node) => node.type === "disease" && highlight.nodes.has(node.id))
      ?? null;
  }, [graph, highlight, selectedLink, selectedNode]);

  useEffect(() => {
    if (!script || !graph || !allowed) return;
    let cancelled = false;
    let index = 0;
    speechSynthesis.cancel();
    const play = async () => {
      while (!cancelled && index < script.steps.length) {
        const step = script.steps[index];
        if (!step) break;
        const nodes = step.nodes.filter((id) => allowed.nodeIds.has(id));
        const links = step.links.filter((id) => allowed.linkIds.has(id));
        const nodeSet = new Set(nodes);
        graph.links.forEach((link) => {
          if (nodeSet.has(graphId(link.source)) && nodeSet.has(graphId(link.target))) links.push(link.id);
        });
        const focus = allowed.nodeIds.has(step.focus) ? step.focus : nodes[0];
        setHighlight(focus ? { nodes: nodeSet, links: new Set(links), focus } : { nodes: nodeSet, links: new Set(links) });
        setVisibleSteps(index + 1);
        if (profile?.voiceEnabled) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(step.say);
            utterance.lang = language === "es" ? "es-MX" : "en-US";
            utterance.rate = 0.94;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            speechSynthesis.speak(utterance);
          });
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 650));
        }
        index += 1;
      }
    };
    void play();
    return () => { cancelled = true; speechSynthesis.cancel(); };
  }, [allowed, graph, language, profile?.voiceEnabled, script]);

  const queryMutation = useMutation({
    mutationFn: async (value: string) => {
      if (!graph) throw new Error(language === "es" ? "El grafo todavía está cargando." : "The graph is still loading.");
      const context = buildAtlasContext(graph, value);
      if (!context.seeds.length) return null;
      setActiveQuestion(value);
      const result = await ask({ data: {
        question: value,
        context: context.text,
        language,
        experience: profile?.experience ?? "guided",
      }});
      return result;
    },
    onSuccess: (result) => {
      if (!result) {
        setScript({ status: "no_route", steps: [], nextStep: "", gaps: [text.noMatch] });
        setVisibleSteps(0);
        setHighlight(EMPTY_HIGHLIGHT);
        return;
      }
      setScript(result);
      setVisibleSteps(0);
      setSelectedLink(null);
      setSelectedNode(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveMutation = useMutation({
    mutationFn: (draft: AtlasProfile) => {
      if (!draft.userType || !draft.language) throw new Error("Completa tu perfil.");
      return persistProfile({ data: {
        displayName: draft.displayName,
        userType: draft.userType,
        language: draft.language,
        experience: draft.experience,
        voiceEnabled: draft.voiceEnabled,
      }});
    },
    onSuccess: (saved) => {
      setProfile(saved);
      setLanguage(saved.language ?? language);
      setProfileOpen(false);
      queryClient.setQueryData(["profile"], saved);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reset = () => {
    speechSynthesis.cancel();
    setScript(null);
    setActiveQuestion("");
    setVisibleSteps(0);
    setSelectedLink(null);
    setSelectedNode(null);
    setHighlight(EMPTY_HIGHLIGHT);
  };

  const submitQuestion = async (value: string) => {
    const clean = value.trim();
    if (!clean || queryMutation.isPending) return;
    setQuestion("");
    setMobilePanel("chat");
    await queryMutation.mutateAsync(clean);
  };

  if (profileQuery.isLoading || !graph) {
    return <div className="flex min-h-dvh items-center justify-center bg-graph-surface"><Shimmer className="font-display text-lg">Iluminando el grafo…</Shimmer></div>;
  }

  if (!profile) {
    return <Onboarding language={language} onLanguage={setLanguage} onSave={(draft) => saveMutation.mutate(draft)} busy={saveMutation.isPending} />;
  }

  const selectedSource = selectedLink ? graph.nodes.find((node) => node.id === graphId(selectedLink.source)) : null;
  const selectedTarget = selectedLink ? graph.nodes.find((node) => node.id === graphId(selectedLink.target)) : null;
  const ziva = queryMutation.isPending ? zivaThink : script?.status === "supported" ? zivaFind : script ? zivaUnsure : zivaCalm;

  return (
    <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <div className={`absolute inset-x-0 bottom-0 top-16 bg-graph-surface md:left-[430px] ${mobilePanel === "graph" ? "block" : "hidden md:block"}`}>
        <Suspense fallback={<div className="flex size-full items-center justify-center text-primary-foreground"><Shimmer>Preparando el grafo…</Shimmer></div>}>
          <GraphScene data={graph} highlight={highlight} onNodeClick={(node) => { setSelectedNode(node); setSelectedLink(null); }} onLinkClick={(link) => { setSelectedLink(link); setSelectedNode(null); }} />
        </Suspense>
      </div>

      <header className="absolute inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
        <Link to="/" className="min-w-0" aria-label="IluminAI, inicio"><img src={logo} alt="IluminAI" className="h-9 w-auto" /></Link>
        <div className="hidden min-w-0 items-center gap-3 md:flex"><span className="size-2 rounded-full bg-graph-evidence" /><span className="font-display text-sm font-semibold">{text.explorer}</span><span className="text-xs text-muted-foreground">{text.verifiedSources}</span></div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">{text[profile.experience]}</Badge>
          <Button variant="ghost" size="icon" className="size-11 sm:size-9" aria-label={text.profile} title={text.profile} onClick={() => setProfileOpen(true)}><Settings2 /></Button>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label={text.logout} title={text.logout} onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}><LogOut /></Button>
        </div>
      </header>

      <aside className={`absolute bottom-0 left-0 top-16 z-30 w-full flex-col overflow-hidden border-r bg-card text-foreground md:flex md:w-[430px] ${mobilePanel === "chat" ? "flex" : "hidden"}`}>
        <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 sm:px-5">
          <div className="relative shrink-0"><img src={ziva} alt="Ziva" className="atlas-ziva-presence size-12 object-contain" /><span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-accent" /></div>
          <div className="min-w-0"><h1 className="truncate font-display text-base font-semibold">Ziva</h1><p className="truncate text-[11px] font-semibold uppercase text-accent-foreground">{text.evidencePath} · {text.readyToExplore}</p></div>
          <div className="flex items-center gap-1">
            {script && <Button variant="ghost" size="icon" className="size-10" onClick={reset} aria-label={text.reset} title={text.reset}><RotateCcw /></Button>}
            <Button variant="ghost" size="icon" className="size-10 md:hidden" onClick={() => setMobilePanel("graph")} aria-label={text.viewGraph} title={text.viewGraph}><Network /></Button>
          </div>
        </div>

        <Conversation className="min-h-0 flex-1 bg-background">
          <ConversationContent className="gap-5 px-4 pb-4 pt-4 sm:px-5">
            {!script && !queryMutation.isPending && <div className="atlas-route-step grid grid-cols-[44px_minmax(0,1fr)] gap-3">
              <img src={zivaCalm} alt="Ziva" className="ziva-friendly size-11 object-contain" />
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">{text.startHere}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text.zivaIntro}</p>
                <div className="-mr-4 mt-3 flex gap-2 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {text.suggestions.map((suggestion) => <Button key={suggestion} type="button" variant="outline" size="sm" className="h-9 max-w-[220px] shrink-0 rounded-md px-3 text-left text-xs" disabled={queryMutation.isPending} onClick={() => void submitQuestion(suggestion)}>{suggestion}</Button>)}
                </div>
              </div>
            </div>}
            {activeQuestion && <Message from="user"><MessageContent>{activeQuestion}</MessageContent></Message>}
            {queryMutation.isPending && <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3"><img src={zivaThink} alt="Ziva pensando" className="atlas-ziva-presence size-9 object-contain" /><Message from="assistant"><MessageContent><Shimmer>{language === "es" ? "Estoy siguiendo las conexiones y revisando sus fuentes…" : "I'm following the connections and reviewing their sources…"}</Shimmer></MessageContent></Message></div>}
            {script?.steps.slice(0, visibleSteps).map((step, index) => <div className="atlas-route-step grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3" key={`${step.focus}-${index}`}><img src={index === visibleSteps - 1 ? ziva : zivaCalm} alt="Ziva" className="size-9 object-contain" /><Message from="assistant"><MessageContent><MessageResponse>{step.say}</MessageResponse></MessageContent></Message></div>)}
            {script?.status === "no_route" && <div className="atlas-route-step grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3"><img src={zivaUnsure} alt="Ziva" className="size-9 object-contain" /><Message from="assistant"><MessageContent>{text.noMatch}</MessageContent></Message></div>}
            {script && visibleSteps >= script.steps.length && script.nextStep && <div className="atlas-route-step ml-12 border-l-2 border-accent pl-3 text-sm"><strong>{text.next}</strong><p className="mt-1 leading-relaxed text-muted-foreground">{script.nextStep}</p></div>}
            {script && visibleSteps >= script.steps.length && script.gaps.length > 0 && <div className="atlas-route-step ml-12 rounded-md bg-secondary p-3 text-sm"><strong className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0" />{text.gaps}</strong><ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed text-muted-foreground">{script.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></div>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="shrink-0 border-t bg-card px-3 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
          <PromptInput className="border-border bg-background shadow-none" onSubmit={async ({ text: value }) => submitQuestion(value)}>
            <PromptInputTextarea autoFocus className="min-h-12 bg-background text-foreground" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text.placeholder} />
            <PromptInputFooter className="border-t border-border px-2 py-1.5"><span className="truncate text-[11px] text-muted-foreground">{graph.nodes.length} nodos · {graph.links.length} conexiones</span><PromptInputSubmit className="size-10" aria-label={text.explore} disabled={!question.trim()} status={queryMutation.isPending ? "submitted" : "ready"} /></PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">{text.disclaimer}</p>
        </div>
      </aside>

      <div className="pointer-events-none absolute left-[454px] top-20 z-20 hidden items-center gap-2 text-primary-foreground md:flex"><span className="size-2 rounded-full bg-graph-evidence" /><span className="text-xs font-semibold">{text.ready}</span><span className="text-xs text-primary-foreground/65">· {graph.nodes.length} nodos conectados</span></div>

      {mobilePanel === "graph" && <Button variant="secondary" className="absolute left-4 top-20 z-30 md:hidden" onClick={() => setMobilePanel("chat")}><ArrowLeft />{text.backToChat}</Button>}

      <div className={`absolute right-4 top-20 z-30 gap-1 rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur ${mobilePanel === "graph" ? "flex" : "hidden md:flex"}`}>
        <Button variant={graphPanel === "evidence" ? "default" : "ghost"} size="sm" className="h-9 px-3" onClick={() => setGraphPanel("evidence")}><Network className="size-4" /><span className="hidden sm:inline">{text.evidence}</span></Button>
        <Button variant={graphPanel === "community" ? "default" : "ghost"} size="sm" className="h-9 px-3" onClick={() => { setGraphPanel("community"); if (window.matchMedia("(max-width: 767px)").matches) setMobilePanel("graph"); }}><UsersRound className="size-4" /><span>{language === "es" ? "Comunidad" : "Community"}</span></Button>
      </div>

      {mobilePanel === "graph" && <div className="absolute inset-x-3 bottom-3 z-40 md:hidden">
        <PromptInput className="border-border bg-card shadow-xl" onSubmit={async ({ text: value }) => submitQuestion(value)}>
          <PromptInputTextarea className="min-h-11 bg-card text-foreground" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text.placeholder} />
          <PromptInputFooter className="border-t border-border px-2 py-1.5"><span className="truncate text-[11px] text-muted-foreground">{graph.nodes.length} {language === "es" ? "nodos conectados" : "connected nodes"}</span><PromptInputSubmit className="size-10" aria-label={text.explore} disabled={!question.trim()} status={queryMutation.isPending ? "submitted" : "ready"} /></PromptInputFooter>
        </PromptInput>
      </div>}

      {graphPanel === "community" && <div className={`absolute z-20 ${mobilePanel === "graph" ? "bottom-[5.6rem] left-3 right-3 top-auto h-[min(44vh,410px)] md:bottom-4 md:left-auto md:right-4 md:top-[8.75rem] md:h-auto md:w-[min(92vw,390px)]" : "hidden md:bottom-4 md:left-auto md:right-4 md:top-[8.75rem] md:block md:h-auto md:w-[min(92vw,390px)]"}`}>
        <AtlasCommunityPanel
          graph={graph}
          disease={selectedDisease}
          language={language}
          onExplore={(suggestion) => void submitQuestion(suggestion)}
          onFocusOrganization={(organization, link) => {
            setSelectedNode(organization);
            setSelectedLink(link);
            setHighlight({ nodes: new Set([organization.id, graphId(link.source), graphId(link.target)]), links: new Set([link.id]), focus: organization.id });
          }}
        />
      </div>}

      {graphPanel === "evidence" && (selectedLink || selectedNode) && <aside className={`absolute ${mobilePanel === "graph" ? "bottom-[6.8rem]" : "bottom-5"} right-4 z-30 max-h-[52vh] w-[calc(100%-2rem)] overflow-y-auto rounded-md border bg-background p-5 text-foreground shadow-xl md:bottom-5 md:right-5 md:w-[min(92vw,360px)]`}>
        <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" aria-label="Cerrar" onClick={() => { setSelectedLink(null); setSelectedNode(null); }}><X /></Button>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-accent-foreground"><Library className="size-4" />{text.evidence}</p>
        {selectedNode && <><h2 className="mt-2 pr-8 font-display text-xl font-semibold">{selectedNode.label}</h2><Badge className="mt-2" variant="secondary">{selectedNode.type}</Badge><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{selectedNode.summary_plain}</p></>}
        {selectedLink && <><h2 className="mt-2 pr-8 font-display text-lg font-semibold">{selectedSource?.label} → {selectedTarget?.label}</h2><div className="mt-3 flex flex-wrap gap-2"><Badge>{selectedLink.type.replaceAll("_", " ")}</Badge><Badge variant="secondary">{selectedLink.status}</Badge><Badge variant="outline">{Math.round(selectedLink.confidence * 100)}%</Badge></div><div className="mt-4 space-y-3">{selectedLink.evidence?.length ? selectedLink.evidence.map((evidence) => <a key={`${evidence.url}-${evidence.quote}`} href={evidence.url} target="_blank" rel="noreferrer" className="block rounded-md border p-3 text-sm hover:bg-secondary"><strong>{evidence.source}</strong><p className="mt-1 text-muted-foreground">“{evidence.quote}”</p></a>) : <p className="text-sm text-muted-foreground">{text.select}</p>}</div>{!!selectedLink.contradicts?.length && <p className="mt-4 rounded-md bg-secondary p-3 text-sm"><AlertTriangle className="mr-2 inline size-4 text-graph-alert" />{selectedLink.contradicts.join(", ")}</p>}</>}
      </aside>}

      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
         <SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{text.profile}</SheetTitle><SheetDescription>{text.disclaimer}</SheetDescription></SheetHeader><ProfileForm profile={profile} language={language} onSave={(draft) => saveMutation.mutate(draft)} busy={saveMutation.isPending} /><Button variant="outline" className="mt-6 h-11 w-full" onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}><LogOut />{text.logout}</Button></SheetContent>
      </Sheet>
    </main>
  );
}

function Onboarding({ language, onLanguage, onSave, busy }: { language: AtlasLanguage; onLanguage: (value: AtlasLanguage) => void; onSave: (profile: AtlasProfile) => void; busy: boolean }) {
  const [draft, setDraft] = useState<AtlasProfile>({ id: "", displayName: "", userType: null, language, experience: "guided", voiceEnabled: true, onboardingCompleted: false });
  const labels = copy[language];
  useEffect(() => setDraft((value) => ({ ...value, language })), [language]);
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-graph-surface lg:block">
        <div className="atlas-node-field absolute inset-0 opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-foreground">
          <img src={logoNegative} alt="IluminAI" className="h-10 w-fit" />
          <div><p className="font-display text-4xl font-semibold">{labels.question}</p><p className="mt-4 max-w-lg text-base text-primary-foreground/75">{labels.start}</p></div>
          <p className="text-sm text-primary-foreground/65">Rare Disease Intelligence</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between"><img src={logo} alt="IluminAI" className="h-9 w-auto lg:hidden" /><Button variant="ghost" size="sm" onClick={() => { const next = language === "es" ? "en" : "es"; onLanguage(next); }}><Languages />{language.toUpperCase()}</Button></div>
          <img src={zivaCalm} alt="Ziva" className="mx-auto mt-6 h-32 w-32 object-contain" />
          <h1 className="mt-5 text-center font-display text-3xl font-semibold">{language === "es" ? "Hola, soy Ziva." : "Hi, I'm Ziva."}</h1>
          <p className="mx-auto mt-2 max-w-md text-center text-muted-foreground">{language === "es" ? "Para mostrarte la evidencia con el nivel de detalle adecuado, cuéntame un poco sobre ti." : "To show evidence at the right level of detail, tell me a little about yourself."}</p>
          <ProfileForm profile={draft} language={language} onSave={onSave} onChange={setDraft} busy={busy} onboarding />
        </div>
      </section>
    </main>
  );
}

function ProfileForm({ profile, language, onSave, onChange, busy, onboarding = false }: { profile: AtlasProfile; language: AtlasLanguage; onSave: (profile: AtlasProfile) => void; onChange?: (profile: AtlasProfile) => void; busy: boolean; onboarding?: boolean }) {
  const [draft, setDraft] = useState(profile);
  const update = (next: AtlasProfile) => { setDraft(next); onChange?.(next); };
  return <form className="mt-7 space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
    <div className="space-y-2"><Label htmlFor="display-name">{language === "es" ? "¿Cómo te llamamos?" : "What should we call you?"}</Label><Input id="display-name" required value={draft.displayName} onChange={(event) => update({ ...draft, displayName: event.target.value })} placeholder={language === "es" ? "Tu nombre" : "Your name"} /></div>
    <div className="space-y-2"><Label>{language === "es" ? "Estoy explorando como…" : "I'm exploring as…"}</Label><div className="grid gap-2 sm:grid-cols-3">{(["family", "professional", "organization"] as const).map((role) => <Button key={role} type="button" variant={draft.userType === role ? "default" : "outline"} className="h-auto min-h-14 whitespace-normal px-3 py-2" onClick={() => update({ ...draft, userType: role, experience: role === "family" ? "guided" : "professional" })}>{ROLE_LABEL[language][role]}</Button>)}</div></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>{language === "es" ? "Idioma" : "Language"}</Label><Select value={draft.language ?? language} onValueChange={(value: AtlasLanguage) => update({ ...draft, language: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="es">Español</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label>{language === "es" ? "Nivel de detalle" : "Detail level"}</Label><Select value={draft.experience} onValueChange={(value: Experience) => update({ ...draft, experience: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guided">{copy[language].guided}</SelectItem><SelectItem value="professional">{copy[language].professional}</SelectItem></SelectContent></Select></div>
    </div>
    <div className="flex items-center justify-between rounded-md border p-3"><div><Label htmlFor="voice">{language === "es" ? "Narración de Ziva" : "Ziva narration"}</Label><p className="mt-1 text-xs text-muted-foreground">{language === "es" ? "Lee en voz alta cada paso del recorrido." : "Reads each evidence step aloud."}</p></div><div className="flex items-center gap-2">{draft.voiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}<Switch id="voice" checked={draft.voiceEnabled} onCheckedChange={(checked) => update({ ...draft, voiceEnabled: checked })} /></div></div>
    <Button type="submit" size="lg" className="w-full" disabled={busy || !draft.displayName.trim() || !draft.userType}>{busy ? (language === "es" ? "Guardando…" : "Saving…") : onboarding ? (language === "es" ? "Explorar el grafo" : "Explore the graph") : (language === "es" ? "Guardar preferencias" : "Save preferences")}</Button>
  </form>;
}
