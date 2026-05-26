import type { ComfyOutputRef, ComfyPromptResponse, ComfyWorkflow } from "./types.js";

export async function submitComfyWorkflow({
  comfyUiUrl,
  workflow,
  clientId,
}: {
  comfyUiUrl: string;
  workflow: ComfyWorkflow;
  clientId: string;
}): Promise<ComfyPromptResponse> {
  const response = await fetch(`${normalizeBaseUrl(comfyUiUrl)}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: workflow,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    throw new Error(`ComfyUI /prompt failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as ComfyPromptResponse;
}

export async function getComfyHistory({
  comfyUiUrl,
  promptId,
}: {
  comfyUiUrl: string;
  promptId: string;
}): Promise<Record<string, unknown>> {
  const response = await fetch(`${normalizeBaseUrl(comfyUiUrl)}/history/${encodeURIComponent(promptId)}`);
  if (!response.ok) {
    throw new Error(`ComfyUI /history failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function fetchComfyImage({
  comfyUiUrl,
  filename,
  subfolder = "",
  type = "output",
}: {
  comfyUiUrl: string;
  filename: string;
  subfolder?: string;
  type?: string;
}): Promise<Buffer> {
  const url = new URL(`${normalizeBaseUrl(comfyUiUrl)}/view`);
  url.searchParams.set("filename", filename);
  url.searchParams.set("subfolder", subfolder);
  url.searchParams.set("type", type);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ComfyUI /view failed: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function extractOutputsFromComfyHistory(history: Record<string, unknown>, promptId: string): ComfyOutputRef[] {
  const promptEntry = history[promptId];
  if (!isRecord(promptEntry)) {
    return [];
  }
  const outputs = promptEntry.outputs;
  if (!isRecord(outputs)) {
    return [];
  }

  const outputsFound: ComfyOutputRef[] = [];
  for (const output of Object.values(outputs)) {
    if (!isRecord(output)) {
      continue;
    }
    outputsFound.push(...extractOutputRefs(output.images, "image"));
    outputsFound.push(...extractOutputRefs(output.videos, "video"));
    outputsFound.push(...extractOutputRefs(output.gifs, "video"));
  }
  return outputsFound;
}

export const extractImagesFromComfyHistory = extractOutputsFromComfyHistory;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/u, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractOutputRefs(value: unknown, mediaKind: ComfyOutputRef["mediaKind"]): ComfyOutputRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.filename !== "string") {
      return [];
    }
    return [
      {
        filename: item.filename,
        subfolder: typeof item.subfolder === "string" ? item.subfolder : "",
        type: typeof item.type === "string" ? item.type : "output",
        mediaKind,
      },
    ];
  });
}
