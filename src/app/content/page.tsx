import { AppSidebar } from "@/app/components/AppSidebar";
import {
  CONTENT_DRAFT_STATUS_OPTIONS,
  CONTENT_FORMAT_OPTIONS,
  MONETIZATION_METHOD_OPTIONS,
  PUBLISHING_PLATFORM_OPTIONS,
  contentFormatLabels,
  contentStatusLabels,
  formatCents,
  monetizationMethodLabels,
  publishingPlatformLabels,
} from "@/lib/content-pipeline";
import { db } from "@/lib/db";
import { canAccessFeature } from "@/lib/feature-gating";
import {
  PRODUCTION_PACKET_DRAFT_TITLE,
  PRODUCTION_PACKET_FEATURE_ID,
} from "@/lib/production-packet";
import {
  createContentItem,
  createProductionPacket,
  createProductionTasks,
  markPublishingTargetPublished,
  recordContentMetric,
  saveContentBrief,
  saveContentDraft,
  saveMonetizationLink,
  savePublishingTarget,
} from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(value);
}

function statusClass(status: string): string {
  if (status === "PUBLISHED") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }

  if (status === "READY_TO_PUBLISH" || status === "SCHEDULED") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-100";
  }

  if (status === "DRAFTING" || status === "EDITING") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export default async function ContentPipelinePage() {
  const contentItems = await db.contentItem.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      brief: true,
      drafts: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      metrics: {
        orderBy: { capturedAt: "desc" },
        take: 3,
      },
      monetizationLinks: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      publishingTargets: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  const publishedCount = contentItems.filter((item) => item.status === "PUBLISHED").length;
  const readyCount = contentItems.filter((item) =>
    ["READY_TO_PUBLISH", "SCHEDULED"].includes(item.status),
  ).length;
  const draftCount = contentItems.filter((item) =>
    ["DRAFTING", "EDITING"].includes(item.status),
  ).length;
  const canUseProductionPacket = canAccessFeature(PRODUCTION_PACKET_FEATURE_ID);
  const revenueCents = contentItems.reduce(
    (total, item) =>
      total +
      item.monetizationLinks.reduce(
        (itemTotal, link) => itemTotal + link.actualRevenueCents,
        0,
      ),
    0,
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[280px_1fr]">
        <AppSidebar
          active="content"
          title="Content Pipeline"
          subtitle="Plan, draft, publish, measure, and monetize content."
          showBackup
        />

        <section className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div>
                <h2 className="text-2xl font-semibold">Content Pipeline MVP</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                  Move content from idea to brief, draft, publishing prep, published performance,
                  and revenue attribution without external publishing or analytics integrations.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-5">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-xs text-zinc-500">Items</p>
                    <p className="mt-2 text-2xl font-semibold">{contentItems.length}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-xs text-amber-100/80">Drafting</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-100">{draftCount}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-xs text-blue-100/80">Ready</p>
                    <p className="mt-2 text-2xl font-semibold text-blue-100">{readyCount}</p>
                  </div>
                  <div className="rounded-2xl border border-teal-500/20 bg-teal-500/10 p-4">
                    <p className="text-xs text-teal-100/80">Published</p>
                    <p className="mt-2 text-2xl font-semibold text-teal-100">{publishedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="text-xs text-emerald-100/80">Revenue</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-100">
                      {formatCents(revenueCents)}
                    </p>
                  </div>
                </div>
              </div>

              <form action={createContentItem} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="font-semibold">Add Content Idea</h3>
                <div className="mt-4 grid gap-3">
                  <input
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    name="title"
                    placeholder="Content title"
                    required
                  />
                  <textarea
                    className="min-h-28 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    name="coreIdea"
                    placeholder="Core idea, hook, or concept"
                    required
                  />
                  <input
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    name="audience"
                    placeholder="Audience"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      name="format"
                      defaultValue="SHORT_VIDEO"
                    >
                      {CONTENT_FORMAT_OPTIONS.map((format) => (
                        <option key={format} value={format}>
                          {contentFormatLabels[format]}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      name="primaryPlatform"
                      defaultValue="YOUTUBE"
                    >
                      {PUBLISHING_PLATFORM_OPTIONS.map((platform) => (
                        <option key={platform} value={platform}>
                          {publishingPlatformLabels[platform]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    name="tags"
                    placeholder="Tags"
                  />
                  <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
                    Save Content
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="space-y-4">
            {contentItems.length === 0 && (
              <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/70 p-6 text-sm text-zinc-400">
                <p className="font-semibold text-zinc-100">No content items yet</p>
                <p className="mt-2">
                  Add the first content idea above. It will become the working record for brief,
                  draft, publishing, metrics, and monetization.
                </p>
              </div>
            )}

            {contentItems.map((item) => {
              const latestDraft = item.drafts[0];
              const latestPacketDraft = item.drafts.find(
                (draft) => draft.title === PRODUCTION_PACKET_DRAFT_TITLE,
              );
              const latestMetric = item.metrics[0];
              const revenue = item.monetizationLinks.reduce(
                (total, link) => total + link.actualRevenueCents,
                0,
              );

              return (
                <article
                  key={item.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                          {contentStatusLabels[item.status]}
                        </span>
                        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
                          {contentFormatLabels[item.format]}
                        </span>
                        <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">
                          {publishingPlatformLabels[item.primaryPlatform]}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-zinc-300">
                        {item.coreIdea}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span>Audience: {item.audience || "Unspecified"}</span>
                        <span>{item.tags || "No tags"}</span>
                        <span>{item.drafts.length} recent drafts</span>
                        <span>{item.publishingTargets.length} publishing targets</span>
                      </div>
                    </div>
                    <div className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <p className="text-zinc-500">Views</p>
                        <p className="mt-1 font-semibold text-zinc-100">{latestMetric?.views ?? 0}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <p className="text-zinc-500">Clicks</p>
                        <p className="mt-1 font-semibold text-zinc-100">{latestMetric?.clicks ?? 0}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                        <p className="text-emerald-100/80">Revenue</p>
                        <p className="mt-1 font-semibold text-emerald-100">{formatCents(revenue)}</p>
                      </div>
                    </div>
                  </div>

                  {canUseProductionPacket && (
                    <div className="mt-5 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/10 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h4 className="font-semibold text-fuchsia-100">Creator Run v0.1</h4>
                          <p className="mt-1 text-sm text-fuchsia-100/75">
                            Production packet, manual asset plan, and task bridge.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <form action={createProductionPacket}>
                            <input type="hidden" name="contentItemId" value={item.id} />
                            <button className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500">
                              Create Production Packet
                            </button>
                          </form>
                          <form action={createProductionTasks}>
                            <input type="hidden" name="contentItemId" value={item.id} />
                            <button className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">
                              Create Production Tasks
                            </button>
                          </form>
                          {latestPacketDraft && (
                            <a
                              className="rounded-xl border border-fuchsia-400/40 bg-zinc-950 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-zinc-900"
                              href={`/api/content/${item.id}/production-packet/markdown`}
                            >
                              Export Packet Markdown
                            </a>
                          )}
                        </div>
                      </div>
                      {latestPacketDraft && (
                        <p className="mt-3 text-xs text-fuchsia-100/70">
                          Latest packet: version {latestPacketDraft.version}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <form action={saveContentBrief} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <input type="hidden" name="contentItemId" value={item.id} />
                      <h4 className="font-semibold">Brief</h4>
                      <div className="mt-3 grid gap-3">
                        <input
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="objective"
                          placeholder="Objective"
                          defaultValue={item.brief?.objective ?? ""}
                        />
                        <input
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="angle"
                          placeholder="Angle"
                          defaultValue={item.brief?.angle ?? ""}
                        />
                        <input
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="promise"
                          placeholder="Promise"
                          defaultValue={item.brief?.promise ?? ""}
                        />
                        <textarea
                          className="min-h-24 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="outline"
                          placeholder="Outline"
                          defaultValue={item.brief?.outline ?? ""}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            name="cta"
                            placeholder="CTA"
                            defaultValue={item.brief?.cta ?? ""}
                          />
                          <input
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            name="keywords"
                            placeholder="Keywords"
                            defaultValue={item.brief?.keywords ?? ""}
                          />
                        </div>
                        <textarea
                          className="min-h-20 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="notes"
                          placeholder="Brief notes"
                          defaultValue={item.brief?.notes ?? ""}
                        />
                        <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
                          Save Brief
                        </button>
                      </div>
                    </form>

                    <form action={saveContentDraft} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <input type="hidden" name="contentItemId" value={item.id} />
                      <h4 className="font-semibold">Draft / Edit</h4>
                      <div className="mt-3 grid gap-3">
                        <input
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="draftTitle"
                          placeholder="Draft title"
                          defaultValue={latestDraft?.title ?? item.title}
                        />
                        <select
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="draftStatus"
                          defaultValue={latestDraft?.status ?? "DRAFT"}
                        >
                          {CONTENT_DRAFT_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                        <textarea
                          className="min-h-56 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-500"
                          name="draftBody"
                          placeholder="Draft content"
                          defaultValue={latestDraft?.body ?? ""}
                        />
                        <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500">
                          Save Draft Version
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <form action={savePublishingTarget} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <input type="hidden" name="contentItemId" value={item.id} />
                      <h4 className="font-semibold">Publishing Prep</h4>
                      <div className="mt-3 grid gap-3">
                        <select
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="platform"
                          defaultValue={item.primaryPlatform}
                        >
                          {PUBLISHING_PLATFORM_OPTIONS.map((platform) => (
                            <option key={platform} value={platform}>
                              {publishingPlatformLabels[platform]}
                            </option>
                          ))}
                        </select>
                        <textarea
                          className="min-h-24 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="caption"
                          placeholder="Caption or description"
                        />
                        <input
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="hashtags"
                          placeholder="Hashtags"
                        />
                        <textarea
                          className="min-h-20 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="checklist"
                          placeholder="Publishing checklist"
                        />
                        <input
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          name="scheduledAt"
                          type="datetime-local"
                        />
                        <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
                          Save Publishing Prep
                        </button>
                      </div>
                    </form>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                      <h4 className="font-semibold">Targets</h4>
                      <div className="mt-3 space-y-3">
                        {item.publishingTargets.length === 0 && (
                          <p className="rounded-xl border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">
                            No publishing targets prepared yet.
                          </p>
                        )}
                        {item.publishingTargets.map((target) => (
                          <div key={target.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium">{publishingPlatformLabels[target.platform]}</p>
                              <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                                {target.status}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{target.caption || "No caption"}</p>
                            <p className="mt-2 text-xs text-zinc-500">
                              Scheduled: {formatDate(target.scheduledAt)}
                            </p>
                            {target.status !== "PUBLISHED" && (
                              <form action={markPublishingTargetPublished} className="mt-3 grid gap-2">
                                <input type="hidden" name="publishingTargetId" value={target.id} />
                                <input
                                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                                  name="publishUrl"
                                  placeholder="Published URL"
                                />
                                <input
                                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                                  name="publishedAt"
                                  type="date"
                                />
                                <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500">
                                  Mark Published
                                </button>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <form action={recordContentMetric} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                        <input type="hidden" name="contentItemId" value={item.id} />
                        <h4 className="font-semibold">Metrics</h4>
                        <div className="mt-3 grid gap-2">
                          <select
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            name="metricPlatform"
                            defaultValue={item.primaryPlatform}
                          >
                            {PUBLISHING_PLATFORM_OPTIONS.map((platform) => (
                              <option key={platform} value={platform}>
                                {publishingPlatformLabels[platform]}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            {["views", "likes", "comments", "shares", "saves", "clicks"].map((metric) => (
                              <input
                                key={metric}
                                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                                min={0}
                                name={metric}
                                placeholder={metric}
                                type="number"
                              />
                            ))}
                          </div>
                          <input
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                            name="capturedAt"
                            type="date"
                          />
                          <input
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                            name="metricNotes"
                            placeholder="Metric notes"
                          />
                          <button className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500">
                            Record Metrics
                          </button>
                        </div>
                      </form>

                      <form action={saveMonetizationLink} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                        <input type="hidden" name="contentItemId" value={item.id} />
                        <h4 className="font-semibold">Monetization</h4>
                        <div className="mt-3 grid gap-2">
                          <select
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                            name="method"
                            defaultValue="AFFILIATE"
                          >
                            {MONETIZATION_METHOD_OPTIONS.map((method) => (
                              <option key={method} value={method}>
                                {monetizationMethodLabels[method]}
                              </option>
                            ))}
                          </select>
                          <input
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                            name="offerName"
                            placeholder="Offer or sponsor"
                          />
                          <input
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                            name="offerUrl"
                            placeholder="Offer URL"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                              name="expectedValue"
                              placeholder="Expected $"
                            />
                            <input
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                              name="actualRevenue"
                              placeholder="Revenue $"
                            />
                            <input
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                              name="currency"
                              placeholder="USD"
                            />
                          </div>
                          <input
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                            name="monetizationNotes"
                            placeholder="Revenue notes"
                          />
                          <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
                            Save Monetization
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </section>
      </div>
    </main>
  );
}
