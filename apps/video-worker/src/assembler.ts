import { join, resolve } from "node:path";

import type { VideoWorkerConfig } from "./config.js";
import { assembleFinalVideo, dimensionsForAspectRatio } from "./ffmpeg/assemble.js";
import { resolveAudio, resolveSceneSource } from "./source-resolver.js";
import type { AssembleRequest, AssembleResult, NormalizedScene, NormalizedSourceKind, SceneInput, VideoAspectRatio } from "./video-types.js";

const FALLBACK_BRAND = {
  name: "SocialOps",
  primaryColor: "#0f172a",
  accentColor: "#67e8f9",
};

export async function assembleVideo(input: AssembleRequest, config: VideoWorkerConfig): Promise<AssembleResult> {
  if (!input.videoJobId) {
    throw new Error("videoJobId is required");
  }
  const jobId = input.videoJobId;
  const aspectRatio: VideoAspectRatio = input.aspectRatio ?? "9:16";
  const scenes = (input.scenes && input.scenes.length > 0 ? input.scenes : fallbackScenes()).map(normalizeSceneInput);
  const hook = input.hook?.trim() || scenes[0]?.caption || FALLBACK_BRAND.name;
  const brand = {
    name: input.brand?.name?.trim() || FALLBACK_BRAND.name,
    primaryColor: input.brand?.primaryColor?.trim() || FALLBACK_BRAND.primaryColor,
    accentColor: input.brand?.accentColor?.trim() || FALLBACK_BRAND.accentColor,
  };

  const fileName = `${jobId}.mp4`;
  const dimensions = dimensionsForAspectRatio(aspectRatio);
  const totalDurationSeconds = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);

  if (input.dryRun) {
    const dryScenes: NormalizedScene[] = scenes.map((scene, index) => ({
      ...scene,
      source: {
        kind: pickDryRunKind(scene),
        localPath: "",
      },
      order: scene.order || index + 1,
    }));
    return {
      videoJobId: jobId,
      status: "rendered",
      fileName,
      mimeType: "video/mp4",
      storagePath: resolve(config.storagePath, fileName),
      publicUrl: publicUrl(config.publicMediaBaseUrl, fileName),
      width: dimensions.width,
      height: dimensions.height,
      durationSeconds: totalDurationSeconds,
      renderer: "ffmpeg",
      postProcessor: "ffmpeg",
      scenes: dryScenes.map((scene) => ({
        order: scene.order,
        sourceKind: scene.source.kind,
        durationSeconds: scene.durationSeconds,
      })),
      captionsBurnedIn: Array.isArray(input.captions) && input.captions.length > 0,
    };
  }

  const scratchDir = join(config.scratchPath, jobId);
  const normalizedScenes: NormalizedScene[] = [];
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const source = await resolveSceneSource(scene, scratchDir);
    normalizedScenes.push({
      order: scene.order || index + 1,
      durationSeconds: scene.durationSeconds,
      caption: scene.caption,
      narration: scene.narration,
      visualPrompt: scene.visualPrompt,
      source,
    });
  }

  const audioPath = await resolveAudio({ audioUrl: input.audioUrl, audioPath: input.audioPath }, scratchDir);

  const { outputPath, durationSeconds, captionsBurnedIn } = await assembleFinalVideo({
    jobId,
    scenes: normalizedScenes,
    captions: input.captions ?? [],
    audioPath,
    aspectRatio,
    hook,
    fallbackBrand: brand,
    config: {
      ffmpegPath: config.ffmpegPath,
      scratchDir,
      outputDir: config.storagePath,
    },
  });

  return {
    videoJobId: jobId,
    status: "rendered",
    fileName,
    mimeType: "video/mp4",
    storagePath: outputPath,
    publicUrl: publicUrl(config.publicMediaBaseUrl, fileName),
    width: dimensions.width,
    height: dimensions.height,
    durationSeconds,
    renderer: "ffmpeg",
    postProcessor: "ffmpeg",
    scenes: normalizedScenes.map((scene) => ({
      order: scene.order,
      sourceKind: scene.source.kind,
      durationSeconds: scene.durationSeconds,
    })),
    captionsBurnedIn,
  };
}

type NormalizedSceneInput = {
  order: number;
  durationSeconds: number;
  caption: string;
  narration: string;
  visualPrompt: string;
  videoUrl?: string;
  videoPath?: string;
  imageUrl?: string;
  imagePath?: string;
};

function normalizeSceneInput(scene: SceneInput, index: number): NormalizedSceneInput {
  return {
    order: scene.order ?? index + 1,
    durationSeconds: clampDuration(scene.durationSeconds ?? 5),
    caption: (scene.caption ?? "").trim(),
    narration: (scene.narration ?? "").trim(),
    visualPrompt: (scene.visualPrompt ?? "").trim(),
    videoUrl: scene.videoUrl,
    videoPath: scene.videoPath,
    imageUrl: scene.imageUrl,
    imagePath: scene.imagePath,
  };
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 4;
  }
  return Math.max(1, Math.min(value, 30));
}

function pickDryRunKind(scene: NormalizedSceneInput): NormalizedSourceKind {
  if (scene.videoUrl || scene.videoPath) {
    return "video_file";
  }
  if (scene.imageUrl || scene.imagePath) {
    return "image_kenburns";
  }
  return "fallback_card";
}

function publicUrl(baseUrl: string, fileName: string): string | null {
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl.replace(/\/$/u, "")}/${fileName}`;
}

function fallbackScenes(): SceneInput[] {
  return [
    {
      order: 1,
      caption: "Turn your work into content.",
      narration: "Hook scene. Replace with real footage.",
      visualPrompt: "Hook card",
      durationSeconds: 4,
    },
    {
      order: 2,
      caption: "Capture what changed.",
      narration: "Replace with a real screen recording or uploaded clip.",
      visualPrompt: "Context card",
      durationSeconds: 5,
    },
    {
      order: 3,
      caption: "Package it as proof.",
      narration: "Replace with a result or CTA scene.",
      visualPrompt: "CTA card",
      durationSeconds: 5,
    },
  ];
}
