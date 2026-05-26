import type { ContentStatus } from "@socialops/core/models";

export const allowedContentTransitions: Record<ContentStatus, ContentStatus[]> = {
  idea: ["draft", "archived"],
  draft: ["needs_review", "approved", "rejected", "archived"],
  needs_review: ["approved", "rejected", "archived"],
  approved: ["scheduled", "manually_published", "published", "archived"],
  scheduled: ["published", "failed", "archived"],
  published: ["archived"],
  manually_published: ["archived"],
  rejected: ["draft", "archived"],
  failed: ["approved", "scheduled", "archived"],
  archived: [],
};

export function canTransitionContent(from: ContentStatus, to: ContentStatus): boolean {
  return allowedContentTransitions[from]?.includes(to) ?? false;
}
