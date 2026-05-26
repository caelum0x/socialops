import { writeFile } from "node:fs/promises";

import type { CaptionInput } from "../video-types.js";

export type GeneratedSrt = {
  srtPath: string;
  segmentCount: number;
};

export async function writeSrtFile(captions: readonly CaptionInput[], destPath: string): Promise<GeneratedSrt> {
  const segments = normalizeCaptions(captions);
  const body = segments
    .map(
      (segment, index) =>
        `${index + 1}\n${formatTimestamp(segment.startMs)} --> ${formatTimestamp(segment.endMs)}\n${escapeSrtLine(segment.text)}\n`,
    )
    .join("\n");
  await writeFile(destPath, body, "utf8");
  return { srtPath: destPath, segmentCount: segments.length };
}

function normalizeCaptions(captions: readonly CaptionInput[]): Array<Required<CaptionInput>> {
  const filtered = captions.filter((caption) => caption && caption.text && caption.text.trim().length > 0);
  let cursorMs = 0;
  return filtered.map((caption) => {
    const startMs = caption.startMs ?? cursorMs;
    const endMs = caption.endMs ?? startMs + estimateDurationMs(caption.text);
    cursorMs = endMs;
    return {
      startMs: Math.max(0, Math.round(startMs)),
      endMs: Math.max(startMs + 200, Math.round(endMs)),
      text: caption.text.trim(),
    };
  });
}

function estimateDurationMs(text: string): number {
  const words = text.trim().split(/\s+/u).length;
  return Math.max(900, Math.min(words * 360, 6000));
}

function formatTimestamp(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(millis)}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function pad3(value: number): string {
  return value.toString().padStart(3, "0");
}

function escapeSrtLine(text: string): string {
  return text.replace(/\r?\n/gu, " ");
}

export function subtitleStyleForBurnIn(): string {
  return [
    "Fontname=Inter",
    "Fontsize=22",
    "PrimaryColour=&H00FFFFFF",
    "OutlineColour=&H00111827",
    "BackColour=&H80111827",
    "BorderStyle=3",
    "Outline=2",
    "Shadow=0",
    "Alignment=2",
    "MarginV=120",
  ].join(",");
}
