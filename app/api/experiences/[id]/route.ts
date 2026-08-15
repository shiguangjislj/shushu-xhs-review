import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, experienceCards } from "@/db/schema";
import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";

const ALLOWED_STATUSES = new Set(["draft", "confirmed", "rejected", "needs_more_evidence"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireApiContext();
    const { id } = await params;
    const input = await request.json() as { status?: string };
    if (!input.status || !ALLOWED_STATUSES.has(input.status)) {
      return json({ ok: false, error: "经验状态无效" }, { status: 400 });
    }
    const db = getDb();
    const [current] = await db.select().from(experienceCards)
      .where(and(eq(experienceCards.id, id), eq(experienceCards.workspaceId, context.workspaceId)))
      .limit(1);
    if (!current) return json({ ok: false, error: "经验不存在" }, { status: 404 });
    const now = new Date().toISOString();
    await db.update(experienceCards).set({ status: input.status, version: current.version + 1, updatedAt: now }).where(eq(experienceCards.id, id));
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(), workspaceId: context.workspaceId, actorId: context.userId,
      action: "experience.status.changed", entityType: "experience_card", entityId: id,
      detailJson: JSON.stringify({ from: current.status, to: input.status, version: current.version + 1 }), createdAt: now,
    });
    return json({ ok: true, data: { id, status: input.status, version: current.version + 1 } });
  } catch (error) {
    return apiError(error);
  }
}
