import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { requireViewer } from "@/lib/dal/viewer";
import { listClients } from "@/lib/dal/content";

export default async function NewImportPage() {
  const viewer = await requireViewer(); const clients = await listClients(viewer);
  return <><header className="page-header"><div><Link className="back-link" href="/imports">← Import history</Link><h1>Import content</h1><p>CSV files are limited to 5 MB and 10,000 rows. A preview is mandatory before confirmation.</p></div></header><section className="panel form-panel">{clients.length ? <ImportForm agencyId={viewer.agencyId} clients={clients} /> : <div className="empty">Create a client before importing content.</div>}</section></>;
}
