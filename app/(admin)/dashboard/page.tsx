import Link from "next/link";
import { requireViewer } from "@/lib/dal/viewer";
import { dashboardSummary } from "@/lib/dal/content";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const summary = await dashboardSummary(viewer);
  return <>
    <header className="page-header"><div><p className="eyebrow">AGENCY OVERVIEW</p><h1>Visibility command center</h1><p>Evidence first. Unknown stays unknown until a real check says otherwise.</p></div><Link className="button primary" href="/content/new">Add content</Link></header>
    <section className="stat-grid">
      <article><span>Content records</span><strong>{summary.contentCount}</strong></article>
      <article><span>Active clients</span><strong>{summary.clientCount}</strong></article>
      <article><span>Technical not checked</span><strong>{summary.unknownTechnical}</strong></article>
      <article><span>Indexing unknown</span><strong>{summary.unknownIndexing}</strong></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent changes</h2></div></div>
      {summary.recent.length ? <div className="activity-list">{summary.recent.map((item) => <div key={item.id}><span className="activity-mark"/><div><strong>{item.action.replaceAll(".", " ")}</strong><small>{item.targetType} · {item.occurredAt.toLocaleString()}</small></div></div>)}</div> : <div className="empty">No recorded activity yet.</div>}
    </section>
  </>;
}
