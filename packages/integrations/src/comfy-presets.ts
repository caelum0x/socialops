export const comfyMediaKinds = ["image", "video", "audio", "voice", "text_visual"] as const;

export type ComfyMediaKind = (typeof comfyMediaKinds)[number];

export type ComfyWorkflowPreset = {
  key: string;
  title: string;
  mediaKind: ComfyMediaKind;
  outputTypes: string[];
  useCases: string[];
  requiresCustomNodes: boolean;
  runtimeClass: "local_light" | "gpu_required" | "external_required";
  professionalTier?: "assembly" | "ugc" | "ai_influencer" | "cinematic" | "product_demo";
  providerHints?: string[];
  notes: string;
};

export type SocialOpsMediaRuntimeProfile = "macbook_local" | "gpu_local" | "cloud_gpu";

export const comfyWorkflowPresets: ComfyWorkflowPreset[] = [
  {
    key: "linkedin-carousel-background",
    title: "LinkedIn carousel background",
    mediaKind: "image",
    outputTypes: ["png", "webp"],
    useCases: ["carousel", "linkedin", "portfolio"],
    requiresCustomNodes: false,
    runtimeClass: "local_light",
    notes: "Background or cover image for text-first career/project carousel posts.",
  },
  {
    key: "x-post-visual",
    title: "X post visual",
    mediaKind: "image",
    outputTypes: ["png", "webp"],
    useCases: ["x", "project_update", "build_log"],
    requiresCustomNodes: false,
    runtimeClass: "local_light",
    notes: "Compact visual for build updates, quote cards, and product screenshots.",
  },
  {
    key: "short-video-frame-set",
    title: "Short-form video frame set",
    mediaKind: "video",
    outputTypes: ["mp4", "png_sequence"],
    useCases: ["tiktok", "reels", "youtube_shorts"],
    requiresCustomNodes: true,
    runtimeClass: "gpu_required",
    notes: "Frame or video generation for short-form scripts; exact nodes depend on the installed video model stack.",
  },
  {
    key: "wan-i2v-broll",
    title: "Wan image-to-video b-roll",
    mediaKind: "video",
    outputTypes: ["mp4", "png_sequence"],
    useCases: ["ai_video", "ugc", "reels", "youtube_shorts", "product_atmosphere"],
    requiresCustomNodes: true,
    runtimeClass: "gpu_required",
    professionalTier: "cinematic",
    providerHints: ["ComfyUI Wan image-to-video", "first/last frame control", "camera motion prompts"],
    notes:
      "Local ComfyUI b-roll workflow for short motion inserts. Use it for atmosphere, transitions, and product-adjacent shots, not fake product UI.",
  },
  {
    key: "ltxv-fast-motion-broll",
    title: "LTXV fast motion b-roll",
    mediaKind: "video",
    outputTypes: ["mp4", "png_sequence"],
    useCases: ["ai_video", "iteration", "hook_testing", "social_broll"],
    requiresCustomNodes: true,
    runtimeClass: "gpu_required",
    professionalTier: "cinematic",
    providerHints: ["ComfyUI LTXV", "fast image-to-video iteration", "motion concept testing"],
    notes:
      "Fast local motion generation for testing hooks and visual directions before spending credits on higher-end external models.",
  },
  {
    key: "higgsfield-style-trend-ad",
    title: "Higgsfield-style trend ad adapter",
    mediaKind: "video",
    outputTypes: ["mp4"],
    useCases: ["ugc", "paid_ad", "trend_recreation", "product_url_to_video"],
    requiresCustomNodes: false,
    runtimeClass: "external_required",
    professionalTier: "ugc",
    providerHints: ["Higgsfield Marketing Studio", "viral presets", "product URL to ad", "hook score"],
    notes:
      "External-adapter target for professional social-native UGC structures: trend preset, hook rhythm, camera logic, product URL analysis, and variation generation.",
  },
  {
    key: "pippit-product-ugc-suite",
    title: "Pippit-style product UGC suite",
    mediaKind: "video",
    outputTypes: ["mp4"],
    useCases: ["ugc", "product_demo", "ai_influencer", "commerce_video", "publisher_handoff"],
    requiresCustomNodes: false,
    runtimeClass: "external_required",
    professionalTier: "ugc",
    providerHints: ["Pippit", "product link to video", "custom avatar", "smart crop", "auto publisher"],
    notes:
      "External-adapter target for all-in-one UGC/product video creation: product link intake, avatar voiceover, quick edit, smart crop, export, and publish handoff.",
  },
  {
    key: "seedance-director-i2v",
    title: "Seedance director image-to-video",
    mediaKind: "video",
    outputTypes: ["mp4"],
    useCases: ["ai_influencer", "high_motion", "native_tiktok", "multi_scene_story"],
    requiresCustomNodes: false,
    runtimeClass: "external_required",
    professionalTier: "cinematic",
    providerHints: ["Dreamina Seedance 2.0", "TikTok Symphony", "consistent character", "high-motion native styles"],
    notes:
      "External-adapter target for high-motion, platform-native video where character and brand consistency matter across scenes.",
  },
  {
    key: "consented-avatar-spokesperson",
    title: "Consented avatar spokesperson",
    mediaKind: "video",
    outputTypes: ["mp4", "wav", "srt"],
    useCases: ["ai_influencer", "ugc", "product_intro", "explainer"],
    requiresCustomNodes: true,
    runtimeClass: "external_required",
    professionalTier: "ai_influencer",
    providerHints: ["avatar provider", "ElevenLabs or consented voice", "lip sync", "caption export"],
    notes:
      "Avatar/talking-head workflow. Requires explicit consent for likeness and voice. Never use it for fake testimonials or impersonation.",
  },
  {
    key: "voiceover-audio",
    title: "Voiceover audio",
    mediaKind: "voice",
    outputTypes: ["wav", "mp3"],
    useCases: ["shorts", "reels", "demo_video"],
    requiresCustomNodes: true,
    runtimeClass: "external_required",
    notes: "Voice track generation for approved scripts; keep consent and voice-cloning policy checks outside ComfyUI.",
  },
  {
    key: "podcast-clip-audio",
    title: "Podcast or narration audio",
    mediaKind: "audio",
    outputTypes: ["wav", "mp3"],
    useCases: ["newsletter", "creator", "career_story"],
    requiresCustomNodes: true,
    runtimeClass: "external_required",
    notes: "Audio generation or cleanup for narrated content and clips.",
  },
  {
    key: "caption-card-text-visual",
    title: "Caption card text visual",
    mediaKind: "text_visual",
    outputTypes: ["png", "webp"],
    useCases: ["instagram", "linkedin", "x"],
    requiresCustomNodes: false,
    runtimeClass: "local_light",
    notes: "Rendered text-as-image cards; long-form draft writing still belongs to MiniClaw/LLM generation.",
  },
  {
    key: "video-thumbnail",
    title: "Video thumbnail",
    mediaKind: "image",
    outputTypes: ["png", "webp"],
    useCases: ["tiktok", "youtube_shorts", "reels"],
    requiresCustomNodes: false,
    runtimeClass: "local_light",
    notes: "Thumbnail generation for approved video scripts.",
  },
];

export function getComfyWorkflowPreset(key: string): ComfyWorkflowPreset | undefined {
  return comfyWorkflowPresets.find((preset) => preset.key === key);
}

export function inferComfyMediaKind(type: string): ComfyMediaKind {
  const normalized = type.toLowerCase();
  if (normalized.includes("voice")) {
    return "voice";
  }
  if (normalized.includes("audio") || normalized.includes("music") || normalized.includes("podcast")) {
    return "audio";
  }
  if (normalized.includes("video") || normalized.includes("short") || normalized.includes("reel")) {
    return "video";
  }
  if (normalized.includes("text") || normalized.includes("caption") || normalized.includes("quote")) {
    return "text_visual";
  }
  return "image";
}

export function canQueueComfyPreset(
  preset: ComfyWorkflowPreset,
  profile: SocialOpsMediaRuntimeProfile,
  allowHeavyMediaWorkflows = false,
): boolean {
  if (preset.runtimeClass === "local_light") {
    return true;
  }
  if (allowHeavyMediaWorkflows) {
    return true;
  }
  if (preset.runtimeClass === "gpu_required") {
    return profile === "gpu_local" || profile === "cloud_gpu";
  }
  return profile === "cloud_gpu";
}
