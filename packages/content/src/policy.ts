import type { ContentStatus } from "@socialops/core/models";

export function canScheduleContent(status: ContentStatus): boolean {
  return status === "approved";
}

export function canPublishContent(status: ContentStatus): boolean {
  return status === "approved" || status === "scheduled";
}

export function canMarkManuallyPublished(status: ContentStatus): boolean {
  return status === "approved" || status === "scheduled";
}

export const blockedAutomation = [
  "linkedin_scraping",
  "browser_auto_posting",
  "auto_dm",
  "auto_cold_email",
  "fake_metrics",
  "fake_claims",
] as const;
