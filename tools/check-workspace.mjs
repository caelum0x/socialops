import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredPaths = [
  ["OpenPost scheduler", "apps/openpost/backend/internal/models/models.go"],
  ["OpenPost SocialOps migration", "apps/openpost/backend/internal/database/migrations/007_socialops_post_metadata.sql"],
  ["MiniClaw/OpenClaw fork", "apps/claw/package.json"],
  ["MiniClaw SocialOps config", "apps/claw/socialops/miniclaw.config.example.json"],
  ["SocialOps API package", "apps/api/package.json"],
  ["SocialOps API routes", "apps/api/src/routes.ts"],
  ["SocialOps web package", "apps/web/package.json"],
  ["SocialOps web entry", "apps/web/src/main.ts"],
  ["SocialOps visual worker package", "apps/visual-worker/package.json"],
  ["SocialOps visual worker entry", "apps/visual-worker/src/server.ts"],
  ["SocialOps deck worker package", "apps/deck-worker/package.json"],
  ["SocialOps deck worker entry", "apps/deck-worker/src/server.ts"],
  ["ComfyUI service checkout", "ComfyUI/main.py"],
  ["ComfyUI extension manifest", "comfyui-extensions/manifest.json"],
  ["ComfyUI official repo plan", "comfyui-extensions/OFFICIAL_REPOS.md"],
  ["Postiz reference checkout", "postiz-app/package.json"],
  ["PokeeResearch service checkout", "PokeeResearchOSS/README.md"],
  ["Core model package", "packages/core/src/models.ts"],
  ["Content engine purpose package", "packages/content-engine/src/purpose.ts"],
  ["Local video pipeline package", "packages/content-engine/src/video-pipeline.ts"],
  ["Local video content plan", "LOCAL_VIDEO_CONTENT_PLAN.md"],
  ["Core database migration", "packages/db/migrations/0001_socialops_core.sql"],
  ["Generation prompt templates", "packages/prompts/src/templates.ts"],
  ["Internal X algorithm package", "x-algorithm/src/ranking.ts"],
  ["Approval transitions", "packages/approvals/src/transitions.ts"],
  ["Billing entitlements", "packages/billing/src/plans.ts"],
  ["ComfyUI workflow presets", "packages/integrations/src/comfy-presets.ts"],
  ["ComfyUI extension types", "packages/integrations/src/comfy-extensions.ts"],
  ["ComfyUI integration client", "packages/integrations/src/comfyui.ts"],
  ["PokeeResearch integration client", "packages/integrations/src/pokee.ts"],
  ["License inventory docs", "packages/licensing/THIRD_PARTY.md"],
  ["Security policy docs", "packages/security/POLICY.md"],
  ["Production compose example", "infra/compose/socialops.production.example.yml"],
];

const requiredFileContents = [
  ["OpenPost approval gate", "apps/openpost/backend/internal/api/handlers/posts.go", "AI-generated posts must be approved before scheduling"],
  ["OpenPost SocialOps internal token", "apps/openpost/backend/internal/api/middleware/auth.go", "X-SocialOps-Internal-Token"],
  ["MiniClaw disables ClawHub", "apps/claw/socialops/miniclaw.config.example.json", "\"clawhub\": { \"enabled\": false }"],
  ["MiniClaw first-party generate skill", "apps/claw/skills/socialops-generate-draft/SKILL.md", "SocialOps"],
  ["Visual worker ComfyUI boundary", "apps/visual-worker/README.md", "only SocialOps component that talks directly to"],
];

let failed = false;

for (const [label, relativePath] of requiredPaths) {
  const absolutePath = join(root, relativePath);
  const exists = existsSync(absolutePath);
  const marker = exists ? "ok" : "missing";
  console.log(`${marker.padEnd(8)} ${label}: ${relativePath}`);
  if (!exists) {
    failed = true;
  }
}

for (const [label, relativePath, needle] of requiredFileContents) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    console.log(`missing  ${label}: ${relativePath}`);
    failed = true;
    continue;
  }
  const content = readFileSync(absolutePath, "utf8");
  const exists = content.includes(needle);
  const marker = exists ? "ok" : "missing";
  console.log(`${marker.padEnd(8)} ${label}: ${relativePath}`);
  if (!exists) {
    failed = true;
  }
}

const gitRoots = ["apps/openpost/.git", "apps/claw/.git", "ComfyUI/.git", "postiz-app/.git", "PokeeResearchOSS/.git", "x-algorithm/.git"];
for (const relativePath of gitRoots) {
  const absolutePath = join(root, relativePath);
  if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
    continue;
  }
  console.warn(`warning  expected cloned repository metadata at ${relativePath}`);
}

if (failed) {
  process.exitCode = 1;
}
