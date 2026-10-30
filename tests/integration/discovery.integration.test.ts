import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "true" && Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!enabled)("PostgreSQL discovery isolation", () => {
  let prisma: import("@prisma/client").PrismaClient;
  let agencyId: string;
  let clientId: string;
  let contentId: string;
  const suffix = crypto.randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    const agency = await prisma.agency.create({ data: { name: "Discovery integration", slug: `discovery-${suffix}` } });
    agencyId = agency.id;
    const client = await prisma.client.create({ data: { agencyId, name: "Discovery client" } });
    clientId = client.id;
    const content = await prisma.content.create({ data: { agencyId, clientId, originalUrl: "https://source.example/article", normalizedUrl: "https://source.example/article", dedupeHash: "e".repeat(64), platform: "GENERIC", contentType: "ARTICLE" } });
    contentId = content.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.statusHistory.deleteMany({ where: { agencyId } });
    await prisma.auditEvent.deleteMany({ where: { agencyId } });
    await prisma.agency.delete({ where: { id: agencyId } });
    await prisma.$disconnect();
  });

  it("enforces campaign item uniqueness and agency-scoped reads", async () => {
    const campaign = await prisma.discoveryCampaign.create({ data: { agencyId, clientId, name: "Editorial test", method: "EDITORIAL_REFERENCE", createdById: crypto.randomUUID() } });
    const item = await prisma.discoveryCampaignItem.create({ data: { agencyId, clientId, campaignId: campaign.id, contentId } });
    await expect(prisma.discoveryCampaignItem.create({ data: { agencyId, clientId, campaignId: campaign.id, contentId } })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.discoveryCampaignItem.findFirst({ where: { id: item.id, agencyId: crypto.randomUUID() } })).resolves.toBeNull();
  });
});
