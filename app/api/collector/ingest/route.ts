import { apiError, json } from "@/lib/http";
import { requireCollectorToken } from "@/lib/collector-auth";
import { ingest, validateCollectorPayload } from "@/lib/ingest";

export async function POST(request: Request) {
  try {
    requireCollectorToken(request);
    const payload = validateCollectorPayload(await request.json());
    const result = await ingest(payload);
    return json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
