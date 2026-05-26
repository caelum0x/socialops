import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { loadConfig } from "./config.js";
import { renderDeck } from "./render.js";
import type { DeckRenderRequest } from "./types.js";

const config = loadConfig();

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "socialops-deck-worker",
        renderers: ["marp", "slidev"],
      });
      return;
    }

    if (request.method === "POST" && request.url === "/render") {
      const body = await readJson<DeckRenderRequest>(request);
      const result = await renderDeck(body, config);
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
  console.log(`socialops-deck-worker listening on :${config.port}`);
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
