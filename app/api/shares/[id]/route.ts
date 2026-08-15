import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shareLinks } from "@/db/schema";
import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireApiContext();
    const { id } = await params;
    const now = new Date().toISOString();
    const result = await getDb().update(shareLinks).set({ revokedAt: now, updatedAt: now })
      .where(and(eq(shareLinks.id, id), eq(shareLinks.accountId, context.accountId))).returning({ id: shareLinks.id });
    if (!result.length) return json({ ok: false, error: "分享链接不存在" }, { status: 404 });
    return json({ ok: true, data: { id, revokedAt: now } });
  } catch (error) {
    return apiError(error);
  }
}
