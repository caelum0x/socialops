import { planEntitlements } from "@socialops/billing/plans";

import { loadConfig } from "./config.js";
import { createDb, runCoreMigration } from "./db.js";

const db = createDb(loadConfig().databaseUrl);

try {
  await runCoreMigration(db);

  await db.tx(async (client) => {
    const user = await client.query(
      `
        INSERT INTO users (email, name, timezone)
        VALUES ('dev@socialops.local', 'SocialOps Dev', 'Europe/Istanbul')
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `,
    );
    const userId = user.rows[0].id;

    const workspace = await client.query(
      `
        INSERT INTO workspaces (owner_user_id, name, type, plan)
        VALUES ($1, 'SocialOps Demo', 'personal', 'pro')
        RETURNING id
      `,
      [userId],
    );
    const workspaceId = workspace.rows[0].id;

    await client.query(
      `
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (workspace_id, user_id) DO NOTHING
      `,
      [workspaceId, userId],
    );

    const entitlement = planEntitlements.pro;
    await client.query(
      `
        INSERT INTO entitlements (
          workspace_id,
          plan,
          ai_drafts_per_month,
          visual_generations_per_month,
          video_renders_per_month,
          deck_exports_per_month,
          scheduled_posts_per_month,
          connected_accounts,
          granted_by_user_id
        )
        VALUES ($1, 'pro', $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        workspaceId,
        entitlement.aiDraftsPerMonth,
        entitlement.visualGenerationsPerMonth,
        entitlement.videoRendersPerMonth,
        entitlement.deckExportsPerMonth,
        entitlement.scheduledPostsPerMonth,
        entitlement.connectedAccounts,
        userId,
      ],
    );

    for (const project of [
      { name: "VCPeer", slug: "vcpeer", type: "startup" },
      { name: "Recoder", slug: "recoder", type: "startup" },
      { name: "Career Profile", slug: "career-profile", type: "career" },
      { name: "SocialOps", slug: "socialops", type: "startup" },
    ]) {
      await client.query(
        `
          INSERT INTO projects (workspace_id, name, slug, type, description, stage)
          VALUES ($1, $2, $3, $4, '', 'active')
          ON CONFLICT (workspace_id, slug) DO NOTHING
        `,
        [workspaceId, project.name, project.slug, project.type],
      );
    }

    console.log(`Seeded workspace ${workspaceId} for user ${userId}`);
  });
} finally {
  await db.close();
}
