"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return <form className="form stack" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
    setPending(false);
    if (!response.ok) { const body = await response.json().catch(() => ({ error: "Unable to sign in" })); setError(body.error); return; }
    router.push("/dashboard"); router.refresh();
  }}>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" minLength={12} required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
