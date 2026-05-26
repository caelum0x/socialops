export type DeckWorkerRenderInput = {
  deckId: string;
  renderer: "marp" | "slidev";
  markdown: string;
  format?: "pdf" | "html";
  dryRun?: boolean;
};

export type DeckWorkerRenderResult = {
  deckId: string;
  renderer: "marp" | "slidev";
  format: "pdf" | "html";
  fileName: string;
  mimeType: "application/pdf" | "text/html";
  storagePath: string;
  publicUrl: string | null;
};

export type DeckWorkerClient = {
  render: (input: DeckWorkerRenderInput) => Promise<DeckWorkerRenderResult>;
};

export function createDeckWorkerClient(baseUrl: string): DeckWorkerClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  return {
    async render(input) {
      const response = await fetch(`${normalizedBaseUrl}/render`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`deck-worker /render failed: ${response.status} ${await response.text()}`);
      }
      return response.json() as Promise<DeckWorkerRenderResult>;
    },
  };
}
