"use client";

import { FormEvent, useState } from "react";

function safeReturnTo() {
  const value = new URLSearchParams(window.location.search).get("return_to") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "登录失败，请稍后重试");
      window.location.assign(safeReturnTo());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败，请稍后重试"); setSubmitting(false);
    }
  }

  return <form className="access-form" onSubmit={submit}>
    <label htmlFor="access-password">访问密码</label>
    <input id="access-password" name="password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入薯数访问密码" required />
    {error && <p className="access-error" role="alert">{error}</p>}
    <button type="submit" disabled={submitting}>{submitting ? "正在验证…" : "进入数据后台"}</button>
  </form>;
}
