import { apiError, json } from "@/lib/http";
import { getVideoDetail } from "@/lib/queries";
import { requireShareContext } from "@/lib/share-access";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  try {
    const { token, id } = await params;
    return json({ ok: true, data: await getVideoDetail(await requireShareContext(token), id) });
  } catch (error) {
    return apiError(error);
  }
}
