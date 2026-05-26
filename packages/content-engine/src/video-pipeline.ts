import type { TargetPlatformKey } from "./purpose.js";

export const localVideoKinds = ["ugc", "ai_video", "product_demo"] as const;
export type LocalVideoKind = (typeof localVideoKinds)[number];

export const localVideoPlatforms = ["x", "linkedin", "tiktok", "reddit", "instagram", "youtube_shorts"] as const;
export type LocalVideoPlatform = (typeof localVideoPlatforms)[number];

export type LocalVideoPipelineInput = {
  kind: LocalVideoKind;
  title: string;
  productOrProject: string;
  targetAudience: string;
  objective: string;
  platforms?: LocalVideoPlatform[];
  sourceFacts?: string[];
  uploadedAssetIds?: string[];
  realScreenAssetIds?: string[];
  includeAiBroll?: boolean;
  includeVoiceover?: boolean;
};

export type ProfessionalVideoProviderTarget =
  | "comfyui_wan"
  | "comfyui_ltxv"
  | "higgsfield"
  | "pippit"
  | "seedance"
  | "avatar_provider"
  | "remotion_ffmpeg";

export type LocalVideoScenePlan = {
  order: number;
  sceneType: "hook" | "problem" | "proof" | "demo" | "process" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  requiredAsset: "uploaded_video" | "screen_recording" | "screenshot" | "ai_broll" | "ai_image" | "text_card" | "none";
  visualPrompt: string;
};

export type LocalVideoAssetPlan = {
  assetType: "uploaded_video" | "screen_recording" | "screenshot" | "thumbnail" | "broll" | "caption_track" | "voiceover";
  source: "user_upload" | "product_capture" | "comfyui" | "external_ai_video" | "whisper" | "piper_or_local_tts" | "ffmpeg";
  required: boolean;
  prompt: string;
  existingAssetIds: string[];
  workflowPresetKey?: string;
  providerTargets?: ProfessionalVideoProviderTarget[];
};

export type LocalVideoDistributionVariant = {
  platform: LocalVideoPlatform;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  durationSeconds: number;
  copyAngle: string;
  postingNotes: string[];
  metricsToLearn: string[];
};

export type LocalVideoPipelinePlan = {
  kind: LocalVideoKind;
  title: string;
  purpose: string;
  engine: {
    research: "pokee";
    ai: "miniclaw";
    ranking: "x-algorithm";
    visuals: "comfyui";
    assembly: "ffmpeg" | "remotion_ffmpeg";
    publishing: "postiz_openpost_or_manual";
    providerRouter: ProfessionalVideoProviderTarget[];
  };
  creativeStandard: {
    benchmarkTools: string[];
    mustHave: string[];
    avoid: string[];
  };
  scenes: LocalVideoScenePlan[];
  assets: LocalVideoAssetPlan[];
  render: {
    templateKey: string;
    renderer: "remotion";
    postProcessor: "ffmpeg";
    outputs: Array<{ platform: LocalVideoPlatform; aspectRatio: LocalVideoDistributionVariant["aspectRatio"] }>;
  };
  distribution: LocalVideoDistributionVariant[];
  safeguards: string[];
};

const defaultPlatforms: LocalVideoPlatform[] = ["x", "linkedin", "tiktok", "reddit", "instagram", "youtube_shorts"];

function selectedPlatforms(platforms: LocalVideoPipelineInput["platforms"]): LocalVideoPlatform[] {
  return platforms && platforms.length > 0 ? platforms : defaultPlatforms;
}

function aspectRatioForPlatform(platform: LocalVideoPlatform): LocalVideoDistributionVariant["aspectRatio"] {
  if (platform === "linkedin" || platform === "reddit") {
    return "16:9";
  }
  if (platform === "x") {
    return "4:5";
  }
  return "9:16";
}

function durationForPlatform(platform: LocalVideoPlatform, kind: LocalVideoKind): number {
  if (platform === "reddit") {
    return kind === "product_demo" ? 90 : 45;
  }
  if (platform === "linkedin") {
    return kind === "product_demo" ? 75 : 50;
  }
  if (platform === "x") {
    return 45;
  }
  return 30;
}

