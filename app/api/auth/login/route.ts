import { accessSessionCookie, createAccessSession, verifyAccessPassword } from "@/lib/access-auth";
import { apiError, json } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { password?: unknown };
    const password = typeof input.password === "string" ? input.password : "";
    if (!await verifyAccessPassword(password)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return json({ ok: false, error: "访问密码错误" }, { status: 401 });
    }
    const session = await createAccessSession();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "set-cookie": accessSessionCookie(session), "cache-control": "no-store" },
    });
  } catch (error) { return apiError(error); }
}
