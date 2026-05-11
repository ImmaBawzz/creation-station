import { db } from "@/lib/db";
import { canAccessFeature } from "@/lib/feature-gating";
import {
  PRODUCTION_PACKET_DRAFT_TITLE,
  PRODUCTION_PACKET_FEATURE_ID,
  productionPacketFilename,
} from "@/lib/production-packet";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!canAccessFeature(PRODUCTION_PACKET_FEATURE_ID)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const { id } = await context.params;
  const draft = await db.contentDraft.findFirst({
    where: {
      contentItemId: id,
      title: PRODUCTION_PACKET_DRAFT_TITLE,
    },
    orderBy: { createdAt: "desc" },
    include: {
      contentItem: {
        select: { title: true },
      },
    },
  });

  if (!draft) {
    return Response.json({ error: "Production packet not found." }, { status: 404 });
  }

  return new Response(draft.body, {
    headers: {
      "Content-Disposition": `attachment; filename="${productionPacketFilename(
        draft.contentItem.title,
      )}"`,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
