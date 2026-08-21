import type { Metadata } from "next";
import ShushuApp from "@/app/shushu-app";
import { getDashboard } from "@/lib/queries";
import { requireShareContext } from "@/lib/share-access";
import { hasValidAccessSession } from "@/lib/access-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  try {
    const { token } = await params;
    const dashboard = await getDashboard(await requireShareContext(token));
    const nickname = String(dashboard.account.nickname || "小红书账号");
    const title = `${nickname} · 数据复盘`;
    const description = `${nickname} 的小红书账号数据、内容趋势与复盘情况。`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, images: [] },
      twitter: { card: "summary", title, description, images: [] },
    };
  } catch {
    return {
      title: "分享链接不可用 · 薯数",
      description: "该分享链接无效或已失效。",
      robots: { index: false, follow: false },
      openGraph: { title: "分享链接不可用 · 薯数", description: "该分享链接无效或已失效。", images: [] },
      twitter: { card: "summary", title: "分享链接不可用 · 薯数", description: "该分享链接无效或已失效。", images: [] },
    };
  }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!await hasValidAccessSession()) redirect(`/login?return_to=${encodeURIComponent(`/share/${token}`)}`);
  return <ShushuApp shareToken={token} />;
}
