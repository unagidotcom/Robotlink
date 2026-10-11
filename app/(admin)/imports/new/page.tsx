import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { PasteUrlForm } from "@/components/paste-url-form";
import { requireViewer } from "@/lib/dal/viewer";
import { listClients } from "@/lib/dal/content";

export default async function NewImportPage() {
  const viewer = await requireViewer(); const clients = await listClients(viewer);
  return <><header className="page-header"><div><Link className="back-link" href="/imports">← Import history</Link><h1>Import content</h1><p>Paste up to 100 URLs or upload a CSV. Both methods require a preview and confirmation before content is created.</p></div></header>{clients.length ? <div className="import-options"><section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">OPTION A</p><h2>Paste URLs</h2></div><span className="method-note">One URL per line</span></div><PasteUrlForm agencyId={viewer.agencyId} clients={clients} /></section><section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">OPTION B</p><h2>Upload CSV</h2></div><span className="method-note">5 MB · 10,000 rows</span></div><ImportForm agencyId={viewer.agencyId} clients={clients} /></section></div> : <section className="panel"><div className="empty">Create a client before importing content.</div></section>}</>;
}
