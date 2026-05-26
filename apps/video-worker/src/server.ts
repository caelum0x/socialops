import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { assembleVideo } from "./assembler.js";
import { loadConfig } from "./config.js";
import { createPlaywrightEngine, type CaptureEngine, type CaptureRequest } from "./playwright/capture.js";
import type { AssembleRequest } from "./video-types.js";

const config = loadConfig();
const captureEngine: CaptureEngine = createPlaywrightEngine();

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "socialops-video-worker",
        engine: "ffmpeg",
        ffmpegPath: config.ffmpegPath,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/assemble") {
      const body = await readJson<AssembleRequest>(request);
      if (!body.videoJobId) {
        sendJson(response, 400, { error: "videoJobId is required" });
        return;
      }
      const assembled = await assembleVideo(body, config);
      sendJson(response, 200, assembled);
      return;
    }

    if (request.method === "POST" && request.url === "/capture") {
      const body = await readJson<CaptureRequest>(request);
      if (!body.jobId) {
        sendJson(response, 400, { error: "jobId is required" });
        return;
      }
      if (!Array.isArray(body.scenes) || body.scenes.length === 0) {
        sendJson(response, 400, { error: "scenes is required and must be non-empty" });
        return;
      }
      const result = await captureEngine.capture(body, config.scratchPath);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "internal error",
    });
  }
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`socialops-video-worker listening on :${config.port} (engine=ffmpeg+playwright)`);
});

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}
