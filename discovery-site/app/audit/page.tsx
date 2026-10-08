import type { Metadata } from "next";
import Link from "next/link";
import { getPublicAuditLog } from "@/lib/audit";

export const metadata: Metadata = { title: "Publication log", alternates: { canonical: "/audit" } };

export default function AuditPage() {
  return (
    <section className="shell listing-page">
      <p className="eyebrow">Transparency</p>
      <h1>Publication log</h1>
      <p className="listing-page__intro">A simple, append-only view of editorial approvals and publication events in this local prototype.</p>
      <ol className="audit-list">
        {getPublicAuditLog().map((entry) => (
          <li key={entry.id}>
            <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time>
            <div><strong>{entry.action.replaceAll("_", " ")}</strong><p>{entry.note}</p><Link href={`/stories/${entry.storySlug}`}>{entry.storySlug}</Link></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
