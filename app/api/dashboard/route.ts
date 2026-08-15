import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";
import { getDashboard } from "@/lib/queries";

export async function GET() {
  try {
    const context = await requireApiContext();
    return json({ ok: true, data: await getDashboard(context) });
  } catch (error) {
    return apiError(error);
  }
}
