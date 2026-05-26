export type VisualWorkerConfig = {
  port: number;
  comfyUiUrl: string;
  storagePath: string;
  publicMediaBaseUrl: string;
  openPostApiUrl: string;
  openPostApiKey: string;
  allowInlineWorkflow: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): VisualWorkerConfig {
  return {
    port: Number(env.PORT ?? 3002),
    comfyUiUrl: env.COMFYUI_URL ?? "http://localhost:8188",
    storagePath: env.VISUAL_STORAGE_PATH ?? "/tmp/socialops-generated-visuals",
    publicMediaBaseUrl: env.PUBLIC_MEDIA_BASE_URL ?? "",
    openPostApiUrl: env.OPENPOST_API_URL ?? "http://localhost:8080",
    openPostApiKey: env.OPENPOST_API_KEY ?? "",
    allowInlineWorkflow: env.VISUAL_WORKER_ALLOW_INLINE_WORKFLOW === "true",
  };
}
