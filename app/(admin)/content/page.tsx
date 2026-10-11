import Link from "next/link";
import { requireViewer } from "@/lib/dal/viewer";
import { listClients, listContent } from "@/lib/dal/content";

const platforms = ["MEDIUM", "INSTAGRAM", "WORDPRESS_COM", "BLOGGER", "SUBSTACK", "LINKEDIN", "PUBLIC_PDF", "GENERIC"];
const types = ["ARTICLE", "POST", "REEL", "PDF", "OTHER"];

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer();
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
  const [items, clients] = await Promise.all([listContent(viewer, { clientId: value("client"), platform: value("platform"), type: value("type"), query: value("q") }), listClients(viewer)]);
  return <><header className="page-header"><div><p className="eyebrow">CONTENT INVENTORY</p><h1>Published assets</h1><p>Search, filter, and review each item without manufacturing evidence.</p></div><div className="header-actions"><Link className="button secondary" href="/imports/new">Import content</Link><Link className="button primary" href="/content/new">Add content</Link></div></header>
    <form className="filter-bar"><input name="q" placeholder="Search title, URL, or keyword" defaultValue={value("q")} /><select name="client" defaultValue={value("client") ?? ""}><option value="">All clients</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select><select name="platform" defaultValue={value("platform") ?? ""}><option value="">All platforms</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select><select name="type" defaultValue={value("type") ?? ""}><option value="">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select><button className="button secondary">Apply</button></form>
    <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Content</th><th>Platform</th><th>Publication</th><th>Technical</th><th>Indexing</th><th>Visibility</th><th>Verified</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><Link className="content-link" href={`/content/${item.id}`}><strong>{item.title || "Untitled content"}</strong><small>{item.client.name} · {item.keywords.map((entry) => entry.keyword.displayPhrase).join(", ") || "No keywords"}</small></Link></td><td><span className="platform-pill">{item.platform.replace("_", ".")}</span><small>{item.contentType.toLowerCase()}</small></td><td><Status value={item.publicationStatus}/></td><td><Status value={item.technicalStatus}/></td><td><Status value={item.indexingEvidence}/></td><td><Status value={item.visibilityStatus}/></td><td>{item.lastVerifiedAt ? item.lastVerifiedAt.toLocaleDateString() : <span className="unknown">Not checked</span>}</td></tr>)}</tbody></table></div>{!items.length && <div className="empty">No content matches these filters.</div>}</section>
  </>;
}

function Status({ value }: { value: string }) { const unknown = value === "UNKNOWN" || value.includes("PENDING"); return <span className={unknown ? "status unknown" : "status"}>{value.replaceAll("_", " ")}</span>; }
