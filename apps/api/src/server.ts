import cors from "@fastify/cors";
import fastify from "fastify";
import { ZodError } from "zod";

import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { createDeckWorkerClient } from "./deck-worker.js";
import { ApiError } from "./errors.js";
import { selectIdentityProvider } from "./identity.js";
import { createMiniClawClient } from "./miniclaw.js";
import { createOpenPostClient } from "./openpost.js";
import { registerRoutes } from "./routes.js";
import { createStorageClient } from "./storage.js";
import { createVideoProviderRouter } from "./video-providers.js";
import { createVisualWorkerClient } from "./visual-worker.js";
import { createVideoWorkerClient } from "./video-worker.js";
import { createWhisperClient } from "./whisper.js";
import { createComfyUiClient } from "@socialops/integrations/comfyui";
import { createPokeeResearchClient } from "@socialops/integrations/pokee";

const config = loadConfig();
const db = createDb(config.databaseUrl);

const app = fastify({
  logger: true,
  trustProxy: true,
});

await app.register(cors, {
  origin: true,
  credentials: true,
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ApiError) {
    reply.status(error.statusCode).send({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    reply.status(400).send({ error: "invalid request", issues: error.issues });
    return;
  }
  app.log.error(error);
  reply.status(500).send({ error: "internal server error" });
});

const identityProvider = selectIdentityProvider({
  clerkSecretKey: config.clerkSecretKey,
  clerkIssuer: config.clerkIssuer,
  production: config.nodeEnv === "production",
});

app.log.info({ identity: identityProvider.name }, "identity provider selected");

await registerRoutes(app, {
  db,
  identityProvider,
  openPost: createOpenPostClient(config.openPostUrl, config.openPostInternalToken),
  comfyUi: createComfyUiClient(config.comfyUiUrl),
  visualWorker: createVisualWorkerClient(config.visualWorkerUrl),
  videoWorker: createVideoWorkerClient(config.videoWorkerUrl),
  deckWorker: createDeckWorkerClient(config.deckWorkerUrl),
  pokeeResearch: createPokeeResearchClient(config.pokeeResearchUrl),
  miniClaw: config.miniClawEnabled ? createMiniClawClient(config.miniClawUrl) : undefined,
  whisper: config.whisperEnabled ? createWhisperClient(config.whisperUrl) : undefined,
  videoProviders: createVideoProviderRouter({
    visualWorkerUrl: config.visualWorkerUrl,
    runwayApiKey: config.runwayApiKey,
    lumaApiKey: config.lumaApiKey,
    pikaApiKey: config.pikaApiKey,
    higgsfieldApiKey: config.higgsfieldApiKey,
    klingAiAccessKey: config.klingAiAccessKey,
    klingAiSecretKey: config.klingAiSecretKey,
    hailuoApiKey: config.hailuoApiKey,
    replicateApiKey: config.replicateApiKey,
    replicateModelDefault: config.replicateModelDefault,
    huggingfaceToken: config.huggingfaceToken,
    huggingfaceSpace: config.huggingfaceSpace,
    falApiKey: config.falApiKey,
  }),
  storage: createStorageClient({
    kind: config.storageKind,
    bucket: config.storageBucket,
    endpoint: config.storageEndpoint,
    region: config.storageRegion,
    accessKeyId: config.storageAccessKeyId,
    secretAccessKey: config.storageSecretAccessKey,
    publicBaseUrl: config.storagePublicBaseUrl,
  }),
  mediaRuntimeProfile: config.mediaRuntimeProfile,
  allowHeavyMediaWorkflows: config.allowHeavyMediaWorkflows,
  production: config.nodeEnv === "production",
});

const shutdown = async () => {
  await app.close();
  await db.close();
};

process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});

await app.listen({ port: config.port, host: "0.0.0.0" });
