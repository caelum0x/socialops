import type { LocalVideoKind, LocalVideoScenePlan, ProfessionalVideoProviderTarget } from "./video-pipeline.js";

export type ScenePlan = LocalVideoScenePlan;

export type VideoProviderKey = ProfessionalVideoProviderTarget;

export type GeneratedClip = {
  id: string;
  providerKey: VideoProviderKey;
  sceneOrder: number;
  kind: "broll" | "avatar" | "product_capture" | "thumbnail" | "assembly";
  status: "planned" | "queued" | "generated" | "blocked";
  workflowPresetKey?: string;
  prompt: string;
  requiredInputs: string[];
  outputPath?: string;
  publicUrl?: string;
};

export type VideoProviderGenerateInput = {
  script: string;
  scenes: ScenePlan[];
  productUrl?: string;
  referenceImages?: string[];
  screenshots?: string[];
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
};

export type VideoProvider = {
  key: VideoProviderKey;
  supports: string[];
  generate(input: VideoProviderGenerateInput): Promise<GeneratedClip[]>;
};

export type VideoProviderCapability = {
  key: VideoProviderKey;
  label: string;
  role: string;
  supports: string[];
  workflowPresetKeys: string[];
  requiredEnvVars: string[];
  localFirst: boolean;
  notes: string;
};

export type VideoProviderStatus = VideoProviderCapability & {
  configured: boolean;
  missingEnvVars: string[];
};

export type ProfessionalVideoTemplateKey =
  | "ugc-founder-problem"
  | "product-url-to-ad"
  | "ai-influencer-explainer"
  | "product-demo-proof"
  | "founder-diligence-story"
  | "tiktok-native-hook";

export type ProfessionalVideoTemplate = {
  key: ProfessionalVideoTemplateKey;
  title: string;
  kinds: LocalVideoKind[];
  hookStyle: string;
  shotCount: number;
  providerPreference: VideoProviderKey[];
  requiredRealAssets: string[];
  captionStyle: string;
  platformCrop: "9:16" | "16:9" | "1:1" | "4:5";
  approvalRequirements: string[];
};

export const professionalVideoTemplateKeys = [
  "ugc-founder-problem",
  "product-url-to-ad",
  "ai-influencer-explainer",
  "product-demo-proof",
  "founder-diligence-story",
  "tiktok-native-hook",
] as const satisfies readonly ProfessionalVideoTemplateKey[];

export type ProfessionalVideoProviderPlanInput = {
  kind: LocalVideoKind;
  templateKey: ProfessionalVideoTemplateKey;
  productOrProject: string;
  objective: string;
  targetAudience: string;
  script?: string;
  scenes?: ScenePlan[];
  productUrl?: string;
  referenceImages?: string[];
  screenshots?: string[];
  screenRecordings?: string[];
  aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
  preferExternal?: boolean;
  includeExternalProviders?: boolean;
};

export type ProfessionalVideoProviderPlan = {
  architecture: string[];
  template: ProfessionalVideoTemplate;
  providerOrder: VideoProviderKey[];
  providerStatuses: VideoProviderStatus[];
  generatedClipPlan: GeneratedClip[];
  comfyClipJobs: ComfyClipJobPlan[];
  requiredInputs: string[];
  blockedReasons: string[];
  assembly: {
    renderer: "remotion";
    postProcessor: "ffmpeg";
    role: string;
  };
  publishing: {
    handoff: "openpost_postiz_or_manual";
    approvalRequired: true;
    notes: string[];
  };
};

export type ComfyClipJobPlan = {
  sceneOrder: number;
  type: "short_video_frame_set" | "video_thumbnail" | "ai_broll";
  workflowKey: "wan-i2v-broll" | "ltxv-fast-motion-broll" | "video-thumbnail";
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  queueNow: false;
  reason: string;
};

