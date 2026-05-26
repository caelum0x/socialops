export type DeckRenderRequest = {
  deckId: string;
  renderer: "marp" | "slidev";
  markdown: string;
  format?: "pdf" | "html";
  dryRun?: boolean;
};

export type DeckRenderResult = {
  deckId: string;
  renderer: "marp" | "slidev";
  format: "pdf" | "html";
  fileName: string;
  mimeType: "application/pdf" | "text/html";
  storagePath: string;
  publicUrl: string | null;
};