function buildScenes(input: LocalVideoPipelineInput): LocalVideoScenePlan[] {
  const baseFact = input.sourceFacts?.[0] ?? `${input.productOrProject} has a concrete update worth showing.`;
  if (input.kind === "product_demo") {
    return [
      {
        order: 1,
        sceneType: "hook",
        durationSeconds: 4,
        narration: `Here is what ${input.productOrProject} does in practice.`,
        caption: `Watch ${input.productOrProject} in action`,
        requiredAsset: "screen_recording",
        visualPrompt: "Use a real screen recording, not generated UI.",
      },
      {
        order: 2,
        sceneType: "problem",
        durationSeconds: 8,
        narration: `The problem: ${input.objective}`,
        caption: "The problem",
        requiredAsset: "screenshot",
        visualPrompt: "Zoom into the real product area that shows the problem.",
      },
      {
        order: 3,
        sceneType: "demo",
        durationSeconds: 18,
        narration: `Show the core workflow step by step, using the actual product capture.`,
        caption: "The workflow",
        requiredAsset: "screen_recording",
        visualPrompt: "Real cursor movement and product UI capture.",
      },
      {
        order: 4,
        sceneType: "proof",
        durationSeconds: 10,
        narration: baseFact,
        caption: "Why it matters",
        requiredAsset: input.includeAiBroll ? "ai_broll" : "text_card",
        visualPrompt: `Clean product proof visual for ${input.productOrProject}.`,
      },
      {
        order: 5,
        sceneType: "cta",
        durationSeconds: 5,
        narration: `Follow the build if you want more practical product breakdowns.`,
        caption: "Follow the build",
        requiredAsset: "text_card",
        visualPrompt: "Simple CTA card with product name and one benefit.",
      },
    ];
  }

  if (input.kind === "ugc") {
    return [
      {
        order: 1,
        sceneType: "hook",
        durationSeconds: 3,
        narration: `I tried ${input.productOrProject}, and this is the part that actually matters.`,
        caption: "The part that matters",
        requiredAsset: "uploaded_video",
        visualPrompt: "Use real UGC talking-head footage or a consented avatar provider; add fast cutaway b-roll.",
      },
      {
        order: 2,
        sceneType: "problem",
        durationSeconds: 7,
        narration: input.objective,
        caption: "The old way",
        requiredAsset: input.includeAiBroll ? "ai_broll" : "text_card",
        visualPrompt: `B-roll showing the frustrating before-state for ${input.targetAudience}.`,
      },
      {
        order: 3,
        sceneType: "proof",
        durationSeconds: 12,
        narration: baseFact,
        caption: "What changed",
        requiredAsset: input.uploadedAssetIds?.length ? "uploaded_video" : "ai_broll",
        visualPrompt: `Authentic UGC proof visual for ${input.productOrProject}; generate product-adjacent b-roll, not fake testimonial proof.`,
      },
      {
        order: 4,
        sceneType: "payoff",
        durationSeconds: 6,
        narration: `That is why I would use it again.`,
        caption: "Why I would use it again",
        requiredAsset: "text_card",
        visualPrompt: "Simple payoff card with one concrete benefit.",
      },
    ];
  }

  return [
    {
      order: 1,
      sceneType: "hook",
      durationSeconds: 4,
      narration: `This is how ${input.productOrProject} turns work into content.`,
      caption: "Turn work into content",
      requiredAsset: "ai_image",
      visualPrompt: `High-contrast opening visual for ${input.productOrProject}.`,
    },
    {
      order: 2,
      sceneType: "process",
      durationSeconds: 8,
      narration: `Start with the real work, then turn it into a script, visual, and post.`,
      caption: "Work -> script -> video",
      requiredAsset: "ai_broll",
      visualPrompt: "AI b-roll showing content workflow steps.",
    },
    {
      order: 3,
      sceneType: "proof",
      durationSeconds: 10,
      narration: baseFact,
      caption: "The proof",
      requiredAsset: input.realScreenAssetIds?.length ? "screenshot" : "ai_image",
      visualPrompt: `Proof-oriented visual for ${input.productOrProject}.`,
    },
    {
      order: 4,
      sceneType: "cta",
      durationSeconds: 5,
      narration: `Save this if you are building in public.`,
      caption: "Save this workflow",
      requiredAsset: "text_card",
      visualPrompt: "Clean final CTA card.",
    },
  ];
}

