import { spawn } from "node:child_process";

export type ProbeResult = {
  durationSeconds: number;
  width: number;
  height: number;
};

export async function ffprobe(binary: string, path: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      path,
    ];
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.once("error", (error) => {
      reject(error);
    });
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with ${code}: ${Buffer.concat(stderrChunks).toString("utf8")}`));
        return;
      }
      try {
        const raw = Buffer.concat(stdoutChunks).toString("utf8");
        const parsed = JSON.parse(raw) as {
          streams?: Array<{ width?: number; height?: number }>;
          format?: { duration?: string };
        };
        const stream = parsed.streams?.[0] ?? {};
        const duration = Number(parsed.format?.duration ?? "0");
        resolve({
          durationSeconds: Number.isFinite(duration) ? duration : 0,
          width: stream.width ?? 0,
          height: stream.height ?? 0,
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

export function probeBinary(ffmpegPath: string): string {
  if (ffmpegPath === "ffmpeg" || !ffmpegPath.endsWith("ffmpeg")) {
    return "ffprobe";
  }
  return ffmpegPath.replace(/ffmpeg$/u, "ffprobe");
}
