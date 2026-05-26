export type ComfyWorkflow = Record<string, { inputs?: Record<string, unknown> }>;

export type WorkflowNodeMapping = {
  promptNodeId: string;
  negativePromptNodeId?: string;
  widthNodeId?: string;
  heightNodeId?: string;
  seedNodeId?: string;
};

export type VisualGenerateRequest = {
  visualJobId: string;
  templateKey: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  workflow?: ComfyWorkflow;
  mapping?: WorkflowNodeMapping;
  dryRun?: boolean;
};

export type VisualGenerateResponse = {
  visualJobId: string;
  promptId: string;
  status: "submitted" | "dry_run";
};

export type VisualPollRequest = {
  visualJobId: string;
  promptId: string;
  dryRun?: boolean;
};

export type StoredVisualOutput = {
  filename: string;
  mimeType: string;
  storagePath: string;
  publicUrl: string | null;
};

export type VisualPollResponse = {
  visualJobId: string;
  promptId: string;
  status: "running" | "generated";
  outputs: StoredVisualOutput[];
};

export type ComfyPromptResponse = {
  prompt_id: string;
  number?: number;
  node_errors?: Record<string, unknown>;
  error?: unknown;
};

export type ComfyOutputRef = {
  filename: string;
  subfolder?: string;
  type?: string;
  mediaKind?: "image" | "video";
};

export type ComfyImageRef = ComfyOutputRef;
