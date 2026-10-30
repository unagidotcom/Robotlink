import Link from "next/link";
import { createDiscoveryCampaignAction } from "@/app/discovery/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireViewer } from "@/lib/dal/viewer";
import { prisma } from "@/lib/prisma";

const workflowStatuses = ["AWAITING_INSPECTION", "ELIGIBLE_FOR_EDITORIAL_REVIEW", "DRAFT_PREPARED", "APPROVED", "PUBLISHED_REFERENCE", "MONITORING", "INDEXING_UNVERIFIED"] as const;

export default async function DiscoveryPage() {
  const viewer = await requireViewer();
  const [clients, campaigns, grouped] = await Promise.all([
    prisma.client.findMany({ where: { agencyId: viewer.agencyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.discoveryCampaign.findMany({ where: { agencyId: viewer.agencyId }, include: { client: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.discoveryCampaignItem.groupBy({ by: ["workflowStatus"], where: { agencyId: viewer.agencyId }, _count: { _all: true } }),
  ]);
  const counts = new Map(grouped.map((entry) => [entry.workflowStatus, entry._count._all]));
  return <>
    <header className="page-header"><div><p className="eyebrow">LEGITIMATE DISCOVERY</p><h1>Editorial discovery</h1><p>Prepare source-backed references for human review. Approval does not publish content or confirm Google indexing.</p></div></header>
    <section className="discovery-status-grid">{workflowStatuses.map((status) => <article key={status}><span>{status.replaceAll("_", " ")}</span><strong>{counts.get(status) ?? 0}</strong></article>)}</section>
    <section className="split-layout"><div className="panel"><div className="panel-heading"><h2>Campaigns</h2><span className="count">{campaigns.length}</span></div>{campaigns.length ? <div className="campaign-list">{campaigns.map((campaign) => <Link href={`/discovery/${campaign.id}`} key={campaign.id}><div><strong>{campaign.name}</strong><small>{campaign.client.name} · {campaign.method.replaceAll("_", " ")}</small></div><span>{campaign.status} · {campaign._count.items} URLs</span></Link>)}</div> : <div className="empty">No discovery campaigns yet.</div>}</div>
      <div className="panel sticky-panel"><div className="panel-heading"><h2>New campaign</h2></div>{clients.length ? <form action={createDiscoveryCampaignAction} className="form stack"><input type="hidden" name="agencyId" value={viewer.agencyId}/><label>Campaign name<input name="name" minLength={3} maxLength={200} required/></label><label>Client<select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Discovery method<select name="method" defaultValue="EDITORIAL_REFERENCE"><option value="EDITORIAL_REFERENCE">Editorial reference</option><option value="OWNED_CONTENT_HUB">Owned content hub</option><option value="RSS_ATOM">RSS or Atom</option><option value="PUBLISHER_SUPPORTED">Publisher-supported</option><option value="OTHER">Other permitted method</option></select></label><p className="form-note">Phase D1 prepares and reviews candidates only. Publication remains disabled.</p><SubmitButton>Create campaign</SubmitButton></form> : <div className="empty">Create a client before starting a campaign.</div>}</div>
    </section>
  </>;
}
