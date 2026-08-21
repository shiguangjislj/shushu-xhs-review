import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, shareLinks } from "@/db/schema";
import type { AppContext } from "./context";
import { requireAccessSession } from "./access-auth";

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createShareToken() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashShareToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return hex(new Uint8Array(digest));
}

export async function requireShareContext(token: string): Promise<AppContext> {
  await requireAccessSession();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Response("分享链接无效", { status: 404 });
  const db = getDb();
  const tokenHash = await hashShareToken(token);
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, tokenHash)).limit(1);
  const expired = link?.expiresAt && new Date(link.expiresAt).getTime() <= Date.now();
  if (!link || link.revokedAt || expired || link.permission !== "read") {
    throw new Response("分享链接无效或已失效", { status: 404 });
  }
  const [account] = await db.select().from(accounts).where(eq(accounts.id, link.accountId)).limit(1);
  if (!account || account.workspaceId !== link.workspaceId) throw new Response("分享内容不存在", { status: 404 });
  return {
    userId: `share:${link.id}`,
    workspaceId: link.workspaceId,
    accountId: link.accountId,
    email: "",
    displayName: "只读访客",
  };
}
