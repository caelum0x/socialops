import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ComfyWorkflow, WorkflowNodeMapping } from "./types.js";

export const allowedWorkflowTemplateKeys = [
  "linkedin-career-card",
  "linkedin-carousel-cover",
  "x-founder-post-image",
  "x-thread-cover",
  "tiktok-thumbnail",
  "instagram-carousel-slide",
  "project-update-card",
  "market-map-card",
  "product-demo-thumbnail",
  "linkedin-carousel-background",
  "x-post-visual",
  "caption-card-text-visual",
  "video-thumbnail",
  "wan-i2v-broll",
  "ltxv-fast-motion-broll",
] as const;

const workerDir = dirname(fileURLToPath(import.meta.url));
const workflowDir = join(workerDir, "..", "workflows");

export function isAllowedWorkflowTemplateKey(key: string): boolean {
  return allowedWorkflowTemplateKeys.includes(key as never);
}

export async function loadWorkflowTemplate(templateKey: string, inlineWorkflow?: ComfyWorkflow): Promise<ComfyWorkflow> {
  if (inlineWorkflow) {
    return structuredClone(inlineWorkflow);
  }

  const raw = await readFile(join(workflowDir, `${templateKey}.json`), "utf8");
  const workflow = JSON.parse(raw) as ComfyWorkflow;
  return {
    ...workflow,
    __template_key: templateKey,
  } as unknown as ComfyWorkflow;
}

export function fillWorkflowTemplate({
  workflow,
  prompt,
  negativePrompt,
  width,
  height,
  seed,
  mapping,
}: {
  workflow: ComfyWorkflow;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  mapping?: WorkflowNodeMapping;
}): ComfyWorkflow {
  const next = structuredClone(workflow);
  const effectiveMapping = mapping ?? defaultWorkflowMappings[next.__template_key as string];
  delete next.__template_key;
  if (!effectiveMapping) {
    return next;
  }

  setNodeInput(next, effectiveMapping.promptNodeId, "text", prompt);
  if (negativePrompt && effectiveMapping.negativePromptNodeId) {
    setNodeInput(next, effectiveMapping.negativePromptNodeId, "text", negativePrompt);
  }
  if (width && effectiveMapping.widthNodeId) {
    setNodeInput(next, effectiveMapping.widthNodeId, "width", width);
  }
  if (height && effectiveMapping.heightNodeId) {
    setNodeInput(next, effectiveMapping.heightNodeId, "height", height);
  }
  if (seed && effectiveMapping.seedNodeId) {
    setNodeInput(next, effectiveMapping.seedNodeId, "seed", seed);
  }
  return next;
}

const defaultWorkflowMappings: Record<string, WorkflowNodeMapping> = {
  "wan-i2v-broll": {
    promptNodeId: "4",
    negativePromptNodeId: "5",
    widthNodeId: "6",
    heightNodeId: "6",
    seedNodeId: "7",
  },
  "ltxv-fast-motion-broll": {
    promptNodeId: "4",
    negativePromptNodeId: "5",
    widthNodeId: "6",
    heightNodeId: "6",
    seedNodeId: "8",
  },
};

function setNodeInput(workflow: ComfyWorkflow, nodeId: string, inputKey: string, value: unknown): void {
  const node = workflow[nodeId];
  if (!node) {
    throw new Error(`workflow node ${nodeId} is missing`);
  }
  node.inputs = {
    ...(node.inputs ?? {}),
    [inputKey]: value,
  };
}
