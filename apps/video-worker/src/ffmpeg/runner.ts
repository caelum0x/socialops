import { spawn } from "node:child_process";

export type FfmpegRunResult = {
  exitCode: number;
  stderr: string;
};

export async function runFfmpeg(binary: string, args: readonly string[]): Promise<FfmpegRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderrChunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.once("error", (error) => {
      reject(error);
    });
    child.once("close", (code) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(new Error(`ffmpeg exited with ${exitCode}\n${tail(stderr, 2000)}`));
        return;
      }
      resolve({ exitCode, stderr });
    });
  });
}

function tail(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `...${text.slice(text.length - max)}`;
}
