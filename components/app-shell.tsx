import Link from "next/link";
import type { Viewer } from "@/lib/dal/viewer";
import { LogoutButton } from "./logout-button";

export function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return <div className="app-frame">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><span>AV</span> Article Visibility</Link>
      <nav>
        <Link href="/dashboard">Overview</Link><Link href="/clients">Clients</Link>
        <Link href="/content">Content</Link><Link href="/imports">Imports</Link>
      </nav>
      <div className="account"><small>{viewer.agencyName}</small><strong>{viewer.email}</strong><span>{viewer.role.toLowerCase()}</span><LogoutButton /></div>
    </aside>
    <main className="workspace">{children}</main>
  </div>;
}
