import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, users, workspaceMembers, workspaces } from "@/db/schema";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";
import { hasValidAccessSession } from "./access-auth";

export type AppContext = {
  userId: string;
  workspaceId: string;
  accountId: string;
  email: string;
  displayName: string;
};

function devUser(): ChatGPTUser {
  return { email: "internal@shushu.local", displayName: "薯数运营", fullName: "薯数运营" };
}

async function digestId(prefix: string, value: string) {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 24)}`;
}

export async function getCurrentUser() {
  const singleUserMode = (env as unknown as { SHUSHU_SINGLE_USER_MODE?: string }).SHUSHU_SINGLE_USER_MODE === "true";
  if (singleUserMode) return await hasValidAccessSession() ? devUser() : null;
  const user = await getChatGPTUser();
  if (user) return user;
  if (process.env.NODE_ENV !== "production") return devUser();
  return null;
}

export async function requireApiContext(): Promise<AppContext> {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Response("未登录", { status: 401 });

  const db = getDb();
  const now = new Date().toISOString();
  const userId = await digestId("usr", currentUser.email);
  const workspaceId = await digestId("ws", currentUser.email);

  await db.insert(users).values({
    id: userId,
    email: currentUser.email,
    displayName: currentUser.displayName,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: users.email,
    set: { displayName: currentUser.displayName, updatedAt: now },
  });

  await db.insert(workspaces).values({
    id: workspaceId,
    name: "薯数内部工作区",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner", createdAt: now }).onConflictDoNothing();

  let [account] = await db.select().from(accounts)
    .where(and(eq(accounts.workspaceId, workspaceId), eq(accounts.platform, "xiaohongshu")))
    .limit(1);

  if (!account) {
    const accountId = crypto.randomUUID();
    await db.insert(accounts).values({
      id: accountId,
      workspaceId,
      platform: "xiaohongshu",
      platformAccountId: null,
      nickname: "待连接小红书账号",
      connectionStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  }

  return {
    userId,
    workspaceId,
    accountId: account.id,
    email: currentUser.email,
    displayName: currentUser.displayName,
  };
}

export async function getCollectorAccount(platformAccountId: string) {
  const db = getDb();
  const [existing] = await db.select().from(accounts)
    .where(eq(accounts.platformAccountId, platformAccountId))
    .limit(1);
  if (existing) return existing;

  const [pending] = await db.select().from(accounts)
    .where(and(eq(accounts.platform, "xiaohongshu"), eq(accounts.connectionStatus, "pending")))
    .limit(1);
  return pending ?? null;
}
