import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { extractOutputsFromComfyHistory, fetchComfyImage, getComfyHistory, submitComfyWorkflow } from "./comfy.js";
import { loadConfig } from "./config.js";
import { saveGeneratedVisual } from "./storage.js";
import type { VisualGenerateRequest, VisualPollRequest } from "./types.js";
import { allowedWorkflowTemplateKeys, fillWorkflowTemplate, isAllowedWorkflowTemplateKey, loadWorkflowTemplate } from "./workflows.js";

const config = loadConfig();

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "socialops-visual-worker",
        comfyUiUrl: config.comfyUiUrl,
      });
      return;
    }

    if (request.method === "GET" && request.url === "/templates") {
      sendJson(response, 200, { templates: allowedWorkflowTemplateKeys });
      return;
    }

    if (request.method === "POST" && request.url === "/generate") {
      const body = await readJson<VisualGenerateRequest>(request);
      const validationError = validateGenerateRequest(body);
      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }
      if (body.workflow && !config.allowInlineWorkflow) {
        sendJson(response, 400, { error: "inline workflows are disabled; use allowlisted worker templates" });
        return;
      }

      if (body.dryRun) {
        sendJson(response, 200, {
          visualJobId: body.visualJobId,
          promptId: `dry-run-${body.visualJobId}`,
          status: "dry_run",
        });
        return;
      }

      const workflowTemplate = await loadWorkflowTemplate(body.templateKey, body.workflow);
      const workflow = fillWorkflowTemplate({
        workflow: workflowTemplate,
        prompt: body.prompt,
        negativePrompt: body.negativePrompt,
        width: body.width,
        height: body.height,
        seed: body.seed,
        mapping: body.mapping,
      });
      const queued = await submitComfyWorkflow({
        comfyUiUrl: config.comfyUiUrl,
        workflow,
        clientId: `socialops-${body.visualJobId}`,
      });
      sendJson(response, 200, {
        visualJobId: body.visualJobId,
        promptId: queued.prompt_id,
        status: "submitted",
      });
      return;
    }

    if (request.method === "POST" && request.url === "/poll") {
      const body = await readJson<VisualPollRequest>(request);
      if (!body.visualJobId || !body.promptId) {
        sendJson(response, 400, { error: "visualJobId and promptId are required" });
        return;
      }
      if (body.dryRun) {
        sendJson(response, 200, {
          visualJobId: body.visualJobId,
          promptId: body.promptId,
          status: "running",
          outputs: [],
        });
        return;
      }

      const history = await getComfyHistory({ comfyUiUrl: config.comfyUiUrl, promptId: body.promptId });
      const outputRefs = extractOutputsFromComfyHistory(history, body.promptId);
      if (outputRefs.length === 0) {
        sendJson(response, 200, {
          visualJobId: body.visualJobId,
          promptId: body.promptId,
          status: "running",
          outputs: [],
        });
        return;
      }

      const outputs = [];
      for (const image of outputRefs) {
        const buffer = await fetchComfyImage({
          comfyUiUrl: config.comfyUiUrl,
          filename: image.filename,
          subfolder: image.subfolder,
          type: image.type,
        });
        outputs.push(
          await saveGeneratedVisual({
            buffer,
            filename: image.filename,
            storagePath: config.storagePath,
            publicMediaBaseUrl: config.publicMediaBaseUrl,
          }),
        );
      }

      sendJson(response, 200, {
        visualJobId: body.visualJobId,
        promptId: body.promptId,
        status: "generated",
        outputs,
      });
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
  console.log(`socialops-visual-worker listening on :${config.port}`);
});

function validateGenerateRequest(body: VisualGenerateRequest): string | null {
  if (!body.visualJobId) {
    return "visualJobId is required";
  }
  if (!body.templateKey) {
    return "templateKey is required";
  }
  if (!isAllowedWorkflowTemplateKey(body.templateKey)) {
    return "templateKey is not allowlisted";
  }
  if (!body.prompt) {
    return "prompt is required";
  }
  return null;
}

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
