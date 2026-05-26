import type { ContentMode } from "@socialops/core/models";

export const generationGuardrails = [
  "Use only source-of-truth facts from profiles, projects, capture notes, approved claims, and research briefs.",
  "Never invent revenue, customers, degrees, employers, funding, follower counts, awards, testimonials, logos, or traction.",
  "If a required fact is missing, add it to missing_info and keep the draft in needs_missing_info.",
  "AI drafts content. Humans approve before scheduling, publishing, sending, or exporting.",
  "Do not create scraping, spam, auto-DM, browser automation, or auto cold email instructions.",
] as const;

export type PromptTemplate = {
  key: string;
  mode: ContentMode;
  label: string;
  outputTypes: string[];
  system: string;
  userFrame: string;
};

export const promptTemplates: PromptTemplate[] = [
  {
    key: "student-learning-reflection",
    mode: "student",
    label: "Learning reflection",
    outputTypes: ["linkedin_post", "x_post", "short_script"],
    system: "You help students turn real learning and projects into clear public proof without exaggeration.",
    userFrame:
      "Create a specific draft about what the user learned, what clicked, where they applied it, and why it matters for their career.",
  },
  {
    key: "internship-weekly-reflection",
    mode: "internship",
    label: "Weekly internship reflection",
    outputTypes: ["linkedin_post", "newsletter_section"],
    system: "You help interns share non-confidential work lessons in a professional, grounded voice.",
    userFrame:
      "Create a weekly reflection that avoids company secrets, names the lesson, explains why it matters, and shows growth.",
  },
  {
    key: "career-professional-lesson",
    mode: "career",
    label: "Professional lesson",
    outputTypes: ["linkedin_post", "x_post"],
    system: "You help professionals package real work lessons into useful career content.",
    userFrame:
      "Create a concise post with a clear hook, one practical lesson, one concrete example, and a grounded takeaway.",
  },
  {
    key: "builder-project-update",
    mode: "builder",
    label: "Project update",
    outputTypes: ["linkedin_post", "x_thread", "demo_script"],
    system: "You help builders explain what they are making, why it is hard, and what changed.",
    userFrame:
      "Create a build update that covers progress, hard parts, decisions, next step, and the source notes used.",
  },
  {
    key: "founder-startup-update",
    mode: "founder",
    label: "Startup update",
    outputTypes: ["linkedin_post", "x_thread", "investor_update"],
    system: "You help founders communicate product progress and market learning without fake traction.",
    userFrame:
      "Create a founder update with the product problem, what changed this week, what was learned, and what is next.",
  },
  {
    key: "freelancer-case-study",
    mode: "freelancer",
    label: "Client/process proof",
    outputTypes: ["linkedin_post", "portfolio_update", "outreach_email"],
    system: "You help freelancers turn real work process into trust-building content and outreach drafts.",
    userFrame:
      "Create a draft that explains the problem, process, result or current progress, and why a client should care.",
  },
  {
    key: "creator-short-script",
    mode: "creator",
    label: "Short-form script",
    outputTypes: ["tiktok_script", "reels_script", "youtube_shorts_script"],
    system: "You help creators turn ideas and lessons into short, specific scripts with strong hooks.",
    userFrame:
      "Create a hook, body, and CTA. Keep it spoken, tight, and based on the user's actual work or learning.",
  },
  {
    key: "job-search-proof-post",
    mode: "job_search",
    label: "Job-search proof post",
    outputTypes: ["linkedin_post", "portfolio_update"],
    system: "You help job seekers show proof of skill through projects and learning, not generic motivation.",
    userFrame:
      "Create a draft that connects a project or lesson to the target role and includes a clear opportunity signal.",
  },
  {
    key: "project-progress-update",
    mode: "project",
    label: "Project progress update",
    outputTypes: ["linkedin_post", "x_post", "portfolio_update"],
    system: "You help users document a project in public with useful context, progress, and next steps.",
    userFrame:
      "Create a project update from the latest capture notes and approved project claims.",
  },
  {
    key: "agency-client-update",
    mode: "agency",
    label: "Agency/client update",
    outputTypes: ["linkedin_post", "client_update", "case_study"],
    system: "You help agencies turn client-safe work into clear public proof and private update drafts.",
    userFrame:
      "Create a draft that shows progress and process while avoiding confidential client details unless approved.",
  },
];
