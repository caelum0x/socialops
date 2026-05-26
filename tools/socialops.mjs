#!/usr/bin/env node

const apiBaseUrl = (process.env.SOCIALOPS_API_URL ?? "http://localhost:3001").replace(/\/+$/u, "");
const userEmail = process.env.SOCIALOPS_USER_EMAIL ?? "dev@socialops.local";
const userName = process.env.SOCIALOPS_USER_NAME ?? "SocialOps Dev";

const command = process.argv[2] ?? "help";
const args = parseArgs(process.argv.slice(3));

const commands = {
  help,
  "workspace": showWorkspace,
  "status": showStatus,
  "add-identity": addIdentity,
  "add-account": addAccount,
  "capture": capture,
  "generate-posts": generatePosts,
  "rank-x": rankX,
  "approve-draft": approveDraft,
  "publish-package": publishPackage,
  "send-openpost": sendOpenPost,
  "mark-published": markPublished,
  "add-metrics": addMetrics,
  "video-from-draft": videoFromDraft,
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  help();
  process.exit(1);
}

try {
  await commands[command]();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function help() {
  console.log(`SocialOps operator CLI

Usage:
  pnpm ops workspace
  pnpm ops status
  pnpm ops add-identity --name "Arhan Builder" --platforms x,linkedin,tiktok,reddit --pillars "building in public,AI video"
  pnpm ops add-account --platform x --handle "@arhan" --identity-id <id> --publishing-status manual
  pnpm ops capture --content "Shipped a SocialOps content workflow today" --type work_log --tags socialops,build
  pnpm ops generate-posts --platforms x,linkedin,tiktok,reddit --topics "SocialOps,AI video,building in public"
  pnpm ops rank-x --topics "SocialOps,AI video"
  pnpm ops approve-draft --draft-id <id>
  pnpm ops publish-package --draft-id <id>
  pnpm ops send-openpost --draft-id <id> --openpost-workspace-id <id> --openpost-user-id <id> --openpost-account-ids <id,id>
  pnpm ops mark-published --draft-id <id>
  pnpm ops add-metrics --draft-id <id> --platform x --impressions 1200 --likes 80 --replies 10
  pnpm ops video-from-draft --draft-id <id> --platform tiktok --approve --render

Environment:
  SOCIALOPS_API_URL defaults to http://localhost:3001
  SOCIALOPS_WORKSPACE_ID is optional; first workspace is used when omitted
`);
}

async function showWorkspace() {
  const workspace = await resolveWorkspace();
  print(workspace);
}

async function showStatus() {
  const workspace = await resolveWorkspace();
  print(await api(`/v1/workspaces/${workspace.id}/operator/status`));
}

async function addIdentity() {
  const workspace = await resolveWorkspace();
  requireArg("name");
  print(
    await api(`/v1/workspaces/${workspace.id}/internet-identities`, {
      method: "POST",
      body: {
        name: args.name,
        role: args.role ?? "",
        audience: args.audience ?? "",
        positioning: args.positioning ?? "",
        content_pillars_json: csv(args.pillars),
        platform_focus_json: csv(args.platforms),
      },
    }),
  );
}

async function addAccount() {
  const workspace = await resolveWorkspace();
  requireArg("platform");
  const handle = args.handle ?? "";
  const displayName = args.name ?? handle;
  if (!handle && !displayName && !args.providerAccountId) {
    throw new Error("add-account requires --handle, --name, or --provider-account-id");
  }
  print(
    await api(`/v1/workspaces/${workspace.id}/social-accounts`, {
      method: "POST",
      body: {
        identity_id: args.identityId ?? null,
        platform: args.platform,
        provider_account_id: args.providerAccountId,
        handle,
        display_name: displayName,
        account_type: args.accountType ?? "personal",
        audience: args.audience ?? "",
        content_pillars_json: csv(args.pillars),
        posting_rules_json: args.rules ? JSON.parse(args.rules) : {},
        oauth_status: args.oauthStatus ?? "disconnected",
        publishing_status: args.publishingStatus ?? "manual",
        capabilities_json: csv(args.capabilities),
      },
    }),
  );
}

async function capture() {
  const workspace = await resolveWorkspace();
  requireArg("content");
  print(
    await api(`/v1/workspaces/${workspace.id}/capture-notes`, {
      method: "POST",
      body: {
        project_id: args.projectId ?? null,
        type: args.type ?? "work_log",
        content: args.content,
        tags_json: csv(args.tags),
        media_json: args.media ? csv(args.media) : [],
      },
    }),
  );
}

async function generatePosts() {
  const workspace = await resolveWorkspace();
  const result = await api(`/v1/workspaces/${workspace.id}/generate-content-set`, {
    method: "POST",
    body: {
      project_id: args.projectId ?? null,
      agency_client_id: args.agencyClientId ?? null,
      campaign_id: args.campaignId ?? null,
      source_note_ids: csv(args.noteIds),
      platforms: csv(args.platforms, ["x", "linkedin", "tiktok", "reddit"]),
      mode: args.mode ?? "builder",
      target_audience: args.audience ?? "",
      purpose: args.purpose ?? "Build online presence from real work.",
      preferred_topics: csv(args.topics),
      muted_topics: csv(args.mutedTopics),
      x_thread: booleanArg("xThread"),
    },
  });
  print(result);
}

async function rankX() {
  const workspace = await resolveWorkspace();
  print(
    await api(`/v1/workspaces/${workspace.id}/content-drafts/rank-x`, {
      method: "POST",
      body: {
        preferred_topics: csv(args.topics),
        muted_topics: csv(args.mutedTopics),
        preferred_channels: ["x"],
        limit: numberArg("limit", 10),
      },
    }),
  );
}

async function approveDraft() {
  const workspace = await resolveWorkspace();
  requireArg("draftId");
  print(
    await api(`/v1/workspaces/${workspace.id}/content-drafts/${args.draftId}/approval`, {
      method: "POST",
      body: { action: "approve", reviewer_note: args.note ?? "Approved from SocialOps CLI." },
    }),
  );
}

async function publishPackage() {
  const workspace = await resolveWorkspace();
  requireArg("draftId");
  print(await api(`/v1/workspaces/${workspace.id}/content-drafts/${args.draftId}/publish-package`));
}

async function sendOpenPost() {
  const workspace = await resolveWorkspace();
  requireArg("draftId");
  requireArg("openpostWorkspaceId");
  requireArg("openpostUserId");
  print(
    await api(`/v1/workspaces/${workspace.id}/content-drafts/${args.draftId}/openpost`, {
      method: "POST",
      body: {
        openpost_workspace_id: args.openpostWorkspaceId,
        openpost_user_id: args.openpostUserId,
        social_account_ids: csv(args.openpostAccountIds),
        scheduled_at: args.scheduledAt ?? null,
        random_delay_minutes: numberArg("randomDelayMinutes", 0),
      },
    }),
  );
}

async function markPublished() {
  const workspace = await resolveWorkspace();
  requireArg("draftId");
  print(
    await api(`/v1/workspaces/${workspace.id}/content-drafts/${args.draftId}/manual-publish`, {
      method: "POST",
      body: args.publishedAt ? { published_at: args.publishedAt } : {},
    }),
  );
}

async function addMetrics() {
  const workspace = await resolveWorkspace();
  requireArg("draftId");
  requireArg("platform");
  print(
    await api(`/v1/workspaces/${workspace.id}/content-drafts/${args.draftId}/metrics`, {
      method: "POST",
      body: {
        platform: args.platform,
        impressions: optionalNumber("impressions"),
        likes: optionalNumber("likes"),
        comments: optionalNumber("comments"),
        shares: optionalNumber("shares"),
        clicks: optionalNumber("clicks"),
        replies: optionalNumber("replies"),
        profile_visits: optionalNumber("profileVisits"),
        leads: optionalNumber("leads"),
      },
    }),
  );
}

async function videoFromDraft() {
  const workspace = await resolveWorkspace();
  requireArg("draftId");
  const platform = args.platform ?? "tiktok";
  const script = await api(`/v1/workspaces/${workspace.id}/videos/script`, {
    method: "POST",
    body: {
      content_draft_id: args.draftId,
      platform,
      mode: args.mode ?? "project",
      video_type: args.videoType ?? "career_lesson_vertical",
      duration_seconds: numberArg("duration", 30),
    },
  });
  let approvedScript = script;
  if (booleanArg("approve")) {
    approvedScript = await api(`/v1/workspaces/${workspace.id}/videos/scripts/${script.id}/approval`, {
      method: "POST",
      body: { action: "approve" },
    });
  }
  let job = null;
  let render = null;
  if (booleanArg("render")) {
    if (approvedScript.status !== "approved") {
      throw new Error("Use --approve before --render, or approve the script separately.");
    }
    job = await api(`/v1/workspaces/${workspace.id}/videos/jobs`, {
      method: "POST",
      body: {
        video_script_id: approvedScript.id,
        template_key: args.template ?? "career-lesson-vertical",
        render_provider: args.provider ?? "remotion",
        aspect_ratio: args.aspectRatio ?? "9:16",
      },
    });
    render = await api(`/v1/workspaces/${workspace.id}/videos/jobs/${job.id}/render`, {
      method: "POST",
      body: {},
    });
  }
  print({ script: approvedScript, job, render });
}

async function resolveWorkspace() {
  if (process.env.SOCIALOPS_WORKSPACE_ID) {
    return { id: process.env.SOCIALOPS_WORKSPACE_ID };
  }
  const workspaces = await api("/v1/workspaces");
  const workspace = workspaces[0];
  if (!workspace) {
    throw new Error("No workspace found. Run: pnpm run migrate:api && pnpm run seed:api");
  }
  return workspace;
}

async function api(path, init = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-socialops-user-email": userEmail,
      "x-socialops-user-name": userName,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const rawKey = token.slice(2);
    const key = rawKey.replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function csv(value, fallback = []) {
  if (!value) {
    return fallback;
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireArg(key) {
  if (!args[key]) {
    const flag = key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
    throw new Error(`Missing --${flag}`);
  }
}

function booleanArg(key) {
  return args[key] === "true";
}

function numberArg(key, fallback) {
  if (args[key] === undefined) {
    return fallback;
  }
  const value = Number(args[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`--${key} must be a number`);
  }
  return value;
}

function optionalNumber(key) {
  if (args[key] === undefined) {
    return undefined;
  }
  return numberArg(key, undefined);
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}
