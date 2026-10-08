import { ClientForm } from "@/components/client-form";
import { requireViewer } from "@/lib/dal/viewer";
import { listClients } from "@/lib/dal/content";

export default async function ClientsPage() {
  const viewer = await requireViewer();
  const clients = await listClients(viewer);
  return <><header className="page-header"><div><p className="eyebrow">TENANT DIRECTORY</p><h1>Clients</h1><p>Every content record and import is isolated within its client and agency.</p></div></header>
    <section className="split-layout"><div className="panel"><div className="panel-heading"><h2>Active clients</h2><span className="count">{clients.length}</span></div>
      {clients.length ? <div className="client-list">{clients.map((client) => <article key={client.id}><div className="client-monogram">{client.name.slice(0, 2).toUpperCase()}</div><div><strong>{client.name}</strong><small>{client.defaultCountryCode ?? "—"} · {client.defaultLanguageCode ?? "—"} · {client.defaultDevice.toLowerCase()}</small></div></article>)}</div> : <div className="empty">Create the first client to begin.</div>}</div>
      <section className="panel sticky-panel"><div className="panel-heading"><h2>New client</h2></div><ClientForm agencyId={viewer.agencyId} /></section>
    </section></>;
}
