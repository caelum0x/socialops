export type ApiConfig = {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  openPostUrl: string;
  openPostInternalToken: string;
  miniClawUrl: string;
  miniClawEnabled: boolean;
  whisperUrl: string;
  whisperEnabled: boolean;
  comfyUiUrl: string;
  visualWorkerUrl: string;
  videoWorkerUrl: string;
  deckWorkerUrl: string;
  pokeeResearchUrl: string;
  mediaRuntimeProfile: "macbook_local" | "gpu_local" | "cloud_gpu";
  allowHeavyMediaWorkflows: boolean;
  clerkSecretKey?: string;
  clerkIssuer?: string;
  runwayApiKey?: string;
  lumaApiKey?: string;
  pikaApiKey?: string;
  higgsfieldApiKey?: string;
  klingAiAccessKey?: string;
  klingAiSecretKey?: string;
  hailuoApiKey?: string;
  replicateApiKey?: string;
  replicateModelDefault?: string;
  huggingfaceToken?: string;
  huggingfaceSpace?: string;
  falApiKey?: string;
  storageKind: "r2" | "s3" | "disabled";
  storageBucket: string;
  storageEndpoint: string;
  storageRegion: string;
  storageAccessKeyId: string;
  storageSecretAccessKey: string;
  storagePublicBaseUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number(env.PORT ?? 3001),
    nodeEnv: env.NODE_ENV ?? "development",
    databaseUrl: env.DATABASE_URL ?? "postgres://socialops:change-me@localhost:5432/socialops",
    openPostUrl: env.OPENPOST_URL ?? "http://localhost:8080",
    openPostInternalToken: env.SOCIALOPS_OPENPOST_INTERNAL_TOKEN ?? "",
    miniClawUrl: env.MINICLAW_URL ?? "http://localhost:18789",
    miniClawEnabled: env.USE_MINICLAW_GENERATION === "true",
    whisperUrl: env.WHISPER_URL ?? "http://localhost:18890",
    whisperEnabled: env.USE_WHISPER === "true",
    comfyUiUrl: env.COMFYUI_URL ?? "http://localhost:8188",
    visualWorkerUrl: env.VISUAL_WORKER_URL ?? "http://localhost:3002",
    videoWorkerUrl: env.VIDEO_WORKER_URL ?? "http://localhost:3003",
    deckWorkerUrl: env.DECK_WORKER_URL ?? "http://localhost:3004",
    pokeeResearchUrl: env.POKEE_RESEARCH_URL ?? "http://localhost:8888",
    mediaRuntimeProfile: parseMediaRuntimeProfile(env.SOCIALOPS_MEDIA_RUNTIME_PROFILE),
    allowHeavyMediaWorkflows: env.SOCIALOPS_ALLOW_HEAVY_MEDIA_WORKFLOWS === "true",
    clerkSecretKey: env.CLERK_SECRET_KEY,
    clerkIssuer: env.CLERK_ISSUER,
    runwayApiKey: env.RUNWAY_API_KEY,
    lumaApiKey: env.LUMA_API_KEY,
    pikaApiKey: env.PIKA_API_KEY,
    higgsfieldApiKey: env.HIGGSFIELD_API_KEY,
    klingAiAccessKey: env.KLING_AI_ACCESS_KEY,
    klingAiSecretKey: env.KLING_AI_SECRET_KEY,
    hailuoApiKey: env.HAILUO_API_KEY,
    replicateApiKey: env.REPLICATE_API_TOKEN,
    replicateModelDefault: env.REPLICATE_MODEL_DEFAULT,
    huggingfaceToken: env.HUGGINGFACE_TOKEN,
    huggingfaceSpace: env.HUGGINGFACE_SPACE,
    falApiKey: env.FAL_API_KEY,
    storageKind: parseStorageKind(env.STORAGE_KIND),
    storageBucket: env.STORAGE_BUCKET ?? "",
    storageEndpoint: env.STORAGE_ENDPOINT ?? "",
    storageRegion: env.STORAGE_REGION ?? (env.STORAGE_KIND === "r2" ? "auto" : "us-east-1"),
    storageAccessKeyId: env.STORAGE_ACCESS_KEY_ID ?? "",
    storageSecretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? "",
    storagePublicBaseUrl: env.STORAGE_PUBLIC_BASE_URL ?? "",
  };
}

function parseStorageKind(value: string | undefined): "r2" | "s3" | "disabled" {
  if (value === "r2" || value === "s3") {
    return value;
  }
  return "disabled";
}

function parseMediaRuntimeProfile(value: string | undefined): ApiConfig["mediaRuntimeProfile"] {
  if (value === "gpu_local" || value === "cloud_gpu") {
    return value;
  }
  return "macbook_local";
}
