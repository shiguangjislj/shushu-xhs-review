import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const COOKIE_NAME = "shushu_access_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type AccessEnv = { ACCESS_PASSWORD?: string; ACCESS_SESSION_SECRET?: string };

function accessEnv() {
  const configured = env as unknown as AccessEnv;
  if (configured.ACCESS_PASSWORD && configured.ACCESS_SESSION_SECRET) return configured;
  if (process.env.NODE_ENV !== "production") return {
    ACCESS_PASSWORD: "dev-access-password",
    ACCESS_SESSION_SECRET: "dev-access-session-secret-change-in-production",
  };
  return configured;
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

function base64UrlEncode(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function verifyAccessPassword(password: string) {
  const configured = accessEnv();
  if (!configured.ACCESS_PASSWORD || !configured.ACCESS_SESSION_SECRET) return false;
  const [expected, supplied] = await Promise.all([
    hmac(configured.ACCESS_PASSWORD, configured.ACCESS_SESSION_SECRET),
    hmac(password, configured.ACCESS_SESSION_SECRET),
  ]);
  return bytesEqual(expected, supplied);
}

export async function createAccessSession() {
  const configured = accessEnv();
  if (!configured.ACCESS_SESSION_SECRET) throw new Response("访问密码尚未配置", { status: 503 });
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  })));
  const signature = base64UrlEncode(await hmac(payload, configured.ACCESS_SESSION_SECRET));
  return `${payload}.${signature}`;
}

async function verifyAccessSession(token: string) {
  const configured = accessEnv();
  if (!configured.ACCESS_SESSION_SECRET) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  let suppliedSignature: Uint8Array;
  try { suppliedSignature = base64UrlDecode(signature); } catch { return false; }
  if (!bytesEqual(await hmac(payload, configured.ACCESS_SESSION_SECRET), suppliedSignature)) return false;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { expiresAt?: number };
    return typeof session.expiresAt === "number" && session.expiresAt > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export async function hasValidAccessSession() {
  const requestHeaders = await headers();
  return verifyAccessSession(cookieValue(requestHeaders.get("cookie"), COOKIE_NAME));
}

export async function requireAccessSession() {
  if (!await hasValidAccessSession()) throw new Response("请先输入访问密码", { status: 401 });
}

export function accessSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearAccessSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