export const videoProviderCapabilities: VideoProviderCapability[] = [
  {
    key: "comfyui_wan",
    label: "ComfyUI Wan image-to-video",
    role: "Local product-adjacent b-roll, thumbnails, motion backgrounds, and first/last-frame controlled clips.",
    supports: ["image-to-video", "first-last-frame", "broll", "motion-backgrounds", "visual-variations"],
    workflowPresetKeys: ["wan-i2v-broll"],
    requiredEnvVars: ["COMFYUI_URL"],
    localFirst: true,
    notes: "Use for supporting clips. Do not generate fake product UI.",
  },
  {
    key: "comfyui_ltxv",
    label: "ComfyUI LTXV fast motion",
    role: "Fast local motion testing and b-roll iteration before spending external video credits.",
    supports: ["image-to-video", "fast-iteration", "hook-testing", "motion-broll"],
    workflowPresetKeys: ["ltxv-fast-motion-broll"],
    requiredEnvVars: ["COMFYUI_URL"],
    localFirst: true,
    notes: "Use for quick concept clips and low-cost visual exploration.",
  },
  {
    key: "higgsfield",
    label: "Higgsfield-style trend video",
    role: "High-end viral presets, camera-motion logic, trend-native UGC, and product URL to ad variants.",
    supports: ["product-url-to-ad", "viral-presets", "camera-motion", "trend-recreation", "variant-generation"],
    workflowPresetKeys: ["higgsfield-style-trend-ad"],
    requiredEnvVars: ["HIGGSFIELD_API_KEY"],
    localFirst: false,
    notes: "Optional external adapter for professional social-native creative variations.",
  },
  {
    key: "pippit",
    label: "Pippit-style product UGC suite",
    role: "Product-link UGC, avatar spokesperson clips, quick edits, smart crop, and publisher handoff.",
    supports: ["product-link-to-video", "ugc", "custom-avatar", "smart-crop", "publish-handoff"],
    workflowPresetKeys: ["pippit-product-ugc-suite"],
    requiredEnvVars: ["PIPPIT_API_KEY"],
    localFirst: false,
    notes: "Optional external adapter for commerce/product UGC workflows.",
  },
  {
    key: "seedance",
    label: "Dreamina Seedance director clips",
    role: "High-motion, TikTok-native, consistent character or brand scenes.",
    supports: ["high-motion", "native-tiktok", "consistent-character", "multi-scene-story"],
    workflowPresetKeys: ["seedance-director-i2v"],
    requiredEnvVars: ["SEEDANCE_API_KEY"],
    localFirst: false,
    notes: "Optional external adapter for cinematic AI influencer and high-motion clips.",
  },
  {
    key: "avatar_provider",
    label: "Consented avatar provider",
    role: "Consented avatar/talking-head spokesperson clips with voice and lip sync.",
    supports: ["avatar", "talking-head", "lip-sync", "voiceover"],
    workflowPresetKeys: ["consented-avatar-spokesperson"],
    requiredEnvVars: ["AVATAR_PROVIDER_API_KEY"],
    localFirst: false,
    notes: "Requires explicit likeness and voice consent. Never use for fake testimonials.",
  },
  {
    key: "remotion_ffmpeg",
    label: "Remotion and FFmpeg",
    role: "Final edit, captions, crops, stitching, encoding, export packages, and platform variants.",
    supports: ["assembly", "captions", "crop", "encoding", "export-package"],
    workflowPresetKeys: [],
    requiredEnvVars: [],
    localFirst: true,
    notes: "Assembly layer only. It should not be treated as the video generator.",
  },
];

