import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import type { NormalizedSourceKind, SceneInput, SceneSourceInput } from "./video-types.js";

export type ResolvedSource = {
  kind: NormalizedSourceKind;
  localPath: string;
};

export async function resolveSceneSource(
  scene: SceneInput,
  scratchDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedSource> {
  await mkdir(scratchDir, { recursive: true });

  if (scene.videoPath) {
    await ensureExists(scene.videoPath);
    return { kind: "video_file", localPath: scene.videoPath };
  }
  if (scene.videoUrl) {
    const dest = join(scratchDir, `scene-${scene.order ?? 0}-${hash(scene.videoUrl)}${ext(scene.videoUrl, ".mp4")}`);
    await downloadIfMissing(scene.videoUrl, dest, fetchImpl);
    return { kind: "video_file", localPath: dest };
  }
  if (scene.imagePath) {
    await ensureExists(scene.imagePath);
    return { kind: "image_kenburns", localPath: scene.imagePath };
  }
  if (scene.imageUrl) {
    const dest = join(scratchDir, `scene-${scene.order ?? 0}-${hash(scene.imageUrl)}${ext(scene.imageUrl, ".jpg")}`);
    await downloadIfMissing(scene.imageUrl, dest, fetchImpl);
    return { kind: "image_kenburns", localPath: dest };
  }
  return { kind: "fallback_card", localPath: "" };
}

export async function resolveAudio(
  source: Pick<SceneSourceInput, never> & { audioUrl?: string; audioPath?: string },
  scratchDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (source.audioPath) {
    await ensureExists(source.audioPath);
    return source.audioPath;
  }
  if (source.audioUrl) {
    await mkdir(scratchDir, { recursive: true });
    const dest = join(scratchDir, `audio-${hash(source.audioUrl)}${ext(source.audioUrl, ".m4a")}`);
    await downloadIfMissing(source.audioUrl, dest, fetchImpl);
    return dest;
  }
  return null;
}

async function downloadIfMissing(url: string, destPath: string, fetchImpl: typeof fetch): Promise<void> {
  try {
    const existing = await stat(destPath);
    if (existing.isFile() && existing.size > 0) {
      return;
    }
  } catch {
    // not cached yet
  }
  await mkdir(dirname(destPath), { recursive: true });
  const response = await fetchImpl(url);
  if (!response.ok || !response.body) {
    throw new Error(`download failed for ${url}: ${response.status}`);
  }
  // node 20+ fetch returns a web ReadableStream
  const nodeReadable = Readable.fromWeb(response.body as never);
  await pipeline(nodeReadable, createWriteStream(destPath));
}

async function ensureExists(path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isFile()) {
    throw new Error(`scene source is not a file: ${path}`);
  }
}

function hash(input: string): string {
  // tiny non-crypto hash for cache keys
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function ext(input: string, fallback: string): string {
  try {
    const parsed = new URL(input);
    const candidate = extname(parsed.pathname);
    if (candidate.length > 1 && candidate.length <= 5) {
      return candidate;
    }
  } catch {
    const candidate = extname(input);
    if (candidate.length > 1 && candidate.length <= 5) {
      return candidate;
    }
  }
  return fallback;
}
