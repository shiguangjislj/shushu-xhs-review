import { apiError, json } from "@/lib/http";
import { getDashboard } from "@/lib/queries";
import { requireShareContext } from "@/lib/share-access";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    return json({ ok: true, data: await getDashboard(await requireShareContext(token)) });
  } catch (error) {
    return apiError(error);
  }
}
