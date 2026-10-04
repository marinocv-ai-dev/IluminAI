"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import type { GraphData, GraphHighlight, GraphLink, GraphNode } from "@/lib/atlas.types";
import { graphId } from "@/lib/atlas.types";

const TAG: Record<string, string> = {
  disease: "DX", gene: "GEN", variant: "VAR", mechanism: "MECH", phenotype: "HPO",
  patient_group: "GROUP", researcher: "RES", funder: "FUND", study: "STUDY",
  asset: "ASSET", treatment: "TX", paper: "EVID",
};

type Palette = { surface: string; node: string; evidence: string; alert: string; mist: string; dim: string };

function cssColorToRgb(value: string) {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return value;
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export default function GraphScene({ data, highlight, onNodeClick, onLinkClick }: {
  data: GraphData;
  highlight: GraphHighlight;
  onNodeClick: (node: GraphNode) => void;
  onLinkClick: (link: GraphLink) => void;
}) {
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [size, setSize] = useState({ width: 800, height: 700 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const active = highlight.nodes.size > 0;
  const degree = useMemo(() => {
    const result: Record<string, number> = {};
    data.links.forEach((link) => [graphId(link.source), graphId(link.target)].forEach((id) => { result[id] = (result[id] ?? 0) + 1; }));
    return result;
  }, [data]);

  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    setPalette({
      surface: cssColorToRgb(root.getPropertyValue("--graph-surface").trim()),
      node: cssColorToRgb(root.getPropertyValue("--graph-node").trim()),
      evidence: cssColorToRgb(root.getPropertyValue("--graph-evidence").trim()),
      alert: cssColorToRgb(root.getPropertyValue("--graph-alert").trim()),
      mist: cssColorToRgb(root.getPropertyValue("--primary-foreground").trim()),
      dim: cssColorToRgb(root.getPropertyValue("--graph-node").trim()),
    });
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: Math.max(320, entry.contentRect.width), height: Math.max(360, entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const charge = graphRef.current?.d3Force("charge");
    if (charge && "strength" in charge && typeof charge["strength"] === "function") charge["strength"](-140);
  }, []);

  useEffect(() => {
    const node = data.nodes.find((item) => item.id === highlight.focus);
    if (!node || node.x === undefined || node.y === undefined || !graphRef.current) return;
    const z = node.z ?? 1;
    const ratio = 1 + 260 / Math.max(1, Math.hypot(node.x, node.y, z));
    graphRef.current.cameraPosition({ x: node.x * ratio, y: node.y * ratio, z: z * ratio }, { x: node.x, y: node.y, z }, 1100);
  }, [data.nodes, highlight.focus]);

  return (
    <div ref={wrapperRef} className="size-full overflow-hidden bg-graph-surface" aria-label="Grafo tridimensional de evidencia">
      {palette && <ForceGraph3D<GraphNode, GraphLink>
        ref={graphRef}
        graphData={data}
        width={size.width}
        height={size.height}
        backgroundColor={palette.surface}
        showNavInfo={false}
        nodeVal={(node) => (node.id === highlight.focus ? 10 : 2) + (degree[node.id] ?? 0)}
        nodeColor={(node) => highlight.nodes.has(node.id) ? palette.evidence : active ? palette.dim : (node.type === "disease" ? palette.mist : palette.node)}
        nodeOpacity={active ? 0.72 : 0.95}
        nodeResolution={20}
        nodeLabel={(node) => `${TAG[node.type] ?? node.type} · ${node.label}`}
        nodeThreeObjectExtend
        nodeThreeObject={(node) => {
          if (!highlight.nodes.has(node.id)) return new SpriteText("");
          const sprite = new SpriteText(`${TAG[node.type] ?? ""}  ${node.label}`);
          sprite.fontFace = "Manrope, sans-serif";
          sprite.fontWeight = "600";
          sprite.color = node.id === highlight.focus ? palette.surface : palette.evidence;
          sprite.backgroundColor = node.id === highlight.focus ? palette.evidence : palette.surface;
          sprite.padding = 3;
          sprite.borderRadius = 2;
          sprite.textHeight = node.id === highlight.focus ? 7 : 5;
          sprite.position.y = 12;
          return sprite;
        }}
        linkColor={(link) => {
          const lit = highlight.links.has(link.id);
          if (link.contradicts?.length && (lit || !active)) return palette.alert;
          if (lit) return palette.evidence;
          return active ? palette.surface : palette.node;
        }}
        linkOpacity={active ? 0.25 : 0.5}
        linkWidth={(link) => highlight.links.has(link.id) ? 2 : 0.25}
        linkDirectionalParticles={(link) => highlight.links.has(link.id) ? 3 : 0}
        linkDirectionalParticleColor={() => palette.evidence}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.007}
        linkLabel={(link) => `${link.type.replaceAll("_", " ")} · ${link.status} · ${Math.round(link.confidence * 100)}%`}
        cooldownTime={3500}
        onEngineStop={() => {
          if (fitted.current) return;
          fitted.current = true;
          graphRef.current?.zoomToFit(800, 60);
        }}
        onNodeClick={(node) => onNodeClick(node)}
        onLinkClick={(link) => onLinkClick(link)}
      />}
    </div>
  );
}