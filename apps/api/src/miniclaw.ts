export type MiniClawSkillInput = Record<string, unknown>;
export type MiniClawSkillOutput = Record<string, unknown>;

export type MiniClawProductDemoScene = {
  order: number;
  url: string;
  action_description: string;
  narration: string;
  caption: string;
  duration_seconds: number;
  zoom_target_json?: Record<string, unknown>;
};

export type MiniClawClient = {
  /** Generic skill call. */
  runSkill: (skillKey: string, input: MiniClawSkillInput) => Promise<MiniClawSkillOutput>;
  /** Convenience wrapper: plan a product demo into scenes. */
  planProductDemoScenes: (input: {
    product_name: string;
    product_url: string;
    goal: string;
    target_audience: string;
    platform: string;
  }) => Promise<MiniClawProductDemoScene[]>;
};

const FIRST_PARTY_SKILL_ALLOWLIST = new Set([
  "capture_note",
  "generate_linkedin_post",
  "generate_x_post",
  "generate_x_thread",
  "generate_tiktok_script",
  "generate_carousel_copy",
  "generate_application_answer",
  "generate_pitch_deck",
  "generate_outreach_draft",
  "generate_visual_prompt",
  "generate_video_script",
  "summarize_week",
  "create_content_calendar",
  "suggest_replies",
  "create_follow_up",
  "update_crm_lead",
  "plan_product_demo_scenes",
  "plan_people_video_edits",
]);

export function createMiniClawClient(baseUrl: string): MiniClawClient {
  const normalizedBaseUrl = baseUrl.replace(/\/$/u, "");

  async function runSkill(skillKey: string, input: MiniClawSkillInput): Promise<MiniClawSkillOutput> {
    if (!FIRST_PARTY_SKILL_ALLOWLIST.has(skillKey)) {
      throw new Error(`miniclaw skill not allowlisted: ${skillKey}`);
    }
    const response = await fetch(`${normalizedBaseUrl}/skills/${encodeURIComponent(skillKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
    });
    if (!response.ok) {
      throw new Error(`miniclaw skill ${skillKey} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as MiniClawSkillOutput;
  }

  return {
    runSkill,
    async planProductDemoScenes(input) {
      const result = await runSkill("plan_product_demo_scenes", input);
      if (!result || !Array.isArray((result as { scenes?: unknown }).scenes)) {
        throw new Error("miniclaw plan_product_demo_scenes returned no scenes");
      }
      return (result as { scenes: MiniClawProductDemoScene[] }).scenes;
    },
  };
}