export const professionalVideoTemplates: ProfessionalVideoTemplate[] = [
  {
    key: "ugc-founder-problem",
    title: "UGC founder problem",
    kinds: ["ugc"],
    hookStyle: "first-person founder pain, no hype, immediate problem statement",
    shotCount: 5,
    providerPreference: ["pippit", "higgsfield", "avatar_provider", "comfyui_wan", "remotion_ffmpeg"],
    requiredRealAssets: ["consented talking-head clip or approved avatar identity", "product screenshot or product page"],
    captionStyle: "large organic captions, quick emphasis words, safe mobile margins",
    platformCrop: "9:16",
    approvalRequirements: ["likeness consent", "claim review", "human approval before export"],
  },
  {
    key: "product-url-to-ad",
    title: "Product URL to ad",
    kinds: ["ugc", "product_demo"],
    hookStyle: "problem-led product ad with first-second payoff",
    shotCount: 6,
    providerPreference: ["higgsfield", "pippit", "comfyui_wan", "remotion_ffmpeg"],
    requiredRealAssets: ["product URL", "brand-safe claims", "real screenshot for UI products"],
    captionStyle: "performance ad captions with fast line breaks",
    platformCrop: "9:16",
    approvalRequirements: ["unsupported-claim removal", "product UI truth check", "human approval before scheduling"],
  },
  {
    key: "ai-influencer-explainer",
    title: "AI influencer explainer",
    kinds: ["ai_video", "ugc"],
    hookStyle: "creator persona explains one useful idea with visual cutaways",
    shotCount: 5,
    providerPreference: ["seedance", "higgsfield", "avatar_provider", "comfyui_wan", "remotion_ffmpeg"],
    requiredRealAssets: ["approved persona or consented avatar", "source facts"],
    captionStyle: "creator-style subtitles with punchy scene resets",
    platformCrop: "9:16",
    approvalRequirements: ["persona approval", "source-backed claims", "no public figure impersonation"],
  },
  {
    key: "product-demo-proof",
    title: "Product demo proof",
    kinds: ["product_demo"],
    hookStyle: "show the real workflow before explaining it",
    shotCount: 5,
    providerPreference: ["comfyui_wan", "pippit", "higgsfield", "remotion_ffmpeg"],
    requiredRealAssets: ["screen recording", "screenshots", "product URL"],
    captionStyle: "clean product captions with cursor callouts and zoom labels",
    platformCrop: "9:16",
    approvalRequirements: ["real UI required", "no fake results", "human approval before export"],
  },
  {
    key: "founder-diligence-story",
    title: "Founder diligence story",
    kinds: ["ai_video", "product_demo", "ugc"],
    hookStyle: "founder risk story leading into proof and diligence workflow",
    shotCount: 5,
    providerPreference: ["comfyui_wan", "higgsfield", "pippit", "remotion_ffmpeg"],
    requiredRealAssets: ["source facts", "product URL", "real screenshot for product UI"],
    captionStyle: "serious founder tone, high contrast, minimal words per caption",
    platformCrop: "9:16",
    approvalRequirements: ["claim review", "no invented investor data", "human approval before export"],
  },
  {
    key: "tiktok-native-hook",
    title: "TikTok native hook",
    kinds: ["ugc", "ai_video"],
    hookStyle: "fast pattern interrupt with jump cuts and visual reset every 2-3 seconds",
    shotCount: 7,
    providerPreference: ["seedance", "higgsfield", "pippit", "comfyui_ltxv", "remotion_ffmpeg"],
    requiredRealAssets: ["source facts or product page", "approved visual references"],
    captionStyle: "native short-form captions with aggressive pacing",
    platformCrop: "9:16",
    approvalRequirements: ["platform-native review", "brand safety review", "human approval before publish"],
  },
];

export function getProfessionalVideoTemplate(key: string): ProfessionalVideoTemplate | undefined {
  return professionalVideoTemplates.find((template) => template.key === key);
}

export function listVideoProviderStatuses(env: Record<string, string | undefined> = {}): VideoProviderStatus[] {
  const effectiveEnv: Record<string, string | undefined> = {
    COMFYUI_URL: "http://localhost:8188",
    ...env,
  };
  return videoProviderCapabilities.map((provider) => {
    const missingEnvVars = provider.requiredEnvVars.filter((key) => !effectiveEnv[key]);
    return {
      ...provider,
      configured: missingEnvVars.length === 0,
      missingEnvVars,
    };
  });
}

export function createPlanOnlyVideoProvider(key: VideoProviderKey): VideoProvider {
  const capability = videoProviderCapabilities.find((provider) => provider.key === key);
  if (!capability) {
    throw new Error(`unknown video provider: ${key}`);
  }

  return {
    key,
    supports: capability.supports,
    async generate(input) {
      return input.scenes.map((scene) => ({
        id: `${key}-scene-${scene.order}`,
        providerKey: key,
        sceneOrder: scene.order,
        kind: clipKindForProvider(key),
        status: "planned",
        workflowPresetKey: capability.workflowPresetKeys[0],
        prompt: scene.visualPrompt,
        requiredInputs: requiredInputsForProvider(key, input),
      }));
    },
  };
}

