import Link from "next/link";
import { requireViewer } from "@/lib/dal/viewer";
import { prisma } from "@/lib/prisma";

export default async function ImportsPage() {
  const viewer = await requireViewer();
  const batches = await prisma.importBatch.findMany({ where: { agencyId: viewer.agencyId }, include: { client: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <><header className="page-header"><div><p className="eyebrow">BATCH INGESTION</p><h1>Import history</h1><p>Preview, reject, and confirm without changing existing evidence.</p></div><Link className="button primary" href="/imports/new">New import</Link></header><section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Source</th><th>Client</th><th>Status</th><th>Rows</th><th>Imported</th><th>Created</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td><Link className="content-link" href={`/imports/${batch.id}`}><strong>{batch.originalFilename}</strong><small>{batch.id.slice(0, 8)}</small></Link></td><td>{batch.client.name}</td><td><span className="status">{batch.status}</span></td><td>{batch.totalRows} <small>({batch.rejectedRows} rejected)</small></td><td>{batch.importedRows}</td><td>{batch.createdAt.toLocaleString()}</td></tr>)}</tbody></table></div>{!batches.length && <div className="empty">No imports yet.</div>}</section></>;
}
