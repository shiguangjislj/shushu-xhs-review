import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "薯数 · 小红书内容数据复盘",
  description: "定时采集小红书创作者数据，形成生命周期曲线、异常诊断、复盘建议与可复用经验。",
  openGraph: {
    title: "薯数 · 小红书内容数据复盘",
    description: "从数据采集到经验沉淀的完整内容反馈闭环。",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
