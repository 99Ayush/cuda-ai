import type { Dispatch, SetStateAction, RefObject, FormEvent } from "react";
import { CheckCircle2, XCircle, GitCompareArrows, CircleHelp, type LucideIcon } from "lucide-react";
import type { Result, Health, ProgressEvent, Verdict } from "@verity/shared";

export type View = "check" | "history" | "stats" | "settings";

export type DashboardProps = {
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  claim: string;
  setClaim: Dispatch<SetStateAction<string>>;
  history: Result[];
  result: Result | null;
  health: Health;
  loading: boolean;
  elapsed: number;
  error: string;
  notice: string;
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  verdictFilter: Verdict | "ALL";
  setVerdictFilter: Dispatch<SetStateAction<Verdict | "ALL">>;
  filtered: Result[];
  controller: RefObject<AbortController | null>;
  resultRef: RefObject<HTMLDivElement | null>;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  openResult: (row: Result) => void;
  persist: (rows: Result[], message?: string) => void;
  setResult: Dispatch<SetStateAction<Result | null>>;
  progress: ProgressEvent | null;
  articleClaims: string[];
  selectedClaims: string[];
  setSelectedClaims: Dispatch<SetStateAction<string[]>>;
  preparedArticle: boolean;
  onImport: (file: File) => Promise<void>;
  onRecheck: () => void;
  onShare: () => Promise<void>;
  shared: boolean;
};

export const labels: Record<Verdict, { label: string; icon: LucideIcon; detail: string }> = {
  TRUE: {
    label: "Supported",
    icon: CheckCircle2,
    detail: "The retrieved evidence supports this claim.",
  },
  FALSE: {
    label: "Refuted",
    icon: XCircle,
    detail: "The retrieved evidence contradicts this claim.",
  },
  MIXED: {
    label: "Mixed findings",
    icon: GitCompareArrows,
    detail: "The evidence is conflicting or not every component was established.",
  },
  UNVERIFIED: {
    label: "Unverified",
    icon: CircleHelp,
    detail: "The available evidence does not establish this claim.",
  },
};

export function evidenceProviders(health: Health) {
  const configured = health.configured;
  return [
    {
      name: "Tavily",
      enabled: configured?.tavily ?? configured?.evidence ?? false,
      detail: "Web evidence",
      missing: "Key needed",
    },
    {
      name: "PubMed",
      enabled: configured?.pubmed ?? false,
      detail: "Health and medical claims",
      missing: "Disabled",
    },
    {
      name: "Wikidata",
      enabled: configured?.wikidata ?? false,
      detail: "Named entities and structured facts",
      missing: "Disabled",
    },
  ];
}
