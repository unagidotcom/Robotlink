import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveContentAction } from "@/app/actions";
import { ContentForm } from "@/components/content-form";
import { SubmitButton } from "@/components/submit-button";
import { getContentDetail, listClients } from "@/lib/dal/content";
import { requireViewer } from "@/lib/dal/viewer";
import { prisma } from "@/lib/prisma";

export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const viewer = await requireViewer();
  const [content, clients, history, activity] = await Promise.all([
    getContentDetail(viewer, id), listClients(viewer),
    prisma.statusHistory.findMany({ where: { agencyId: viewer.agencyId, entityType: "content", entityId: id }, orderBy: { occurredAt: "desc" }, take: 50 }),
    prisma.auditEvent.findMany({ where: { agencyId: viewer.agencyId, targetType: "content", targetId: id }, orderBy: { occurredAt: "desc" }, take: 50 }),
  ]);
  if (!content) notFound();
  const archive = archiveContentAction.bind(null, content.id, viewer.agencyId);
  return <><header className="page-header"><div><Link href="/content" className="back-link">← Content inventory</Link><p className="eyebrow">{content.platform} · {content.contentType}</p><h1>{content.title || "Untitled content"}</h1><a className="source-url" href={content.originalUrl} target="_blank" rel="noreferrer">{content.normalizedUrl}</a></div></header>
    <section className="status-grid">{[["Publication", content.publicationStatus], ["Technical", content.technicalStatus], ["Indexing evidence", content.indexingEvidence], ["Google visibility", content.visibilityStatus], ["Revenue", content.revenueAvailability], ["Last verification", content.lastVerifiedAt?.toLocaleString() ?? "NOT CHECKED"]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value?.replaceAll("_", " ")}</strong></article>)}</section>
    <section className="split-layout detail-layout"><div className="panel"><div className="panel-heading"><h2>Edit record</h2></div><ContentForm agencyId={viewer.agencyId} clients={clients} content={content} /></div><div className="stack"><section className="panel"><div className="panel-heading"><h2>Status history</h2></div>{history.length ? <div className="timeline">{history.map((item) => <div key={item.id}><i/><div><strong>{item.statusDimension}: {item.newValue.replaceAll("_", " ")}</strong><small>{item.reason ?? "Status changed"} · {item.occurredAt.toLocaleString()}</small></div></div>)}</div> : <div className="empty">No status changes recorded.</div>}</section><section className="panel"><div className="panel-heading"><h2>Activity</h2></div>{activity.length ? <div className="timeline">{activity.map((item) => <div key={item.id}><i/><div><strong>{item.action.replaceAll(".", " ")}</strong><small>{item.occurredAt.toLocaleString()}</small></div></div>)}</div> : <div className="empty">No activity recorded.</div>}</section><form action={archive}><SubmitButton destructive>Archive content</SubmitButton></form></div></section>
  </>;
}
