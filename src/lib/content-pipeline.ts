import {
  ContentDraftStatus,
  ContentFormat,
  ContentStatus,
  MonetizationMethod,
  PublishingPlatform,
  type ContentDraftStatus as ContentDraftStatusValue,
  type ContentFormat as ContentFormatValue,
  type ContentStatus as ContentStatusValue,
  type MonetizationMethod as MonetizationMethodValue,
  type PublishingPlatform as PublishingPlatformValue,
} from "@/generated/prisma/enums";

export const CONTENT_FORMAT_OPTIONS = Object.values(ContentFormat);
export const CONTENT_STATUS_OPTIONS = Object.values(ContentStatus);
export const CONTENT_DRAFT_STATUS_OPTIONS = Object.values(ContentDraftStatus);
export const MONETIZATION_METHOD_OPTIONS = Object.values(MonetizationMethod);
export const PUBLISHING_PLATFORM_OPTIONS = Object.values(PublishingPlatform);

export const contentFormatLabels: Record<ContentFormatValue, string> = {
  ARTICLE: "Article",
  EMAIL: "Email",
  LONG_VIDEO: "Long video",
  NEWSLETTER: "Newsletter",
  OTHER: "Other",
  PODCAST: "Podcast",
  SHORT_VIDEO: "Short video",
  SOCIAL_POST: "Social post",
  THREAD: "Thread",
};

export const contentStatusLabels: Record<ContentStatusValue, string> = {
  ARCHIVED: "Archived",
  BRIEFED: "Briefed",
  DRAFTING: "Drafting",
  EDITING: "Editing",
  IDEA: "Idea",
  PUBLISHED: "Published",
  READY_TO_PUBLISH: "Ready to publish",
  SCHEDULED: "Scheduled",
};

export const monetizationMethodLabels: Record<MonetizationMethodValue, string> = {
  AD_REVENUE: "Ad revenue",
  AFFILIATE: "Affiliate",
  DONATION: "Donation",
  LEAD_MAGNET: "Lead magnet",
  OTHER: "Other",
  PRODUCT: "Product",
  SERVICE: "Service",
  SPONSORSHIP: "Sponsorship",
};

export const publishingPlatformLabels: Record<PublishingPlatformValue, string> = {
  BLOG: "Blog",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  NEWSLETTER: "Newsletter",
  OTHER: "Other",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
};

export function cleanContentText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseEnum<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fallback: T,
): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

export function parseContentFormat(value: string): ContentFormatValue {
  return parseEnum(value, CONTENT_FORMAT_OPTIONS, "SHORT_VIDEO");
}

export function parseContentStatus(value: string): ContentStatusValue {
  return parseEnum(value, CONTENT_STATUS_OPTIONS, "IDEA");
}

export function parseDraftStatus(value: string): ContentDraftStatusValue {
  return parseEnum(value, CONTENT_DRAFT_STATUS_OPTIONS, "DRAFT");
}

export function parseMonetizationMethod(value: string): MonetizationMethodValue {
  return parseEnum(value, MONETIZATION_METHOD_OPTIONS, "OTHER");
}

export function parsePublishingPlatform(value: string): PublishingPlatformValue {
  return parseEnum(value, PUBLISHING_PLATFORM_OPTIONS, "YOUTUBE");
}

export function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function parseMoneyToCents(value: string): number {
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

export function formatCents(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    currency: currency || "USD",
    style: "currency",
  }).format(value / 100);
}

export function parseOptionalDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
