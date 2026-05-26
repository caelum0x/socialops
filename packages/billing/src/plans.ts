export type PlanKey = "free" | "student" | "pro" | "founder_freelancer" | "studio";

export type Entitlement = {
  aiDraftsPerMonth: number;
  visualGenerationsPerMonth: number;
  videoRendersPerMonth: number;
  deckExportsPerMonth: number;
  scheduledPostsPerMonth: number;
  connectedAccounts: number;
  projects: number | "unlimited";
};

export const planEntitlements: Record<PlanKey, Entitlement> = {
  free: {
    aiDraftsPerMonth: 20,
    visualGenerationsPerMonth: 0,
    videoRendersPerMonth: 0,
    deckExportsPerMonth: 0,
    scheduledPostsPerMonth: 0,
    connectedAccounts: 0,
    projects: 1,
  },
  student: {
    aiDraftsPerMonth: 100,
    visualGenerationsPerMonth: 10,
    videoRendersPerMonth: 0,
    deckExportsPerMonth: 2,
    scheduledPostsPerMonth: 25,
    connectedAccounts: 2,
    projects: 3,
  },
  pro: {
    aiDraftsPerMonth: 500,
    visualGenerationsPerMonth: 50,
    videoRendersPerMonth: 5,
    deckExportsPerMonth: 10,
    scheduledPostsPerMonth: 100,
    connectedAccounts: 6,
    projects: "unlimited",
  },
  founder_freelancer: {
    aiDraftsPerMonth: 1000,
    visualGenerationsPerMonth: 100,
    videoRendersPerMonth: 15,
    deckExportsPerMonth: 25,
    scheduledPostsPerMonth: 250,
    connectedAccounts: 12,
    projects: "unlimited",
  },
  studio: {
    aiDraftsPerMonth: 2500,
    visualGenerationsPerMonth: 250,
    videoRendersPerMonth: 50,
    deckExportsPerMonth: 75,
    scheduledPostsPerMonth: 750,
    connectedAccounts: 30,
    projects: "unlimited",
  },
};
