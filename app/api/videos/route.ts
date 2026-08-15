import { requireApiContext } from "@/lib/context";
import { apiError, json } from "@/lib/http";
import { getDashboard } from "@/lib/queries";

export async function GET() {
  try {
    const context = await requireApiContext();
    const data = await getDashboard(context);
    return json({ ok: true, data: data.videos });
  } catch (error) {
    return apiError(error);
  }
}
