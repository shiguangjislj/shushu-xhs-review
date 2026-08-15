import { env } from "cloudflare:workers";

export function requireCollectorToken(request: Request) {
  const configured = (env as unknown as { COLLECTOR_TOKEN?: string }).COLLECTOR_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const developmentToken = process.env.NODE_ENV !== "production" ? "dev-collector-token" : null;
  const expected = configured ?? developmentToken;
  if (!expected || supplied !== expected) throw new Response("采集器未授权", { status: 401 });
}
