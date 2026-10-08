import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmImportAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireViewer } from "@/lib/dal/viewer";
import { prisma } from "@/lib/prisma";

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const viewer = await requireViewer();
  const batch = await prisma.importBatch.findFirst({ where: { id, agencyId: viewer.agencyId }, include: { client: { select: { name: true } }, rows: { orderBy: { rowNumber: "asc" }, take: 250 } } });
  if (!batch) notFound();
  const confirm = confirmImportAction.bind(null, batch.id, viewer.agencyId);
  return <><header className="page-header"><div><Link className="back-link" href="/imports">← Import history</Link><p className="eyebrow">{batch.status}</p><h1>{batch.originalFilename}</h1><p>{batch.client.name} · {batch.totalRows} rows</p></div><div className="header-actions"><a className="button secondary" href={`/api/imports/${batch.id}/rejections`}>Download rejection report</a>{batch.status === "PREVIEWED" && <form action={confirm}><SubmitButton>Confirm import</SubmitButton></form>}</div></header>
    <section className="stat-grid compact"><article><span>Valid</span><strong>{batch.validRows}</strong></article><article><span>Duplicates</span><strong>{batch.duplicateRows}</strong></article><article><span>Rejected</span><strong>{batch.rejectedRows}</strong></article><article><span>Imported</span><strong>{batch.importedRows}</strong></article></section>
    <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Row</th><th>Status</th><th>URL</th><th>Result</th></tr></thead><tbody>{batch.rows.map((row) => { const raw = row.rawData as Record<string, unknown>; const normalized = row.normalizedData as Record<string, unknown> | null; const nested = normalized?.normalized as Record<string, unknown> | undefined; return <tr key={row.id}><td>{row.rowNumber}</td><td><span className={`status ${row.status === "REJECTED" ? "error" : ""}`}>{row.status}</span></td><td className="url-cell">{String(nested?.normalizedUrl ?? Object.values(raw)[0] ?? "—")}</td><td>{row.rejectionReason ?? (row.status === "IMPORTED" ? "Imported" : "Ready")}</td></tr>; })}</tbody></table></div>{batch.totalRows > 250 && <p className="table-note">Showing the first 250 rows. Download the rejection report for all rejected rows.</p>}</section>
  </>;
}
