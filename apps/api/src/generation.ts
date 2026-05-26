import type { ContentChannel, ContentMode } from "@socialops/core/models";
import { generationGuardrails, promptTemplates } from "@socialops/prompts/templates";

export type GenerationNote = {
  id: string;
  type: string;
  content: string;
  created_at?: string;
};

export type GenerationProject = {
  id: string;
  name: string;
  type: string;
  description: string;
  stage: string;
  approved_claims_json?: string[];
  forbidden_claims_json?: string[];
  content_pillars_json?: string[];
};

export type GenerationPersonalProfile = {
  name?: string;
  headline?: string;
  bio?: string;
  skills_json?: string[];
  goals_json?: string[];
  tone_json?: Record<string, unknown>;
};

export type GenerationCareerProfile = {
  current_role?: string;
  target_roles_json?: string[];
  skills_to_show_json?: string[];
  achievements_json?: string[];
  content_pillars_json?: string[];
};

export type GeneratedDraft = {
  mode: ContentMode;
  channel: ContentChannel;
  type: "post" | "thread" | "script" | "carousel" | "update" | "reply" | "outreach" | "deck" | "application_answer";
  title: string;
  hook: string;
  content: string;
  target_audience: string;
  purpose: string;
  reason_this_works: string;
  suggested_visual: string;
  source_note_ids_json: string[];
  claims_used_json: string[];
  missing_info_json: string[];
  risk_notes: string;
};

export type GenerateDraftInput = {
  templateKey?: string;
  mode: ContentMode;
  channel: ContentChannel;
  type: GeneratedDraft["type"];
  targetAudience: string;
  purpose: string;
  personalProfile?: GenerationPersonalProfile | null;
  careerProfile?: GenerationCareerProfile | null;
  project?: GenerationProject | null;
  notes: GenerationNote[];
};

export type GeneratedVideoScript = {
  title: string;
  platform: "linkedin" | "x" | "tiktok" | "instagram" | "youtube_shorts" | "website";
  mode: "career" | "student" | "founder" | "creator" | "project" | "product_demo";
  hook: string;
  script: string;
  scenes_json: Array<{
    order: number;
    scene_type: "text" | "screenshot" | "screen_recording" | "ai_image" | "ai_video" | "avatar" | "b_roll" | "uploaded_media";
    narration: string;
    caption: string;
    visual_prompt?: string;
    duration_seconds: number;
  }>;
  captions_json: Array<{
    start_ms: number;
    end_ms: number;
    text: string;
  }>;
  shot_list_json: string[];
  voiceover_text: string;
};

export type GenerateVideoScriptInput = {
  platform: GeneratedVideoScript["platform"];
  mode: GeneratedVideoScript["mode"];
  videoType: "career_lesson_vertical" | "linkedin_professional_update" | "founder_weekly_update" | "product_demo" | "project_build_log";
  durationSeconds: number;
  contentDraft?: {
    title?: string;
    hook?: string;
    content: string;
    target_audience?: string;
    purpose?: string;
  } | null;
  project?: GenerationProject | null;
  notes: GenerationNote[];
};

function firstUsefulSentence(input: string): string {
  const normalized = input.trim().replace(/\s+/gu, " ");
  const sentence = normalized.split(/(?<=[.!?])\s+/u)[0] ?? normalized;
  return sentence.slice(0, 180);
}