function buildAssets(input: LocalVideoPipelineInput, scenes: LocalVideoScenePlan[]): LocalVideoAssetPlan[] {
  const requires = new Set(scenes.map((scene) => scene.requiredAsset));
  return [
    {
      assetType: "uploaded_video",
      source: "user_upload",
      required: input.kind === "ugc",
      prompt: "Upload real UGC/person/product clips. Do not fake testimonials or real people.",
      existingAssetIds: input.uploadedAssetIds ?? [],
    },
    {
      assetType: "screen_recording",
      source: "product_capture",
      required: input.kind === "product_demo" || requires.has("screen_recording"),
      prompt: "Use real product screen recordings for product videos.",
      existingAssetIds: input.realScreenAssetIds ?? [],
    },
    {
      assetType: "screenshot",
      source: "product_capture",
      required: input.kind === "product_demo" || requires.has("screenshot"),
      prompt: "Use real screenshots for product UI proof.",
      existingAssetIds: input.realScreenAssetIds ?? [],
    },
    {
      assetType: "thumbnail",
      source: "comfyui",
      required: true,
      prompt: `Generate platform-specific thumbnails for ${input.productOrProject}.`,
      existingAssetIds: [],
      workflowPresetKey: "video-thumbnail",
      providerTargets: ["remotion_ffmpeg"],
    },
    {
      assetType: "broll",
      source: "comfyui",
      required: Boolean(input.includeAiBroll) || requires.has("ai_broll") || input.kind === "ai_video",
      prompt: `Generate safe supporting b-roll for ${input.productOrProject}; do not generate fake product UI.`,
      existingAssetIds: [],
      workflowPresetKey: input.kind === "ugc" ? "wan-i2v-broll" : "ltxv-fast-motion-broll",
      providerTargets: ["comfyui_wan", "comfyui_ltxv"],
    },
    {
      assetType: "broll",
      source: "external_ai_video",
      required: false,
      prompt:
        input.kind === "product_demo"
          ? "Optional professional external pass for product-link-to-ad variants; use real product screenshots/recordings as anchors."
          : "Optional professional external pass for trend-native UGC/AI influencer variants.",
      existingAssetIds: [],
      workflowPresetKey:
        input.kind === "product_demo"
          ? "pippit-product-ugc-suite"
          : input.kind === "ugc"
            ? "higgsfield-style-trend-ad"
            : "seedance-director-i2v",
      providerTargets: input.kind === "product_demo" ? ["pippit", "higgsfield"] : input.kind === "ugc" ? ["higgsfield", "pippit"] : ["seedance", "higgsfield"],
    },
    {
      assetType: "caption_track",
      source: "whisper",
      required: true,
      prompt: "Transcribe voice/audio and produce SRT/VTT/JSON captions.",
      existingAssetIds: [],
    },
    {
      assetType: "voiceover",
      source: "piper_or_local_tts",
      required: Boolean(input.includeVoiceover),
      prompt: "Generate local synthetic voiceover only when no real user voice is supplied.",
      existingAssetIds: [],
      workflowPresetKey: input.kind === "ugc" ? "consented-avatar-spokesperson" : "voiceover-audio",
      providerTargets: input.kind === "ugc" ? ["avatar_provider"] : ["remotion_ffmpeg"],
    },
  ];
}

function providerRouterFor(kind: LocalVideoKind): ProfessionalVideoProviderTarget[] {
  if (kind === "product_demo") {
    return ["pippit", "higgsfield", "comfyui_wan", "remotion_ffmpeg"];
  }
  if (kind === "ugc") {
    return ["higgsfield", "pippit", "avatar_provider", "comfyui_wan", "remotion_ffmpeg"];
  }
  return ["seedance", "higgsfield", "comfyui_wan", "comfyui_ltxv", "remotion_ffmpeg"];
}

function creativeStandardFor(kind: LocalVideoKind): LocalVideoPipelinePlan["creativeStandard"] {
  const shared = {
    benchmarkTools: ["Higgsfield", "Pippit", "Dreamina Seedance 2.0", "ComfyUI Wan/LTXV", "Remotion/FFmpeg"],
    avoid: [
      "single-card slideshow videos",
      "fake product UI",
      "fake testimonials",
      "unconsented likeness or voice cloning",
      "generic stock-like b-roll with no product angle",
    ],
  };

  if (kind === "product_demo") {
    return {
      ...shared,
      mustHave: [
        "real product screenshots or screen recordings",
        "cursor/camera zooms tied to real UI moments",
        "generated b-roll only as support",
        "captioned platform crops",
        "manual approval before publishing",
      ],
    };
  }

  if (kind === "ugc") {
    return {
      ...shared,
      mustHave: [
        "first-second human or avatar hook",
        "trend-native pacing and jump cuts",
        "product-aware cutaways",
        "caption styling with safe mobile margins",
        "consent records for any real or avatar likeness",
      ],
    };
  }

  return {
    ...shared,
    mustHave: [
      "image-to-video or text-to-video clips, not only text cards",
      "shot rhythm and camera motion per scene",
      "consistent visual motif or character across clips",
      "source-backed claims from Pokee",
      "final edit assembled with captions, crop, and sound",
    ],
  };
}

