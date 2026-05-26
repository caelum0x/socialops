import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { writeSrtFile, subtitleStyleForBurnIn } from "./captions.js";
import { runFfmpeg } from "./runner.js";
import type { AssembleRequest, CaptionInput, NormalizedScene, VideoAspectRatio } from "../video-types.js";

export type AssemblePipelineConfig = {
  ffmpegPath: string;
  scratchDir: string;
  outputDir: string;
};

export type SceneClipInput = NormalizedScene;

export function dimensionsForAspectRatio(aspectRatio: VideoAspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

export async function assembleFinalVideo(input: {
  jobId: string;
  scenes: SceneClipInput[];
  captions: CaptionInput[];
  audioPath: string | null;
  aspectRatio: VideoAspectRatio;
  hook: string;
  fallbackBrand: { name: string; primaryColor: string; accentColor: string };
  config: AssemblePipelineConfig;
}): Promise<{ outputPath: string; durationSeconds: number; captionsBurnedIn: boolean }> {
  const { jobId, scenes, captions, audioPath, aspectRatio, hook, fallbackBrand, config } = input;
  const { width, height } = dimensionsForAspectRatio(aspectRatio);
  const jobScratch = join(config.scratchDir, jobId);
  await mkdir(jobScratch, { recursive: true });
  await mkdir(config.outputDir, { recursive: true });

  const sceneClipPaths: string[] = [];
  for (const scene of scenes) {
    const sceneClipPath = join(jobScratch, `scene-${pad(scene.order)}.mp4`);
    await renderSceneClip({
      scene,
      hook,
      sceneClipPath,
      width,
      height,
      fallbackBrand,
      ffmpegPath: config.ffmpegPath,
    });
    sceneClipPaths.push(sceneClipPath);
  }

  const concatListPath = join(jobScratch, "concat.txt");
  await writeFile(
    concatListPath,
    sceneClipPaths.map((path) => `file '${path.replace(/'/gu, "\\'")}'`).join("\n"),
    "utf8",
  );

  const concatPath = join(jobScratch, "concat.mp4");
  await runFfmpeg(config.ffmpegPath, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-c",
    "copy",
    concatPath,
  ]);

  let videoForCaptions = concatPath;
  let captionsBurnedIn = false;
  if (captions.length > 0) {
    const srt = await writeSrtFile(captions, join(jobScratch, "captions.srt"));
    if (srt.segmentCount > 0) {
      const burnedPath = join(jobScratch, "burned.mp4");
      const subtitleFilter = `subtitles=${escapeFilterPath(srt.srtPath)}:force_style='${subtitleStyleForBurnIn()}'`;
      await runFfmpeg(config.ffmpegPath, [
        "-y",
        "-i",
        concatPath,
        "-vf",
        subtitleFilter,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        burnedPath,
      ]);
      videoForCaptions = burnedPath;
      captionsBurnedIn = true;
    }
  }

  const outputPath = resolve(config.outputDir, `${jobId}.mp4`);
  const finalArgs: string[] = ["-y", "-i", videoForCaptions];
  if (audioPath) {
    finalArgs.push("-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-shortest");
  }
  finalArgs.push(
    "-c:v",
    captionsBurnedIn ? "copy" : "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  );
  await runFfmpeg(config.ffmpegPath, finalArgs);

  const totalDurationSeconds = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  return { outputPath, durationSeconds: totalDurationSeconds, captionsBurnedIn };
}

async function renderSceneClip(args: {
  scene: SceneClipInput;
  hook: string;
  sceneClipPath: string;
  width: number;
  height: number;
  fallbackBrand: { name: string; primaryColor: string; accentColor: string };
  ffmpegPath: string;
}): Promise<void> {
  const { scene, hook, sceneClipPath, width, height, fallbackBrand, ffmpegPath } = args;
  const sceneDuration = Math.max(1, scene.durationSeconds);
  const captionText = scene.order === 1 && scene.caption.trim().length === 0 ? hook : scene.caption;

  if (scene.source.kind === "video_file") {
    const filters = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      `fps=30`,
      `setsar=1`,
      `format=yuv420p`,
    ];
    if (captionText) {
      filters.push(buildSceneCaptionDrawText(captionText, width));
    }
    await runFfmpeg(ffmpegPath, [
      "-y",
      "-ss",
      "0",
      "-t",
      sceneDuration.toString(),
      "-i",
      scene.source.localPath,
      "-vf",
      filters.join(","),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-an",
      sceneClipPath,
    ]);
    return;
  }

  if (scene.source.kind === "image_kenburns") {
    // Ken-Burns: slow zoom on the still image so it doesn't look like a static slide.
    const totalFrames = Math.max(60, Math.round(sceneDuration * 30));
    const zoom = `zoompan=z='min(zoom+0.0008,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}:fps=30`;
    const filters = [
      "scale=8000:-1",
      zoom,
      `setsar=1`,
      `format=yuv420p`,
    ];
    if (captionText) {
      filters.push(buildSceneCaptionDrawText(captionText, width));
    }
    await runFfmpeg(ffmpegPath, [
      "-y",
      "-loop",
      "1",
      "-i",
      scene.source.localPath,
      "-t",
      sceneDuration.toString(),
      "-vf",
      filters.join(","),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-an",
      sceneClipPath,
    ]);
    return;
  }

  // fallback_card: solid-color background + drawtext. Last-resort, signals "no real footage".
  const colorFilter = `color=c=${fallbackBrand.primaryColor}:s=${width}x${height}:r=30,format=yuv420p`;
  const filters: string[] = [];
  if (captionText) {
    filters.push(buildSceneCaptionDrawText(captionText, width));
  } else {
    filters.push(buildSceneCaptionDrawText(scene.visualPrompt || fallbackBrand.name, width));
  }
  const filterChain = filters.length > 0 ? filters.join(",") : "null";
  await runFfmpeg(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    colorFilter,
    "-t",
    sceneDuration.toString(),
    "-vf",
    filterChain,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-an",
    sceneClipPath,
  ]);
}

function buildSceneCaptionDrawText(text: string, width: number): string {
  const escaped = escapeDrawText(text);
  const fontSize = Math.max(36, Math.round(width * 0.05));
  return [
    `drawtext=text='${escaped}'`,
    `fontsize=${fontSize}`,
    `fontcolor=white`,
    `box=1`,
    `boxcolor=black@0.55`,
    `boxborderw=24`,
    `x=(w-text_w)/2`,
    `y=h-th-120`,
    `line_spacing=8`,
  ].join(":");
}

function escapeDrawText(text: string): string {
  return text
    .replace(/\\/gu, "\\\\")
    .replace(/'/gu, "\\'")
    .replace(/:/gu, "\\:")
    .replace(/\r?\n/gu, " ");
}

function escapeFilterPath(path: string): string {
  return path.replace(/\\/gu, "\\\\").replace(/:/gu, "\\:").replace(/'/gu, "\\'");
}

function pad(n: number): string {
  return n.toString().padStart(3, "0");
}
