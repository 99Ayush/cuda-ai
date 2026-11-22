// Typed English catalog. Add a matching Hindi catalog without changing components.
export const english = {
  brand: "Verity",
  check: "Check",
  history: "History",
  statistics: "Statistics",
  settings: "Settings",
  sources: "Sources",
  privacy: "Privacy",
  status: "Status",
  verifyPrompt: "What would you like to verify?",
  claimPlaceholder: "Paste a claim or article URL…",
  startHeadline: "Start with a claim. Follow the evidence.",
  startDescription: "Check a factual statement or a public article against web sources.",
  cancel: "Cancel check",
  retry: "Re-check",
  share: "Create read-only link",
  exportJson: "Export JSON",
  exportCsv: "Export CSV",
  importHistory: "Import",
  allFindings: "All findings",
  chooseClaims: "Choose article claims",
  chooseInstruction: "Select the extracted claims you want to verify.",
  commandPalette: "Commands",
  shortcuts: "Keyboard shortcuts",
  localOnly: "Saved findings stay in this browser.",
  demo: "DEMO · Controlled responses. These results are simulated.",
  uncertainty: "AI-assisted analysis. Open the sources and judge their relevance.",
} as const;
export type MessageKey = keyof typeof english;
export function t(key: MessageKey): string {
  return english[key];
}
