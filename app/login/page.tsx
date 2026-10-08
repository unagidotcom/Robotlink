import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="back-link">← Article Visibility</Link><p className="eyebrow">SECURE AGENCY ACCESS</p><h1>Welcome back.</h1><p className="muted">Sign in with an agency administrator account.</p><LoginForm /></section></main>;
}