function copyAngleFor(platform: LocalVideoPlatform, kind: LocalVideoKind): string {
  if (platform === "reddit") {
    return kind === "product_demo" ? "transparent build/demo post with specific lessons" : "discussion-first post with no hype";
  }
  if (platform === "linkedin") {
    return "professional lesson, proof, and practical takeaway";
  }
  if (platform === "x") {
    return "sharp hook, concise build proof, and reply-worthy angle";
  }
  return "fast hook, captioned visual payoff, and simple CTA";
}

function buildDistribution(input: LocalVideoPipelineInput): LocalVideoDistributionVariant[] {
  return selectedPlatforms(input.platforms).map((platform) => ({
    platform,
    aspectRatio: aspectRatioForPlatform(platform),
    durationSeconds: durationForPlatform(platform, input.kind),
    copyAngle: copyAngleFor(platform, input.kind),
    postingNotes:
      platform === "reddit"
        ? ["Pick a relevant subreddit.", "Lead with context and lesson.", "Avoid drive-by promotion."]
        : ["Use connected Postiz/OpenPost account where available.", "Adapt hook and caption to native platform behavior."],
    metricsToLearn:
      platform === "tiktok" || platform === "instagram" || platform === "youtube_shorts"
        ? ["views", "watch_time", "completion_rate", "shares", "saves"]
        : ["impressions", "replies", "comments", "reposts", "clicks"],
  }));
}

function templateKeyFor(kind: LocalVideoKind): string {
  if (kind === "product_demo") {
    return "product-demo";
  }
  if (kind === "ugc") {
    return "ugc-short";
  }
  return "ai-content-short";
}

export function createLocalVideoPipelinePlan(input: LocalVideoPipelineInput): LocalVideoPipelinePlan {
  const scenes = buildScenes(input);
  const distribution = buildDistribution(input);
  return {
    kind: input.kind,
    title: input.title,
    purpose: `${input.kind} pipeline for ${input.productOrProject}: ${input.objective}`,
    engine: {
      research: "pokee",
      ai: "miniclaw",
      ranking: "x-algorithm",
      visuals: "comfyui",
      assembly: "remotion_ffmpeg",
      publishing: "postiz_openpost_or_manual",
      providerRouter: providerRouterFor(input.kind),
    },
    creativeStandard: creativeStandardFor(input.kind),
    scenes,
    assets: buildAssets(input, scenes),
    render: {
      templateKey: templateKeyFor(input.kind),
      renderer: "remotion",
      postProcessor: "ffmpeg",
      outputs: distribution.map((variant) => ({
        platform: variant.platform,
        aspectRatio: variant.aspectRatio,
      })),
    },
    distribution,
    safeguards: [
      "Use real screen recordings or screenshots for product UI.",
      "Use uploaded/consented people footage for UGC.",
      "Do not clone voices, impersonate people, fake testimonials, or fabricate product results.",
      "Use official posting APIs/services or manual upload; do not browser-bot platforms.",
      "Optimize for learning and reach, but do not claim guaranteed virality.",
    ],
  };
}

export function createDefaultLocalVideoPlans(productOrProject = "SocialOps"): LocalVideoPipelinePlan[] {
  const base = {
    productOrProject,
    targetAudience: "builders and creators",
    objective: "Show the product clearly, create useful social-native clips, and learn from performance.",
    platforms: defaultPlatforms,
    includeAiBroll: true,
    includeVoiceover: true,
  } satisfies Omit<LocalVideoPipelineInput, "kind" | "title">;

  return [
    createLocalVideoPipelinePlan({
      ...base,
      kind: "ugc",
      title: `${productOrProject} UGC short`,
    }),
    createLocalVideoPipelinePlan({
      ...base,
      kind: "ai_video",
      title: `${productOrProject} AI content video`,
    }),
    createLocalVideoPipelinePlan({
      ...base,
      kind: "product_demo",
      title: `${productOrProject} product demo`,
    }),
  ];
}

export function toTargetPlatformKey(platform: LocalVideoPlatform): TargetPlatformKey {
  return platform;
}
