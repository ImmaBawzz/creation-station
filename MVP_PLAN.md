# Content Pipeline MVP Plan

## Objective

Build a working local-first content pipeline that lets a creator move one content idea from capture through brief, draft, publishing preparation, published status, manual performance metrics, and manual monetization tracking.

## MVP User Flow

1. Add a content idea with title, core idea, audience, format, primary platform, and tags.
2. Create or update a structured brief with objective, angle, promise, outline, CTA, keywords, and notes.
3. Add an editable draft version.
4. Prepare a publishing target with platform, caption, hashtags, checklist, and optional schedule date.
5. Mark the content as published with a publish URL and published date.
6. Record basic performance metrics: views, likes, comments, shares, saves, clicks.
7. Connect the content to a monetization method with offer/link, expected value, actual revenue, currency, and notes.

## MVP Data Defaults

- Default content status: `IDEA`.
- Default format: `SHORT_VIDEO`.
- Default platform: `YOUTUBE`.
- Default currency: `USD`.
- Revenue values are stored as cents.
- Publishing targets are manual records only.

## Acceptance Criteria

- `/content` renders in the app navigation.
- A user can create a content item from the `/content` page.
- A user can save a brief and see content status move to `BRIEFED`.
- A user can save a draft and see content status move to `DRAFTING` or `EDITING`.
- A user can prepare a publishing target and see status move to `READY_TO_PUBLISH`.
- A user can mark content published and see status move to `PUBLISHED`.
- A user can record metrics and monetization data.
- Backup export includes all content pipeline records.
- Existing idea/factory/task workflows continue to pass tests.

## Out Of Scope

- AI-assisted writing.
- Direct publishing.
- Imported analytics.
- Payment processing.
- Affiliate API integration.
- Cloud sync or team accounts.