export function createProfessionalVideoProviderPlan(
  input: ProfessionalVideoProviderPlanInput,
  env: Record<string, string | undefined> = {},
): ProfessionalVideoProviderPlan {
  const template = getProfessionalVideoTemplate(input.templateKey);
  if (!template) {
    throw new Error(`unknown professional video template: ${input.templateKey}`);
  }
  if (!template.kinds.includes(input.kind)) {
    throw new Error(`${template.key} does not support ${input.kind}`);
  }

  const providerStatuses = listVideoProviderStatuses(env);
  const providerOrder = routeProviderOrder(input, template, providerStatuses);
  const scenes = input.scenes && input.scenes.length > 0 ? input.scenes : fallbackScenes(input, template);
  const generatedClipPlan = buildGeneratedClipPlan(providerOrder, input, scenes, providerStatuses);
  const comfyClipJobs = createComfyClipJobPlan(input, scenes);
  const requiredInputs = collectRequiredInputs(input, template);
  const blockedReasons = collectBlockedReasons(input, template, providerStatuses, providerOrder);

  return {
    architecture: [
      "VCPeer URL / notes / assets",
      "Pokee research",
      "MiniClaw script + shot plan",
      "provider router",
      "ComfyUI/external video clips",
      "Remotion/FFmpeg final edit",
      "approval",
      "OpenPost/Postiz/manual publish",
    ],
    template,
    providerOrder,
    providerStatuses,
    generatedClipPlan,
    comfyClipJobs,
    requiredInputs,
    blockedReasons,
    assembly: {
      renderer: "remotion",
      postProcessor: "ffmpeg",
      role: "assemble generated clips, real product captures, captions, crops, audio, and export packages",
    },
    publishing: {
      handoff: "openpost_postiz_or_manual",
      approvalRequired: true,
      notes: [
        "Attach approved video assets to content drafts.",
        "Use OpenPost/Postiz where connected.",
        "Use manual export where platform APIs are limited.",
      ],
    },
  };
}

function routeProviderOrder(
  input: ProfessionalVideoProviderPlanInput,
  template: ProfessionalVideoTemplate,
  statuses: VideoProviderStatus[],
): VideoProviderKey[] {
  const configured = new Set(statuses.filter((status) => status.configured).map((status) => status.key));
  const localPreference = template.providerPreference.filter((key) =>
    videoProviderCapabilities.find((provider) => provider.key === key)?.localFirst,
  );
  const externalPreference = template.providerPreference.filter((key) =>
    !videoProviderCapabilities.find((provider) => provider.key === key)?.localFirst,
  );
  const preferred: VideoProviderKey[] = input.preferExternal || input.includeExternalProviders
    ? template.providerPreference
    : localPreference.length > 0
      ? localPreference
      : ["comfyui_wan", "remotion_ffmpeg"];
  const available = preferred.filter((key) => configured.has(key));
  const unavailable = preferred.filter((key) => !configured.has(key));
  const futureExternal = input.includeExternalProviders || input.preferExternal ? unavailable : [];
  const ordered: VideoProviderKey[] = [
    ...available,
    ...futureExternal.filter((key) => key !== "remotion_ffmpeg"),
    ...(input.includeExternalProviders || input.preferExternal ? [] : externalPreference.filter((key) => configured.has(key))),
    "remotion_ffmpeg",
  ];
  return ordered.filter(
    (key, index, source) => source.indexOf(key) === index,
  );
}

