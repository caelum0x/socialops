export type VisualWorkerGenerateInput = {
  visualJobId: string;
  templateKey: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  workflow?: Record<string, unknown>;
  dryRun?: boolean;
};

export type VisualWorkerGenerateResult = {
  visualJobId: string;
  promptId: string;
  status: "submitted" | "dry_run";
};

export type VisualWorkerPollInput = {
  visualJobId: string;
  promptId: string;
  dryRun?: boolean;
};

export type VisualWorkerPollResult = {
  visualJobId: string;
  promptId: string;
  status: "running" | "generated";
  outputs: Array<{
    filename: string;
    mimeType: string;
    storagePath: string;
    publicUrl: string | null;
  }>;
};

export type VisualWorkerClient = {
  generate: (input: VisualWorkerGenerateInput) => Promise<VisualWorkerGenerateResult>;
  poll: (input: VisualWorkerPollInput) => Promise<VisualWorkerPollResult>;
};

export function createVisualWorkerClient(baseUrl: string): VisualWorkerClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");
  return {
    async generate(input) {
      const response = await fetch(`${normalizedBaseUrl}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`visual-worker /generate failed: ${response.status} ${await response.text()}`);
      }
      return response.json() as Promise<VisualWorkerGenerateResult>;
    },
    async poll(input) {
      const response = await fetch(`${normalizedBaseUrl}/poll`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`visual-worker /poll failed: ${response.status} ${await response.text()}`);
      }
      return response.json() as Promise<VisualWorkerPollResult>;
    },
  };
}
