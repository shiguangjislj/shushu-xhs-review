import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { shareLinks } from "@/db/schema";
import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";
import { createShareToken, hashShareToken } from "@/lib/share-access";

export async function GET() {
  try {
    const context = await requireApiContext();
    const rows = await getDb().select({
      id: shareLinks.id,
      permission: shareLinks.permission,
      label: shareLinks.label,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
    }).from(shareLinks).where(and(eq(shareLinks.accountId, context.accountId), isNull(shareLinks.revokedAt))).orderBy(desc(shareLinks.createdAt));
    return json({ ok: true, data: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireApiContext();
    const input = await request.json().catch(() => ({})) as { label?: string; expiresInDays?: number | null };
    const days = input.expiresInDays == null ? null : Math.max(1, Math.min(365, Math.floor(input.expiresInDays)));
    const now = new Date();
    const token = createShareToken();
    const id = crypto.randomUUID();
    await getDb().insert(shareLinks).values({
      id,
      workspaceId: context.workspaceId,
      accountId: context.accountId,
      tokenHash: await hashShareToken(token),
      permission: "read",
      label: input.label?.trim().slice(0, 80) || "团队只读链接",
      expiresAt: days ? new Date(now.getTime() + days * 86_400_000).toISOString() : null,
      revokedAt: null,
      lastAccessedAt: null,
      createdBy: context.userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    const url = new URL(`/share/${token}`, request.url).toString();
    return json({ ok: true, data: { id, url, permission: "read", expiresAt: days ? new Date(now.getTime() + days * 86_400_000).toISOString() : null } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
