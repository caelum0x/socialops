export const socialOpsPurpose =
  "Local AI video and content operating system for planning, generating, ranking, posting, and analyzing multi-platform social content.";

export const connectedFoundations = [
  {
    key: "pokee",
    name: "PokeeResearchOSS",
    role: "Search, source discovery, page reading, citations, and claim validation.",
  },
  {
    key: "claw",
    name: "MiniClaw/OpenClaw",
    role: "AI assistant control plane for capture, ideation, drafting, rewriting, and campaign operations.",
  },
  {
    key: "comfyui",
    name: "ComfyUI",
    role: "Internal visuals and video asset generation through SocialOps-owned workers and approved workflows.",
  },
  {
    key: "comfyui_extensions",
    name: "ComfyUI extensions",
    role: "Vetted custom nodes and workflow capabilities for images, thumbnails, b-roll, and video assets.",
  },
  {
    key: "x_algorithm",
    name: "x-algorithm",
    role: "Ranking, scoring, candidate selection, and learning loop for X-style content performance.",
  },
  {
    key: "postiz",
    name: "Postiz",
    role: "Posting, publishing, scheduling, and platform account operations where it supports the target platform.",
  },
  {
    key: "openpost",
    name: "OpenPost",
    role: "Existing scheduler/account/composer foundation available where its integrations are useful.",
  },
] as const;

export const targetPlatforms = [
  {
    key: "x",
    label: "X",
    outputs: ["posts", "threads", "short clips", "reply-safe drafts"],
    accountScope: "multiple X accounts",
    optimizationSignals: ["hook strength", "reply potential", "repost potential", "topic fit", "freshness"],
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    outputs: ["professional posts", "carousels", "native videos", "project updates"],
    accountScope: "personal and page accounts",
    optimizationSignals: ["career proof", "specific lesson", "authority", "saves/comments potential"],
  },
  {
    key: "tiktok",
    label: "TikTok",
    outputs: ["short scripts", "captioned videos", "hooks", "thumbnail prompts"],
    accountScope: "creator/business accounts",
    optimizationSignals: ["first-second hook", "watch time", "loopability", "visual novelty"],
  },
  {
    key: "reddit",
    label: "Reddit",
    outputs: ["subreddit-specific posts", "discussion starters", "transparent build logs"],
    accountScope: "approved Reddit accounts",
    optimizationSignals: ["community fit", "non-promotional framing", "specificity", "comment depth"],
  },
  {
    key: "instagram",
    label: "Instagram",
    outputs: ["reels", "carousel copy", "visual posts", "story prompts"],
    accountScope: "creator/business accounts",
    optimizationSignals: ["visual clarity", "shareability", "save value", "caption strength"],
  },
  {
    key: "youtube_shorts",
    label: "YouTube Shorts",
    outputs: ["short scripts", "captioned videos", "titles", "thumbnail prompts"],
    accountScope: "channel accounts",
    optimizationSignals: ["retention", "searchable title", "clear payoff", "series potential"],
  },
] as const;

export type TargetPlatformKey = (typeof targetPlatforms)[number]["key"];

export const contentEngineWorkflow = [
  {
    step: "capture",
    owner: "SocialOps API",
    description: "Collect work logs, project updates, screenshots, links, metrics, and ideas.",
  },
  {
    step: "research",
    owner: "PokeeResearchOSS",
    description: "Find sources, read pages, create citation-backed briefs, and mark unsupported claims.",
  },
  {
    step: "draft",
    owner: "MiniClaw/OpenClaw",
    description: "Generate platform-specific copy, scripts, threads, hooks, and variants from real source material.",
  },
  {
    step: "rank",
    owner: "x-algorithm",
    description: "Score candidates by topic fit, freshness, quality, engagement signals, media, novelty, and risk.",
  },
  {
    step: "generate_media",
    owner: "ComfyUI + visual/video workers",
    description: "Create thumbnails, images, b-roll, captioned videos, and visual variants through approved workflows.",
  },
  {
    step: "schedule_or_post",
    owner: "Postiz/OpenPost/manual connectors",
    description: "Plan and publish through connected accounts and official platform-supported flows.",
  },
  {
    step: "analyze",
    owner: "SocialOps + x-algorithm",
    description: "Record metrics, learn from platform outcomes, and improve future candidate ranking.",
  },
] as const;

export type ContentEnginePlanInput = {
  platforms?: TargetPlatformKey[];
  accountCountByPlatform?: Partial<Record<TargetPlatformKey, number>>;
  includeVideo?: boolean;
  includeVisuals?: boolean;
  objective?: string;
};

export function createContentEnginePlan(input: ContentEnginePlanInput = {}) {
  const selectedPlatforms =
    input.platforms && input.platforms.length > 0
      ? targetPlatforms.filter((platform) => input.platforms?.includes(platform.key))
      : targetPlatforms;

  return {
    purpose: socialOpsPurpose,
    objective: input.objective || "Grow Arhan's distribution across X, LinkedIn, TikTok, Reddit, and other social platforms.",
    foundations: connectedFoundations,
    platforms: selectedPlatforms.map((platform) => ({
      ...platform,
      configuredAccountCount: input.accountCountByPlatform?.[platform.key] ?? 0,
      needsAccountConnection: (input.accountCountByPlatform?.[platform.key] ?? 0) === 0,
    })),
    workflow: contentEngineWorkflow.filter((step) => {
      if (!input.includeVideo && step.step === "generate_media") {
        return input.includeVisuals ?? true;
      }
      return true;
    }),
    automationModel: {
      planning: "automated",
      generation: "automated",
      ranking: "automated",
      scheduling: "automated when a connected service and platform policy support it",
      analytics: "automated where APIs exist, manual import otherwise",
    },
    constraints: [
      "Use connected accounts and official platform/API-supported posting paths.",
      "Do not use spam automation, fake engagement, credential scraping, or browser-based bot posting.",
      "Use metrics to optimize hooks, formats, timing, and topics; do not promise guaranteed virality.",
    ],
  };
}
