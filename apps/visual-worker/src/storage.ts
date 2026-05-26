import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import type { StoredVisualOutput } from "./types.js";

export async function saveGeneratedVisual({
  buffer,
  filename,
  storagePath,
  publicMediaBaseUrl,
}: {
  buffer: Buffer;
  filename: string;
  storagePath: string;
  publicMediaBaseUrl: string;
}): Promise<StoredVisualOutput> {
  await mkdir(storagePath, { recursive: true });
  const safeFileName = basename(filename);
  const outputPath = join(storagePath, safeFileName);
  await writeFile(outputPath, buffer);
  return {
    filename: safeFileName,
    mimeType: inferMimeType(safeFileName),
    storagePath: outputPath,
    publicUrl: publicMediaBaseUrl ? `${publicMediaBaseUrl.replace(/\/+$/u, "")}/${encodeURIComponent(safeFileName)}` : null,
  };
}

function inferMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".mp4")) {
    return "video/mp4";
  }
  return "image/png";
}
