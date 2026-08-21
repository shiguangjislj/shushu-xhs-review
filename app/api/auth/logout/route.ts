import { clearAccessSessionCookie } from "@/lib/access-auth";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "set-cookie": clearAccessSessionCookie(), "cache-control": "no-store" },
  });
}
