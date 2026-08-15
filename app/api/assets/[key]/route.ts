import { env } from "cloudflare:workers";
import { requireApiContext } from "@/lib/context";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  await requireApiContext();
  const { key } = await params;
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  if (!bucket) return new Response("素材存储未配置", { status: 503 });
  const object = await bucket.get(key);
  if (!object) return new Response("素材不存在", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
