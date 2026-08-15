import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";
import { getVideoDetail } from "@/lib/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireApiContext();
    const { id } = await params;
    return json({ ok: true, data: await getVideoDetail(context, id) });
  } catch (error) {
    return apiError(error);
  }
}
