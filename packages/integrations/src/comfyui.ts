export type ComfyUiWorkflow = Record<string, unknown>;

export type ComfyUiPromptRequest = {
  workflow: ComfyUiWorkflow;
  clientId?: string;
  promptId?: string;
  extraData?: Record<string, unknown>;
};

export type ComfyUiPromptResponse = {
  prompt_id: string;
  number?: number;
  node_errors?: Record<string, unknown>;
  error?: unknown;
};

export type ComfyUiHistoryResponse = Record<string, unknown>;

export type ComfyUiClient = {
  queuePrompt: (request: ComfyUiPromptRequest) => Promise<ComfyUiPromptResponse>;
  getHistory: (promptId: string) => Promise<ComfyUiHistoryResponse>;
};

type FetchLike = typeof fetch;

export function createComfyUiClient(baseUrl: string, fetchImpl: FetchLike = fetch): ComfyUiClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ComfyUI request failed: ${response.status} ${body}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    queuePrompt(request) {
      return requestJson<ComfyUiPromptResponse>("/api/prompt", {
        method: "POST",
        body: JSON.stringify({
          prompt: request.workflow,
          client_id: request.clientId,
          prompt_id: request.promptId,
          extra_data: request.extraData,
        }),
      });
    },
    getHistory(promptId) {
      return requestJson<ComfyUiHistoryResponse>(`/api/history/${encodeURIComponent(promptId)}`);
    },
  };
}