function bulletize(items: string[], fallback: string): string {
  if (items.length === 0) {
    return fallback;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function outputLabel(channel: ContentChannel, type: GeneratedDraft["type"]): string {
  if (channel === "x" && type === "thread") {
    return "X thread";
  }
  if (channel === "youtube_shorts") {
    return "YouTube Shorts script";
  }
  return `${channel.replace("_", " ")} ${type}`;
}

export function generateDraftFromSource(input: GenerateDraftInput): GeneratedDraft {
  const template =
    promptTemplates.find((candidate) => candidate.key === input.templateKey) ??
    promptTemplates.find((candidate) => candidate.mode === input.mode);

  const projectName = input.project?.name ?? "this work";
  const noteSummaries = input.notes.map((note) => firstUsefulSentence(note.content)).filter(Boolean);
  const approvedClaims = input.project?.approved_claims_json ?? [];
  const forbiddenClaims = input.project?.forbidden_claims_json ?? [];
  const missingInfo: string[] = [];

  if (!input.personalProfile?.headline) {
    missingInfo.push("personal_profile.headline");
  }
  if (input.notes.length === 0) {
    missingInfo.push("capture_notes");
  }
  if (input.project && approvedClaims.length === 0) {
    missingInfo.push("project.approved_claims_json");
  }

  const hook =
    noteSummaries[0] ??
    (input.project ? `A quick update on ${projectName}.` : "A small work lesson worth documenting.");

  const title = `${template?.label ?? "SocialOps draft"} for ${outputLabel(input.channel, input.type)}`;
  const profileLine = input.personalProfile?.headline
    ? `${input.personalProfile.name ?? "I"}: ${input.personalProfile.headline}`
    : "Profile context is incomplete.";
  const projectLine = input.project
    ? `${input.project.name} is a ${input.project.type} project at ${input.project.stage || "an active"} stage.`
    : "No project was selected for this draft.";
  const notesBlock = bulletize(noteSummaries, "- No capture notes were selected.");
  const claimsBlock = bulletize(approvedClaims, "- No approved project claims yet.");

  const content = [
    hook,
    "",
    "Context:",
    profileLine,
    projectLine,
    "",
    "What happened:",
    notesBlock,
    "",
    "What this proves:",
    claimsBlock,
    "",
    "Takeaway:",
    template?.userFrame ?? "Turn this real work into a specific, useful public update.",
  ].join("\n");

  const riskNotes = [
    ...generationGuardrails,
    forbiddenClaims.length > 0 ? `Avoid forbidden claims: ${forbiddenClaims.join("; ")}` : "No forbidden project claims were provided.",
  ].join("\n");

  return {
    mode: input.mode,
    channel: input.channel,
    type: input.type,
    title,
    hook,
    content,
    target_audience: input.targetAudience,
    purpose: input.purpose,
    reason_this_works: "The draft is grounded in recent capture notes, project context, and approved claims.",
    suggested_visual: input.project
      ? `Create a clean ${input.channel} visual showing ${input.project.name}, one progress point, and one lesson.`
      : `Create a simple ${input.channel} visual with the main lesson and one proof point.`,
    source_note_ids_json: input.notes.map((note) => note.id),
    claims_used_json: approvedClaims,
    missing_info_json: missingInfo,
    risk_notes: riskNotes,
  };
}

export function generateVideoScriptFromSource(input: GenerateVideoScriptInput): GeneratedVideoScript {
  const durationSeconds = Math.max(15, Math.min(input.durationSeconds, 90));
  const sourceText =
    input.contentDraft?.content ??
    input.notes.map((note) => note.content).join("\n") ??
    "";
  const firstLine = firstUsefulSentence(sourceText) || "This week I turned real work into something useful.";
  const projectName = input.project?.name ?? "this project";
  const targetAudience = input.contentDraft?.target_audience || "people following the work";
  const hook =
    input.contentDraft?.hook ||
    (input.mode === "student"
      ? "Stop only saying you are motivated. Start showing proof of work."
      : input.videoType === "product_demo"
        ? `Here is what ${projectName} does in practice.`
        : firstLine);

  const scenes = buildVideoScenes({
    hook,
    firstLine,
    projectName,
    targetAudience,
    videoType: input.videoType,
    durationSeconds,
  });
  const captions = buildCaptions(scenes);
  const script = scenes.map((scene) => scene.narration).join("\n\n");

  return {
    title: input.contentDraft?.title || `${videoTypeLabel(input.videoType)} for ${input.platform.replace("_", " ")}`,
    platform: input.platform,
    mode: input.mode,
    hook,
    script,
    scenes_json: scenes,
    captions_json: captions,
    shot_list_json: scenes.map((scene) => `${scene.order}. ${scene.scene_type}: ${scene.visual_prompt ?? scene.caption}`),
    voiceover_text: script,
  };
}

function videoTypeLabel(videoType: GenerateVideoScriptInput["videoType"]): string {
  return videoType
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function buildVideoScenes(input: {
  hook: string;
  firstLine: string;
  projectName: string;
  targetAudience: string;
  videoType: GenerateVideoScriptInput["videoType"];
  durationSeconds: number;
}): GeneratedVideoScript["scenes_json"] {
  if (input.videoType === "product_demo") {
    return [
      {
        order: 1,
        scene_type: "text",
        narration: input.hook,
        caption: input.hook,
        visual_prompt: "Problem title card with clean SaaS demo style",
        duration_seconds: 5,
      },
      {
        order: 2,
        scene_type: "screen_recording",
        narration: `Open ${input.projectName} and show the first product action.`,
        caption: "Show the product action",
        visual_prompt: "Real product screen recording only",
        duration_seconds: Math.max(8, Math.floor(input.durationSeconds * 0.35)),
      },
      {
        order: 3,
        scene_type: "screenshot",
        narration: "Show the result clearly and connect it to the user's goal.",
        caption: "Show the result",
        visual_prompt: "Real product screenshot with zoom target",
        duration_seconds: Math.max(8, Math.floor(input.durationSeconds * 0.35)),
      },
      {
        order: 4,
        scene_type: "text",
        narration: `If you are ${input.targetAudience}, this is the workflow to try next.`,
        caption: "Try the workflow",
        visual_prompt: "CTA end card",
        duration_seconds: 5,
      },
    ];
  }

  return [
    {
      order: 1,
      scene_type: "text",
      narration: input.hook,
      caption: input.hook,
      visual_prompt: "High-contrast hook title card with safe mobile margins",
      duration_seconds: 4,
    },
    {
      order: 2,
      scene_type: "b_roll",
      narration: input.firstLine,
      caption: firstUsefulSentence(input.firstLine),
      visual_prompt: `Real work context for ${input.projectName}; use screenshots or approved generated background`,
      duration_seconds: Math.max(6, Math.floor(input.durationSeconds * 0.25)),
    },
    {
      order: 3,
      scene_type: "text",
      narration: `The useful part is not just what happened. It is what this proves about the work.`,
      caption: "Show what the work proves",
      visual_prompt: "Simple point card with project proof",
      duration_seconds: Math.max(6, Math.floor(input.durationSeconds * 0.25)),
    },
    {
      order: 4,
      scene_type: "uploaded_media",
      narration: `Use a real screenshot, note, or project artifact so the video feels grounded.`,
      caption: "Use real proof",
      visual_prompt: "User-uploaded artifact or product screenshot",
      duration_seconds: Math.max(6, Math.floor(input.durationSeconds * 0.25)),
    },
    {
      order: 5,
      scene_type: "text",
      narration: `Save this idea if you are building public proof from real work.`,
      caption: "Build public proof from real work",
      visual_prompt: "CTA end card",
      duration_seconds: 5,
    },
  ];
}

function buildCaptions(scenes: GeneratedVideoScript["scenes_json"]): GeneratedVideoScript["captions_json"] {
  let cursorMs = 0;
  return scenes.map((scene) => {
    const durationMs = scene.duration_seconds * 1000;
    const segment = {
      start_ms: cursorMs,
      end_ms: cursorMs + durationMs,
      text: scene.caption,
    };
    cursorMs += durationMs;
    return segment;
  });
}
