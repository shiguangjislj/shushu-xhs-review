import { redirect } from "next/navigation";
import { hasValidAccessSession } from "@/lib/access-auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await hasValidAccessSession()) redirect("/");
  return <main className="access-page"><section className="access-card">
    <div className="access-brand"><span>薯</span><div><b>薯数</b><small>内容数据复盘</small></div></div>
    <p className="access-kicker">PRIVATE WORKSPACE</p><h1>路人甲TM 数据后台</h1>
    <p className="access-description">该页面包含账号经营数据，仅限已授权的运营成员访问。</p>
    <LoginForm />
    <p className="access-safe">请使用独立访问密码，不要在此输入小红书账号密码。</p>
  </section></main>;
}