function fallbackScenes(input: ProfessionalVideoProviderPlanInput, template: ProfessionalVideoTemplate): ScenePlan[] {
  const product = input.productOrProject;
  const base = input.objective || `Create a professional social-native video for ${product}.`;
  const scenes: ScenePlan[] = [
    {
      order: 1,
      sceneType: "hook",
      durationSeconds: 3,
      narration: base,
      caption: template.hookStyle,
      requiredAsset: input.kind === "product_demo" ? "screen_recording" : "ai_broll",
      visualPrompt: `${product}: first-second hook, cinematic social-native opener`,
    },
    {
      order: 2,
      sceneType: "problem",
      durationSeconds: 5,
      narration: `Show the pain for ${input.targetAudience}.`,
      caption: "The problem",
      requiredAsset: "ai_broll",
      visualPrompt: `${product}: product-adjacent b-roll showing the before-state`,
    },
    {
      order: 3,
      sceneType: "proof",
      durationSeconds: 7,
      narration: `Show proof from real sources or real product capture.`,
      caption: "The proof",
      requiredAsset: input.kind === "product_demo" ? "screenshot" : "ai_broll",
      visualPrompt: `${product}: source-backed proof visual with motion and depth`,
    },
    {
      order: 4,
      sceneType: "demo",
      durationSeconds: 10,
      narration: `Show the actual workflow or a product-safe visual equivalent.`,
      caption: "The workflow",
      requiredAsset: input.kind === "product_demo" ? "screen_recording" : "ai_broll",
      visualPrompt: `${product}: workflow cutaway with camera movement`,
    },
    {
      order: 5,
      sceneType: "cta",
      durationSeconds: 4,
      narration: `Point viewers to the next action.`,
      caption: "Try it",
      requiredAsset: "text_card",
      visualPrompt: `${product}: final CTA, minimal text, strong visual finish`,
    },
  ];
  return scenes.slice(0, template.shotCount);
}

function buildGeneratedClipPlan(
  providerOrder: VideoProviderKey[],
  input: ProfessionalVideoProviderPlanInput,
  scenes: ScenePlan[],
  statuses: VideoProviderStatus[],
): GeneratedClip[] {
  const primaryClipProvider = providerOrder.find((key) => key !== "remotion_ffmpeg") ?? "comfyui_wan";
  const statusByKey = new Map(statuses.map((status) => [status.key, status]));
  return scenes.map((scene) => {
    const providerKey = providerForScene(scene, input, primaryClipProvider);
    const providerStatus = statusByKey.get(providerKey);
    return {
      id: `${providerKey}-scene-${scene.order}`,
      providerKey,
      sceneOrder: scene.order,
      kind: clipKindForProvider(providerKey),
      status: providerStatus?.configured ? "planned" : "blocked",
      workflowPresetKey: providerStatus?.workflowPresetKeys[0],
      prompt: scene.visualPrompt,
      requiredInputs: requiredInputsForScene(scene, input),
    };
  });
}

function providerForScene(
  scene: ScenePlan,
  input: ProfessionalVideoProviderPlanInput,
  primaryClipProvider: VideoProviderKey,
): VideoProviderKey {
  if (scene.requiredAsset === "screen_recording" || scene.requiredAsset === "screenshot") {
    return input.screenshots?.length || input.screenRecordings?.length ? "remotion_ffmpeg" : "comfyui_wan";
  }
  return primaryClipProvider === "remotion_ffmpeg" ? "comfyui_wan" : primaryClipProvider;
}

function collectRequiredInputs(input: ProfessionalVideoProviderPlanInput, template: ProfessionalVideoTemplate): string[] {
  const required = new Set(template.requiredRealAssets);
  if (!input.productUrl) {
    required.add("product URL");
  }
  if (input.kind === "product_demo" && !input.screenshots?.length && !input.screenRecordings?.length) {
    required.add("real screenshots or screen recording");
  }
  if ((input.kind === "ugc" || template.key === "ai-influencer-explainer") && !input.referenceImages?.length) {
    required.add("approved persona/reference assets if using an avatar");
  }
  return [...required];
}

function collectBlockedReasons(
  input: ProfessionalVideoProviderPlanInput,
  template: ProfessionalVideoTemplate,
  statuses: VideoProviderStatus[],
  providerOrder: VideoProviderKey[],
): string[] {
  const reasons: string[] = [];
  const statusByKey = new Map(statuses.map((status) => [status.key, status]));
  for (const providerKey of providerOrder) {
    const status = statusByKey.get(providerKey);
    if (status && !status.configured && (input.includeExternalProviders || input.preferExternal || status.localFirst)) {
      reasons.push(`${providerKey} missing ${status.missingEnvVars.join(", ")}`);
    }
  }
  if (input.kind === "product_demo" && !input.screenshots?.length && !input.screenRecordings?.length) {
    reasons.push("product_demo requires real screenshots or screen recordings; do not generate fake product UI");
  }
  if (template.approvalRequirements.length > 0) {
    reasons.push(`approval required: ${template.approvalRequirements.join("; ")}`);
  }
  return reasons;
}

