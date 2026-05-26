export type VideoAspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export type SceneSourceInput = {
  /** Remote URL pointing at a video clip (mp4, mov, webm). */
  videoUrl?: string;
  /** Local filesystem path to a video clip. */
  videoPath?: string;
  /** Remote URL pointing at a still image (jpg, png, webp). Will be turned into a Ken-Burns clip. */
  imageUrl?: string;
  /** Local filesystem path to a still image. */
  imagePath?: string;
};

export type SceneInput = SceneSourceInput & {
  order?: number;
  /** Free-text caption burned in as a single line for this scene. */
  caption?: string;
  /** Operator's spoken script — used for VO mixing later, not burned in. */
  narration?: string;
  /** Hint for fallback rendering when no source media is provided. */
  visualPrompt?: string;
  /** Target duration in seconds for this scene. */
  durationSeconds?: number;
};

export type CaptionInput = {
  startMs?: number;
  endMs?: number;
  text: string;
};

export type AssembleRequest = {
  videoJobId?: string;
  /** Final output aspect ratio. */
  aspectRatio?: VideoAspectRatio;
  /** Free-form title / hook used only for fallback drawtext when no media is present. */
  title?: string;
  hook?: string;
  /** Ordered list of scenes. Each must yield exactly one normalized clip. */
  scenes?: SceneInput[];
  /** Word-level or line-level captions for the full timeline, burned in via FFmpeg subtitles filter. */
  captions?: CaptionInput[];
  /** Optional voiceover or music track to mix over the assembled video. */
  audioUrl?: string;
  audioPath?: string;
  /** Brand colors used for fallback cards. */
  brand?: {
    name?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  /** Skip actual FFmpeg spawn — return synthetic metadata. Used in tests. */
  dryRun?: boolean;
};

export type NormalizedSourceKind = "video_file" | "image_kenburns" | "fallback_card";

export type NormalizedScene = {
  order: number;
  durationSeconds: number;
  caption: string;
  narration: string;
  visualPrompt: string;
  source: {
    kind: NormalizedSourceKind;
    /** Resolved local path after download/copy. Empty for fallback_card. */
    localPath: string;
  };
};

export type AssembleResult = {
  videoJobId: string;
  status: "rendered";
  fileName: string;
  mimeType: "video/mp4";
  storagePath: string;
  publicUrl: string | null;
  width: number;
  height: number;
  durationSeconds: number;
  /** Renderer that produced the final output. */
  renderer: "ffmpeg";
  /** Post-processor that finalized the file (encoding, faststart). Same engine, same step. */
  postProcessor: "ffmpeg";
  /** Per-scene clip summary for debugging / future overlay editing. */
  scenes: Array<{
    order: number;
    sourceKind: NormalizedSourceKind;
    durationSeconds: number;
  }>;
  /** Whether captions were burned in. */
  captionsBurnedIn: boolean;
};
