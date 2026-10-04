export type AtlasUserType = "family" | "professional" | "organization";
export type AtlasExperience = "guided" | "professional";
export type AtlasLanguage = "es" | "en";

export type AtlasProfile = {
  id: string;
  displayName: string;
  userType: AtlasUserType | null;
  language: AtlasLanguage | null;
  experience: AtlasExperience;
  voiceEnabled: boolean;
  onboardingCompleted: boolean;
};

export type GraphEvidence = { source: string; url: string; quote: string };
export type GraphNode = {
  id: string;
  type: string;
  label: string;
  synonyms?: string[];
  summary_plain?: string;
  x?: number;
  y?: number;
  z?: number;
};
export type GraphLink = {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  status: "observed" | "extracted" | "inferred";
  confidence: number;
  evidence?: GraphEvidence[];
  contradicts?: string[];
};
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };
export type AtlasHighlight = { nodes: Set<string>; links: Set<string>; focus?: string };
export type AtlasStep = { say: string; nodes: string[]; links: string[]; focus: string };
export type AtlasScript = {
  status: "supported" | "partial" | "no_route";
  steps: AtlasStep[];
  nextStep: string;
  gaps: string[];
};
export type GraphHighlight = { nodes: Set<string>; links: Set<string>; focus?: string };

export const graphId = (value: string | GraphNode) => typeof value === "string" ? value : value.id;