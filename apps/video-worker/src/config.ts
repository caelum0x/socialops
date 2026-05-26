export type VideoWorkerConfig = {
  port: number;
  visualWorkerUrl: string;
  storagePath: string;
  scratchPath: string;
  publicMediaBaseUrl: string;
  openPostApiUrl: string;
  openPostApiKey: string;
  ffmpegPath: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): VideoWorkerConfig {
  return {
    port: Number(env.PORT ?? 3003),
    visualWorkerUrl: env.VISUAL_WORKER_URL ?? "http://localhost:3002",
    storagePath: env.VIDEO_STORAGE_PATH ?? "/tmp/socialops-rendered-video",
    scratchPath: env.VIDEO_SCRATCH_PATH ?? "/tmp/socialops-video-scratch",
    publicMediaBaseUrl: env.PUBLIC_MEDIA_BASE_URL ?? "",
    openPostApiUrl: env.OPENPOST_API_URL ?? "http://localhost:8080",
    openPostApiKey: env.OPENPOST_API_KEY ?? "",
    ffmpegPath: env.FFMPEG_PATH ?? "ffmpeg",
  };
}
