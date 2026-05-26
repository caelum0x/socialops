import type { MotionPreset, MotionPresetProviderKey } from "./motion-presets.js";

export type BrollGenerationInput = {
  jobId: string;
  /** Public URL to the source still image (real product photo, screenshot, or rembg cutout). */
  sourceImageUrl: string;
  /** Optional negative prompt / things to avoid. */
  negativePrompt?: string;
  /** Free-text prompt; preset's `promptSuffix` is appended automatically. */
  prompt: string;
  preset: MotionPreset;
  durationSeconds: number;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
};

export type BrollGenerationResult = {
  jobId: string;
  provider: MotionPresetProviderKey;
  status: "queued" | "running" | "completed" | "failed";
  /** External provider's job id (Runway / Luma / Higgsfield). Empty for manual. */
  externalJobId?: string;
  /** Set once the clip is ready. */
  videoUrl?: string;
  /** Provider's own returned metadata (cost, model, etc.). */
  metadata?: Record<string, unknown>;
  error?: string;
};

export type VideoProviderAdapter = {
  key: MotionPresetProviderKey;
  /** True once env vars / credentials are configured. */
  isReady: () => boolean;
  /** Submit the generation. May return queued or completed depending on provider. */
  generate: (input: BrollGenerationInput) => Promise<BrollGenerationResult>;
  /** Poll a previously-queued job. */
  poll?: (jobId: string, externalJobId: string) => Promise<BrollGenerationResult>;
};

export type VideoProviderRouterConfig = {
  visualWorkerUrl: string;
  runwayApiKey?: string;
  lumaApiKey?: string;
  pikaApiKey?: string;
  higgsfieldApiKey?: string;
  klingAiAccessKey?: string;
  klingAiSecretKey?: string;
  hailuoApiKey?: string;
  replicateApiKey?: string;
  /** Default Replicate model identifier (e.g. "lucataco/wan-2.2-5b:abc123" or "fofr/ltx-video:xyz"). */
  replicateModelDefault?: string;
  huggingfaceToken?: string;
  /** Optional HF Space slug (e.g. "Wan-AI/Wan2.2-TI2V-5B") to call via gradio API. */
  huggingfaceSpace?: string;
  falApiKey?: string;
};

function buildPrompt(input: BrollGenerationInput): string {
  return `${input.prompt}. ${input.preset.promptSuffix}`.trim();
}

function comfyUiWanAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  return {
    key: "comfyui_wan_i2v",
    isReady: () => Boolean(config.visualWorkerUrl),
    async generate(input) {
      // The visual-worker owns the actual ComfyUI workflow submission and storage.
      // We forward an enriched job spec; visual-worker turns it into a `prompt` POST.
      const response = await fetch(`${config.visualWorkerUrl.replace(/\/$/u, "")}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          visual_job_id: input.jobId,
          template_key: "wan-i2v-broll",
          prompt: buildPrompt(input),
          negative_prompt: input.negativePrompt ?? "low quality, deformed product, blurry text, extra fingers",
          init_image_url: input.sourceImageUrl,
          aspect_ratio: input.aspectRatio,
          duration_seconds: input.durationSeconds,
          motion_params: input.preset.providerParams.comfyui_wan_i2v ?? {},
        }),
      });
      if (!response.ok) {
        return {
          jobId: input.jobId,
          provider: "comfyui_wan_i2v",
          status: "failed",
          error: `visual-worker /generate failed: ${response.status}`,
        };
      }
      const body = (await response.json()) as {
        visual_job_id: string;
        prompt_id?: string;
        status?: string;
        outputs?: Array<{ publicUrl?: string; storagePath?: string }>;
      };
      const status = body.status === "generated" ? "completed" : "queued";
      const videoUrl = body.outputs?.[0]?.publicUrl ?? body.outputs?.[0]?.storagePath;
      return {
        jobId: input.jobId,
        provider: "comfyui_wan_i2v",
        status,
        externalJobId: body.prompt_id,
        videoUrl,
      };
    },
    async poll(jobId, externalJobId) {
      const response = await fetch(`${config.visualWorkerUrl.replace(/\/$/u, "")}/poll`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visual_job_id: jobId, prompt_id: externalJobId }),
      });
      if (!response.ok) {
        return { jobId, provider: "comfyui_wan_i2v", status: "failed", error: `poll ${response.status}` };
      }
      const body = (await response.json()) as {
        status: string;
        outputs?: Array<{ publicUrl?: string; storagePath?: string }>;
      };
      return {
        jobId,
        provider: "comfyui_wan_i2v",
        status: body.status === "generated" ? "completed" : "running",
        externalJobId,
        videoUrl: body.outputs?.[0]?.publicUrl ?? body.outputs?.[0]?.storagePath,
      };
    },
  };
}

function runwayAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  return {
    key: "runway_gen3",
    isReady: () => Boolean(config.runwayApiKey && config.runwayApiKey.length > 0),
    async generate(input) {
      if (!config.runwayApiKey) {
        return { jobId: input.jobId, provider: "runway_gen3", status: "failed", error: "runway api key missing" };
      }
      // Runway's API takes (prompt, image_url, duration, ratio). Encode preset motion via prompt + params.
      const response = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${config.runwayApiKey}`,
          "content-type": "application/json",
          "x-runway-version": "2024-11-06",
        },
        body: JSON.stringify({
          promptImage: input.sourceImageUrl,
          promptText: buildPrompt(input),
          model: "gen3a_turbo",
          ratio: runwayRatio(input.aspectRatio),
          duration: Math.min(10, Math.max(5, input.durationSeconds)),
          ...(input.preset.providerParams.runway_gen3 ?? {}),
        }),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "runway_gen3", status: "failed", error: `runway ${response.status}` };
      }
      const body = (await response.json()) as { id: string };
      return { jobId: input.jobId, provider: "runway_gen3", status: "queued", externalJobId: body.id };
    },
    async poll(jobId, externalJobId) {
      if (!config.runwayApiKey) {
        return { jobId, provider: "runway_gen3", status: "failed", error: "runway api key missing" };
      }
      const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${externalJobId}`, {
        headers: {
          "authorization": `Bearer ${config.runwayApiKey}`,
          "x-runway-version": "2024-11-06",
        },
      });
      if (!response.ok) {
        return { jobId, provider: "runway_gen3", status: "failed", error: `runway poll ${response.status}` };
      }
      const body = (await response.json()) as { status: string; output?: string[] };
      const status: BrollGenerationResult["status"] = body.status === "SUCCEEDED" ? "completed" : body.status === "FAILED" ? "failed" : "running";
      return { jobId, provider: "runway_gen3", status, externalJobId, videoUrl: body.output?.[0] };
    },
  };
}

function lumaAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  return {
    key: "luma_dream",
    isReady: () => Boolean(config.lumaApiKey && config.lumaApiKey.length > 0),
    async generate(input) {
      if (!config.lumaApiKey) {
        return { jobId: input.jobId, provider: "luma_dream", status: "failed", error: "luma api key missing" };
      }
      const response = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${config.lumaApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildPrompt(input),
          keyframes: { frame0: { type: "image", url: input.sourceImageUrl } },
          aspect_ratio: input.aspectRatio,
          ...(input.preset.providerParams.luma_dream ?? {}),
        }),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "luma_dream", status: "failed", error: `luma ${response.status}` };
      }
      const body = (await response.json()) as { id: string };
      return { jobId: input.jobId, provider: "luma_dream", status: "queued", externalJobId: body.id };
    },
    async poll(jobId, externalJobId) {
      if (!config.lumaApiKey) {
        return { jobId, provider: "luma_dream", status: "failed", error: "luma api key missing" };
      }
      const response = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${externalJobId}`, {
        headers: { authorization: `Bearer ${config.lumaApiKey}` },
      });
      if (!response.ok) {
        return { jobId, provider: "luma_dream", status: "failed", error: `luma poll ${response.status}` };
      }
      const body = (await response.json()) as { state: string; assets?: { video?: string } };
      const status: BrollGenerationResult["status"] = body.state === "completed" ? "completed" : body.state === "failed" ? "failed" : "running";
      return { jobId, provider: "luma_dream", status, externalJobId, videoUrl: body.assets?.video };
    },
  };
}

function higgsfieldAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  return {
    key: "higgsfield",
    isReady: () => Boolean(config.higgsfieldApiKey && config.higgsfieldApiKey.length > 0),
    async generate(input) {
      if (!config.higgsfieldApiKey) {
        return { jobId: input.jobId, provider: "higgsfield", status: "failed", error: "higgsfield api key missing" };
      }
      // Higgsfield's motion-preset API is the closest match to our taxonomy.
      // Endpoint shape follows their /v1/generate spec at time of writing.
      const response = await fetch("https://api.higgsfield.ai/v1/motions/generate", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${config.higgsfieldApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildPrompt(input),
          image_url: input.sourceImageUrl,
          aspect_ratio: input.aspectRatio,
          duration_seconds: input.durationSeconds,
          motion: (input.preset.providerParams.higgsfield as { motion?: string } | undefined)?.motion ?? input.preset.key,
        }),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "higgsfield", status: "failed", error: `higgsfield ${response.status}` };
      }
      const body = (await response.json()) as { id?: string; status?: string; video_url?: string };
      return {
        jobId: input.jobId,
        provider: "higgsfield",
        status: body.status === "completed" ? "completed" : "queued",
        externalJobId: body.id,
        videoUrl: body.video_url,
      };
    },
  };
}

function pikaAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  return {
    key: "pika",
    isReady: () => Boolean(config.pikaApiKey && config.pikaApiKey.length > 0),
    async generate(input) {
      if (!config.pikaApiKey) {
        return { jobId: input.jobId, provider: "pika", status: "failed", error: "pika api key missing" };
      }
      // Pika is accessed via Fal.ai per the operator's plan; endpoint here is illustrative.
      const response = await fetch("https://fal.run/fal-ai/pika/v1.5/image-to-video", {
        method: "POST",
        headers: {
          "authorization": `Key ${config.pikaApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildPrompt(input),
          image_url: input.sourceImageUrl,
          duration: input.durationSeconds,
          aspect_ratio: input.aspectRatio,
          ...(input.preset.providerParams.pika ?? {}),
        }),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "pika", status: "failed", error: `pika ${response.status}` };
      }
      const body = (await response.json()) as { request_id?: string; video?: { url?: string } };
      return {
        jobId: input.jobId,
        provider: "pika",
        status: body.video?.url ? "completed" : "queued",
        externalJobId: body.request_id,
        videoUrl: body.video?.url,
      };
    },
  };
}

function manualAdapter(): VideoProviderAdapter {
  return {
    key: "manual",
    isReady: () => true,
    async generate(input) {
      return {
        jobId: input.jobId,
        provider: "manual",
        status: "queued",
        metadata: {
          message:
            "Manual provider: operator generates the clip externally (Kling/Hailuo/Runway/Luma/Higgsfield/Pika UI or local Wan/LTX) and uploads via /videos/people/upload, then attaches by URL.",
          recommended_free_path: "klingai.com (free 60/day) or hailuoai.com (free tier) → download MP4 → POST /v1/workspaces/:id/videos/people/upload",
        },
      };
    },
  };
}

function klingAiAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  // Kling AI API uses HMAC-signed JWTs from access+secret. The free tier on
  // the web UI is 60 generations/day; their API is paid but generous.
  return {
    key: "kling_ai",
    isReady: () => Boolean(config.klingAiAccessKey && config.klingAiSecretKey),
    async generate(input) {
      if (!config.klingAiAccessKey || !config.klingAiSecretKey) {
        return { jobId: input.jobId, provider: "kling_ai", status: "failed", error: "kling api keys missing" };
      }
      const token = signKlingJwt(config.klingAiAccessKey, config.klingAiSecretKey);
      const response = await fetch("https://api.klingai.com/v1/videos/image2video", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          model_name: "kling-v1-6",
          image: input.sourceImageUrl,
          prompt: buildPrompt(input),
          negative_prompt: input.negativePrompt ?? "",
          aspect_ratio: klingAspect(input.aspectRatio),
          duration: input.durationSeconds <= 6 ? "5" : "10",
          mode: "std",
          ...(input.preset.providerParams.kling_ai ?? {}),
        }),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "kling_ai", status: "failed", error: `kling ${response.status}` };
      }
      const body = (await response.json()) as { data?: { task_id?: string; task_status?: string } };
      return {
        jobId: input.jobId,
        provider: "kling_ai",
        status: body.data?.task_status === "succeed" ? "completed" : "queued",
        externalJobId: body.data?.task_id,
      };
    },
    async poll(jobId, externalJobId) {
      if (!config.klingAiAccessKey || !config.klingAiSecretKey) {
        return { jobId, provider: "kling_ai", status: "failed", error: "kling api keys missing" };
      }
      const token = signKlingJwt(config.klingAiAccessKey, config.klingAiSecretKey);
      const response = await fetch(`https://api.klingai.com/v1/videos/image2video/${externalJobId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return { jobId, provider: "kling_ai", status: "failed", error: `kling poll ${response.status}` };
      }
      const body = (await response.json()) as {
        data?: { task_status?: string; task_result?: { videos?: Array<{ url?: string }> } };
      };
      const status: BrollGenerationResult["status"] =
        body.data?.task_status === "succeed"
          ? "completed"
          : body.data?.task_status === "failed"
            ? "failed"
            : "running";
      return {
        jobId,
        provider: "kling_ai",
        status,
        externalJobId,
        videoUrl: body.data?.task_result?.videos?.[0]?.url,
      };
    },
  };
}

function hailuoAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  // Hailuo (MiniMax) Video-01 endpoint.
  return {
    key: "hailuo_minimax",
    isReady: () => Boolean(config.hailuoApiKey),
    async generate(input) {
      if (!config.hailuoApiKey) {
        return { jobId: input.jobId, provider: "hailuo_minimax", status: "failed", error: "hailuo api key missing" };
      }
      const response = await fetch("https://api.minimaxi.chat/v1/video_generation", {
        method: "POST",
        headers: { authorization: `Bearer ${config.hailuoApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "I2V-01-Director",
          prompt: buildPrompt(input),
          first_frame_image: input.sourceImageUrl,
          ...(input.preset.providerParams.hailuo_minimax ?? {}),
        }),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "hailuo_minimax", status: "failed", error: `hailuo ${response.status}` };
      }
      const body = (await response.json()) as { task_id?: string; base_resp?: { status_code?: number } };
      return {
        jobId: input.jobId,
        provider: "hailuo_minimax",
        status: body.base_resp?.status_code === 0 ? "queued" : "failed",
        externalJobId: body.task_id,
      };
    },
    async poll(jobId, externalJobId) {
      if (!config.hailuoApiKey) {
        return { jobId, provider: "hailuo_minimax", status: "failed", error: "hailuo api key missing" };
      }
      const response = await fetch(`https://api.minimaxi.chat/v1/query/video_generation?task_id=${externalJobId}`, {
        headers: { authorization: `Bearer ${config.hailuoApiKey}` },
      });
      if (!response.ok) {
        return { jobId, provider: "hailuo_minimax", status: "failed", error: `hailuo poll ${response.status}` };
      }
      const body = (await response.json()) as { status?: string; file_id?: string; download_url?: string };
      const status: BrollGenerationResult["status"] =
        body.status === "Success" ? "completed" : body.status === "Fail" ? "failed" : "running";
      return { jobId, provider: "hailuo_minimax", status, externalJobId, videoUrl: body.download_url };
    },
  };
}

function replicateAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  // Replicate hosts every open video model: Wan2.2, Hunyuan, LTX, Mochi, CogVideoX.
  // Cheapest API path. $0.01–0.20 per clip. Default model is overridable.
  return {
    key: "replicate",
    isReady: () => Boolean(config.replicateApiKey),
    async generate(input) {
      if (!config.replicateApiKey) {
        return { jobId: input.jobId, provider: "replicate", status: "failed", error: "replicate api key missing" };
      }
      const modelRef = config.replicateModelDefault ?? "lucataco/wan-2.2-5b-i2v";
      const versionMatch = modelRef.includes(":") ? modelRef.split(":")[1] : null;
      const owner = modelRef.split("/")[0];
      const name = modelRef.split("/")[1]?.split(":")[0];
      const endpoint = versionMatch
        ? "https://api.replicate.com/v1/predictions"
        : `https://api.replicate.com/v1/models/${owner}/${name}/predictions`;
      const body: Record<string, unknown> = {
        input: {
          image: input.sourceImageUrl,
          prompt: buildPrompt(input),
          aspect_ratio: input.aspectRatio,
          num_frames: Math.min(120, input.durationSeconds * 24),
          ...(input.preset.providerParams.replicate ?? {}),
        },
      };
      if (versionMatch) {
        body.version = versionMatch;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.replicateApiKey}`,
          "content-type": "application/json",
          prefer: "wait=10",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "replicate", status: "failed", error: `replicate ${response.status} ${await response.text()}` };
      }
      const data = (await response.json()) as { id: string; status: string; output?: unknown };
      const videoUrl = pickReplicateOutput(data.output);
      const status: BrollGenerationResult["status"] =
        data.status === "succeeded"
          ? "completed"
          : data.status === "failed" || data.status === "canceled"
            ? "failed"
            : "queued";
      return { jobId: input.jobId, provider: "replicate", status, externalJobId: data.id, videoUrl };
    },
    async poll(jobId, externalJobId) {
      if (!config.replicateApiKey) {
        return { jobId, provider: "replicate", status: "failed", error: "replicate api key missing" };
      }
      const response = await fetch(`https://api.replicate.com/v1/predictions/${externalJobId}`, {
        headers: { authorization: `Bearer ${config.replicateApiKey}` },
      });
      if (!response.ok) {
        return { jobId, provider: "replicate", status: "failed", error: `replicate poll ${response.status}` };
      }
      const data = (await response.json()) as { status: string; output?: unknown };
      const videoUrl = pickReplicateOutput(data.output);
      const status: BrollGenerationResult["status"] =
        data.status === "succeeded"
          ? "completed"
          : data.status === "failed" || data.status === "canceled"
            ? "failed"
            : "running";
      return { jobId, provider: "replicate", status, externalJobId, videoUrl };
    },
  };
}

function huggingfaceSpaceAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  // Truly free fallback: invoke a HuggingFace Space's gradio API. Rate-limited
  // and intermittent — community-hosted demos shut down without notice.
  return {
    key: "huggingface_space",
    isReady: () => Boolean(config.huggingfaceSpace),
    async generate(input) {
      if (!config.huggingfaceSpace) {
        return { jobId: input.jobId, provider: "huggingface_space", status: "failed", error: "no HF space configured" };
      }
      const slug = encodeURIComponent(config.huggingfaceSpace);
      const url = `https://${slug}.hf.space/run/predict`;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (config.huggingfaceToken) {
        headers.authorization = `Bearer ${config.huggingfaceToken}`;
      }
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: [
            input.sourceImageUrl,
            buildPrompt(input),
            input.aspectRatio,
            input.durationSeconds,
          ],
        }),
      });
      if (!response.ok) {
        return {
          jobId: input.jobId,
          provider: "huggingface_space",
          status: "failed",
          error: `HF space ${response.status}; Space may be sleeping or offline`,
        };
      }
      const body = (await response.json()) as { data?: Array<{ name?: string; url?: string } | string> };
      const first = body.data?.[0];
      const videoUrl = typeof first === "string" ? first : first?.url ?? null;
      return {
        jobId: input.jobId,
        provider: "huggingface_space",
        status: videoUrl ? "completed" : "queued",
        videoUrl: videoUrl ?? undefined,
        metadata: {
          space: config.huggingfaceSpace,
          warning: "HF Spaces are community-hosted; rate-limited and may go offline.",
        },
      };
    },
  };
}

