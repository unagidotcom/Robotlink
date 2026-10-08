"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={destructive ? "button danger" : "button primary"} disabled={pending}>{pending ? "Working…" : children}</button>;
}
