import { env } from "cloudflare:workers";
import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const context = await requireApiContext();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ ok: false, error: "请选择文件" }, { status: 400 });
    if (file.size > 250 * 1024 * 1024) return json({ ok: false, error: "文件不能超过 250MB" }, { status: 413 });
    const extension = file.name.includes(".") ? file.name.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "") : "bin";
    const key = `${context.workspaceId}-${crypto.randomUUID()}.${extension}`;
    const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
    if (!bucket) throw new Error("R2 素材存储尚未配置");
    await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { originalName: file.name, uploadedBy: context.userId } });
    return json({ ok: true, data: { key, url: `/api/assets/${encodeURIComponent(key)}`, name: file.name, size: file.size } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
