import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { DeckWorkerConfig } from "./config.js";
import type { DeckRenderRequest, DeckRenderResult } from "./types.js";

export async function renderDeck(request: DeckRenderRequest, config: DeckWorkerConfig): Promise<DeckRenderResult> {
  const format = request.format ?? "pdf";
  const mimeType = format === "pdf" ? "application/pdf" : "text/html";
  const extension = format === "pdf" ? "pdf" : "html";
  const fileName = `${request.deckId}.${extension}`;
  const outputPath = join(config.storagePath, fileName);

  if (!request.deckId) {
    throw new Error("deckId is required");
  }
  if (!request.markdown.trim()) {
    throw new Error("markdown is required");
  }

  await mkdir(config.storagePath, { recursive: true });
  const inputPath = join(config.storagePath, `${request.deckId}.md`);
  await writeFile(inputPath, request.markdown, "utf8");

  if (!request.dryRun) {
    if (request.renderer === "marp") {
      await runCommand("pnpm", ["exec", "marp", inputPath, "--output", outputPath, "--allow-local-files"], config.storagePath);
    } else {
      const args = format === "pdf" ? ["exec", "slidev", "export", inputPath, "--output", outputPath] : ["exec", "slidev", "build", inputPath, "--out", outputPath];
      await runCommand("pnpm", args, config.storagePath);
    }
  }

  if (request.dryRun) {
    await writeFile(outputPath, `Dry-run ${request.renderer} ${format} export for ${request.deckId}\n`, "utf8");
  }

  return {
    deckId: request.deckId,
    renderer: request.renderer,
    format,
    fileName,
    mimeType,
    storagePath: outputPath,
    publicUrl: config.publicMediaBaseUrl ? `${config.publicMediaBaseUrl.replace(/\/+$/u, "")}/${encodeURIComponent(fileName)}` : null,
  };
}

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code}\n${stdout}\n${stderr}`));
    });
  });
}
