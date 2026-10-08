import Link from "next/link";
import { ContentForm } from "@/components/content-form";
import { requireViewer } from "@/lib/dal/viewer";
import { listClients } from "@/lib/dal/content";

export default async function NewContentPage() {
  const viewer = await requireViewer(); const clients = await listClients(viewer);
  return <><header className="page-header"><div><Link className="back-link" href="/content">← Content inventory</Link><h1>Add content</h1><p>Platform and content type are derived from the submitted URL.</p></div></header><section className="panel form-panel">{clients.length ? <ContentForm agencyId={viewer.agencyId} clients={clients} /> : <div className="empty">Create a client before adding content. <Link href="/clients">Go to clients</Link></div>}</section></>;
}