function createComfyClipJobPlan(input: ProfessionalVideoProviderPlanInput, scenes: ScenePlan[]): ComfyClipJobPlan[] {
  const dimensions = dimensionsForAspectRatio(input.aspectRatio ?? "9:16");
  const negativePrompt = [
    "fake product interface",
    "fabricated dashboard text",
    "fake testimonial",
    "public figure",
    "brand logo misuse",
    "low quality",
    "distorted hands",
    "unreadable text",
  ].join(", ");

  return scenes
    .filter((scene) => scene.requiredAsset === "ai_broll" || scene.requiredAsset === "ai_image" || scene.sceneType === "hook" || scene.sceneType === "proof")
    .map((scene) => ({
      sceneOrder: scene.order,
      type: scene.sceneType === "hook" ? "short_video_frame_set" : scene.sceneType === "proof" ? "ai_broll" : "short_video_frame_set",
      workflowKey: workflowKeyForScene(input, scene),
      prompt: buildComfyPrompt(input, scene),
      negativePrompt,
      width: dimensions.width,
      height: dimensions.height,
      queueNow: false,
      reason: "Create the motion clip in ComfyUI first, then assemble it with real product captures in Remotion/FFmpeg.",
    }));
}

function workflowKeyForScene(input: ProfessionalVideoProviderPlanInput, scene: ScenePlan): ComfyClipJobPlan["workflowKey"] {
  if (scene.sceneType === "proof" && input.kind === "product_demo") {
    return "wan-i2v-broll";
  }
  if (input.kind === "ai_video" || scene.sceneType === "hook") {
    return "ltxv-fast-motion-broll";
  }
  return "wan-i2v-broll";
}

function buildComfyPrompt(input: ProfessionalVideoProviderPlanInput, scene: ScenePlan): string {
  const product = input.productOrProject;
  const style = input.kind === "product_demo" ? "premium SaaS product-adjacent b-roll" : "professional social-native AI video clip";
  return [
    `${style} for ${product}`,
    `target audience: ${input.targetAudience}`,
    `scene: ${scene.sceneType}`,
    `caption idea: ${scene.caption}`,
    `visual direction: ${scene.visualPrompt}`,
    "cinematic camera movement, real-world founder/operator context, clean modern lighting, high retention short-form pacing",
    "do not invent or show fake product UI; leave actual UI to supplied screenshots or screen recordings",
  ].join(". ");
}

function dimensionsForAspectRatio(aspectRatio: "9:16" | "16:9" | "1:1" | "4:5"): { width: number; height: number } {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

function clipKindForProvider(providerKey: VideoProviderKey): GeneratedClip["kind"] {
  if (providerKey === "avatar_provider" || providerKey === "pippit") {
    return "avatar";
  }
  if (providerKey === "remotion_ffmpeg") {
    return "assembly";
  }
  return "broll";
}

function requiredInputsForProvider(providerKey: VideoProviderKey, input: VideoProviderGenerateInput): string[] {
  if (providerKey === "remotion_ffmpeg") {
    return ["generated clips", "captions", "approved script"];
  }
  if (providerKey === "higgsfield" || providerKey === "pippit") {
    return input.productUrl ? ["product URL", "script"] : ["product URL", "script", "reference assets"];
  }
  if (providerKey === "avatar_provider") {
    return ["likeness consent", "voice consent", "script"];
  }
  return ["prompt", "reference image or generated starting frame"];
}

function requiredInputsForScene(scene: ScenePlan, input: ProfessionalVideoProviderPlanInput): string[] {
  if (scene.requiredAsset === "screen_recording") {
    return input.screenRecordings?.length ? ["screen recording"] : ["screen recording required"];
  }
  if (scene.requiredAsset === "screenshot") {
    return input.screenshots?.length ? ["screenshot"] : ["screenshot required"];
  }
  if (scene.requiredAsset === "uploaded_video") {
    return ["uploaded/consented video"];
  }
  if (scene.requiredAsset === "ai_broll" || scene.requiredAsset === "ai_image") {
    return ["prompt", "approved source facts"];
  }
  return ["approved script"];
}