function falAdapter(config: VideoProviderRouterConfig): VideoProviderAdapter {
  // fal.ai aggregator. Hosts LTX-Video, Hunyuan, Mochi, Wan, plus Pika 1.5
  // through a unified API. Pay-per-call, cheaper than Runway/Luma for many models.
  return {
    key: "fal_ai",
    isReady: () => Boolean(config.falApiKey),
    async generate(input) {
      if (!config.falApiKey) {
        return { jobId: input.jobId, provider: "fal_ai", status: "failed", error: "fal api key missing" };
      }
      // Default to LTX-Video for speed; operator can override via providerParams.
      const model = "fal-ai/ltx-video/image-to-video";
      const response = await fetch(`https://fal.run/${model}`, {
        method: "POST",
        headers: { authorization: `Key ${config.falApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          image_url: input.sourceImageUrl,
          prompt: buildPrompt(input),
          aspect_ratio: input.aspectRatio,
          num_frames: Math.min(120, input.durationSeconds * 24),
        }),
      });
      if (!response.ok) {
        return { jobId: input.jobId, provider: "fal_ai", status: "failed", error: `fal ${response.status}` };
      }
      const body = (await response.json()) as { video?: { url?: string }; request_id?: string };
      return {
        jobId: input.jobId,
        provider: "fal_ai",
        status: body.video?.url ? "completed" : "queued",
        externalJobId: body.request_id,
        videoUrl: body.video?.url,
      };
    },
  };
}

function pickReplicateOutput(output: unknown): string | undefined {
  if (typeof output === "string") {
    return output;
  }
  if (Array.isArray(output) && typeof output[0] === "string") {
    return output[0];
  }
  if (output && typeof output === "object" && "url" in output && typeof (output as { url?: unknown }).url === "string") {
    return (output as { url: string }).url;
  }
  return undefined;
}

function klingAspect(aspect: BrollGenerationInput["aspectRatio"]): string {
  switch (aspect) {
    case "16:9":
      return "16:9";
    case "1:1":
      return "1:1";
    case "4:5":
    case "9:16":
    default:
      return "9:16";
  }
}

// Lightweight HS256 JWT signer used only for Kling's accessKey+secretKey auth.
// We avoid adding `jose` as a dep — Kling's JWT contract is small and known.
function signKlingJwt(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: accessKey,
      exp: now + 1800,
      nbf: now - 5,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = hmacSha256Base64Url(secretKey, signingInput);
  return `${signingInput}.${signature}`;
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_");
}

function hmacSha256Base64Url(secret: string, message: string): string {
  // Use Node's crypto via dynamic require to keep this file framework-agnostic.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const mac = crypto.createHmac("sha256", secret).update(message).digest();
  return base64UrlEncode(mac);
}

export type VideoProviderRouter = {
  resolve: (preferred?: string) => VideoProviderAdapter;
  list: () => Array<{ key: MotionPresetProviderKey; ready: boolean }>;
  byKey: (key: string) => VideoProviderAdapter | undefined;
};

export function createVideoProviderRouter(config: VideoProviderRouterConfig): VideoProviderRouter {
  // Adapter order = preference when "first ready" is picked.
  // Cheap / free first, paid premium second, manual fallback last.
  const adapters: VideoProviderAdapter[] = [
    klingAiAdapter(config),
    hailuoAdapter(config),
    replicateAdapter(config),
    falAdapter(config),
    huggingfaceSpaceAdapter(config),
    higgsfieldAdapter(config),
    runwayAdapter(config),
    lumaAdapter(config),
    pikaAdapter(config),
    comfyUiWanAdapter(config),
    manualAdapter(),
  ];
  const map = new Map(adapters.map((adapter) => [adapter.key, adapter]));

  function resolve(preferred?: string): VideoProviderAdapter {
    if (preferred) {
      const exact = map.get(preferred as MotionPresetProviderKey);
      if (exact && exact.isReady()) {
        return exact;
      }
    }
    const firstReady = adapters.find((adapter) => adapter.isReady() && adapter.key !== "manual");
    return firstReady ?? manualAdapter();
  }

  return {
    resolve,
    byKey: (key) => map.get(key as MotionPresetProviderKey),
    list: () => adapters.map((adapter) => ({ key: adapter.key, ready: adapter.isReady() })),
  };
}

function runwayRatio(aspect: BrollGenerationInput["aspectRatio"]): string {
  switch (aspect) {
    case "16:9":
      return "1280:768";
    case "1:1":
      return "960:960";
    case "4:5":
      return "768:1280";
    case "9:16":
    default:
      return "768:1280";
  }
}
