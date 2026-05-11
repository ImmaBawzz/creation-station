-- Add the local-first content pipeline MVP.
-- These tables are additive and do not modify existing Idea, FactoryPlan, or Task data.

CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "coreIdea" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT 'SHORT_VIDEO',
    "primaryPlatform" TEXT NOT NULL DEFAULT 'YOUTUBE',
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "tags" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "angle" TEXT NOT NULL DEFAULT '',
    "promise" TEXT NOT NULL DEFAULT '',
    "outline" TEXT NOT NULL DEFAULT '',
    "cta" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentBrief_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentDraft_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PublishingTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "checklist" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PREP',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "publishUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublishingTarget_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ContentMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentMetric_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MonetizationLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "offerName" TEXT NOT NULL DEFAULT '',
    "offerUrl" TEXT NOT NULL DEFAULT '',
    "expectedValueCents" INTEGER NOT NULL DEFAULT 0,
    "actualRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonetizationLink_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ContentItem_status_idx" ON "ContentItem"("status");
CREATE INDEX "ContentItem_primaryPlatform_idx" ON "ContentItem"("primaryPlatform");
CREATE INDEX "ContentItem_createdAt_idx" ON "ContentItem"("createdAt");

CREATE UNIQUE INDEX "ContentBrief_contentItemId_key" ON "ContentBrief"("contentItemId");

CREATE INDEX "ContentDraft_contentItemId_idx" ON "ContentDraft"("contentItemId");
CREATE INDEX "ContentDraft_status_idx" ON "ContentDraft"("status");

CREATE INDEX "PublishingTarget_contentItemId_idx" ON "PublishingTarget"("contentItemId");
CREATE INDEX "PublishingTarget_platform_idx" ON "PublishingTarget"("platform");
CREATE INDEX "PublishingTarget_status_idx" ON "PublishingTarget"("status");

CREATE INDEX "ContentMetric_contentItemId_idx" ON "ContentMetric"("contentItemId");
CREATE INDEX "ContentMetric_platform_idx" ON "ContentMetric"("platform");
CREATE INDEX "ContentMetric_capturedAt_idx" ON "ContentMetric"("capturedAt");

CREATE INDEX "MonetizationLink_contentItemId_idx" ON "MonetizationLink"("contentItemId");
CREATE INDEX "MonetizationLink_method_idx" ON "MonetizationLink"("method");
