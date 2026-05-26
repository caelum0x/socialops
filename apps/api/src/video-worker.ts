export type VideoWorkerSceneSource = {
  videoUrl?: string;
  videoPath?: string;
  imageUrl?: string;
  imagePath?: string;
};

export type VideoWorkerSceneInput = VideoWorkerSceneSource & {
  order?: number;
  caption?: string;
  narration?: string;
  visualPrompt?: string;
  durationSeconds?: number;
};

export type VideoWorkerCaptionInput = {
  startMs?: number;
  endMs?: number;
  text: string;
};

export type VideoWorkerAssembleInput = {
  videoJobId: string;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  title?: string;
  hook?: string;
  scenes: VideoWorkerSceneInput[];
  captions?: VideoWorkerCaptionInput[];
  audioUrl?: string;
  audioPath?: string;
  brand?: {
    name?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  dryRun?: boolean;
};

export type VideoWorkerSceneResult = {
  order: number;
  sourceKind: "video_file" | "image_kenburns" | "fallback_card";
  durationSeconds: number;
};

export type VideoWorkerAssembleResult = {
  videoJobId: string;
  status: "rendered";
  fileName: string;
  mimeType: "video/mp4";
  storagePath: string;
  publicUrl: string | null;
  width: number;
  height: number;
  durationSeconds: number;
  renderer: "ffmpeg";
  postProcessor: "ffmpeg";
  scenes: VideoWorkerSceneResult[];
  captionsBurnedIn: boolean;
};

export type VideoWorkerViewportPreset = "landscape_1920" | "linkedin_1080" | "vertical_1080" | "square_1080";

export type VideoWorkerCaptureSceneAction =
  | { type: "wait_ms"; ms: number }
  | { type: "wait_for"; selector: string; timeoutMs?: number }
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string; delayMs?: number }
  | { type: "scroll"; y: number };

export type VideoWorkerCaptureScene = {
  order: number;
  url: string;
  viewport: VideoWorkerViewportPreset;
  mode: "screenshot" | "screen_recording";
  actions?: VideoWorkerCaptureSceneAction[];
  durationMs?: number;
  settleMs?: number;
};

export type VideoWorkerCaptureInput = {
  jobId: string;
  scenes: VideoWorkerCaptureScene[];
};

export type VideoWorkerCaptureSceneResult = {
  order: number;
  url: string;
  mode: "screenshot" | "screen_recording";
  filePath: string;
  width: number;
  height: number;
};

export type VideoWorkerCaptureResult = {
  jobId: string;
  captures: VideoWorkerCaptureSceneResult[];
};

export type VideoWorkerClient = {
  assemble: (input: VideoWorkerAssembleInput) => Promise<VideoWorkerAssembleResult>;
  capture: (input: VideoWorkerCaptureInput) => Promise<VideoWorkerCaptureResult>;
};

export function createVideoWorkerClient(baseUrl: string): VideoWorkerClient {
  const normalizedBaseUrl = baseUrl.replace(/\/$/u, "");
  return {
    async assemble(input) {
      const response = await fetch(`${normalizedBaseUrl}/assemble`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`video-worker /assemble failed: ${response.status} ${await response.text()}`);
      }
      return response.json() as Promise<VideoWorkerAssembleResult>;
    },
    async capture(input) {
      const response = await fetch(`${normalizedBaseUrl}/capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error(`video-worker /capture failed: ${response.status} ${await response.text()}`);
      }
      return response.json() as Promise<VideoWorkerCaptureResult>;
    },
  };
}
