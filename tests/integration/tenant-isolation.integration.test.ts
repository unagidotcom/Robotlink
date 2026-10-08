import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_DATABASE_INTEGRATION === "true" && Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!enabled)("PostgreSQL tenant isolation integration", () => {
  let prisma: import("@prisma/client").PrismaClient;
  const suffix = crypto.randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.agency.deleteMany({ where: { slug: { startsWith: `integration-${suffix}` } } });
    await prisma.$disconnect();
  });

  it("keeps identically named clients isolated by agency", async () => {
    const first = await prisma.agency.create({ data: { name: "Integration A", slug: `integration-${suffix}-a` } });
    const second = await prisma.agency.create({ data: { name: "Integration B", slug: `integration-${suffix}-b` } });
    await prisma.client.createMany({ data: [
      { agencyId: first.id, name: "Shared client name" },
      { agencyId: second.id, name: "Shared client name" },
    ] });
    const visible = await prisma.client.findMany({ where: { agencyId: first.id } });
    expect(visible).toHaveLength(1);
    expect(visible[0]?.agencyId).toBe(first.id);
  });

  it("denies cross-agency content lookup", async () => {
    const first = await prisma.agency.create({ data: { name: "Isolation A", slug: `integration-${suffix}-content-a` } });
    const second = await prisma.agency.create({ data: { name: "Isolation B", slug: `integration-${suffix}-content-b` } });
    const firstClient = await prisma.client.create({ data: { agencyId: first.id, name: "First" } });
    const content = await prisma.content.create({ data: { agencyId: first.id, clientId: firstClient.id, originalUrl: "https://example.com/a", normalizedUrl: "https://example.com/a", dedupeHash: "a".repeat(64), platform: "GENERIC", contentType: "OTHER" } });
    const leaked = await prisma.content.findFirst({ where: { id: content.id, agencyId: second.id } });
    expect(leaked).toBeNull();
  });

  it("rejects revoked, expired, and disabled-user sessions", async () => {
    const agency = await prisma.agency.create({ data: { name: "Sessions", slug: `integration-${suffix}-sessions` } });
    const user = await prisma.user.create({ data: { email: `sessions-${suffix}@example.com`, passwordHash: "integration-only" } });
    await prisma.agencyMembership.create({ data: { agencyId: agency.id, userId: user.id, role: "OWNER" } });
    const { getUserForSessionToken, hashSessionToken } = await import("@/lib/auth/session");
    const create = (token: string, data: { expiresAt: Date; endedAt?: Date }) => prisma.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(token), ...data } });
    await create("revoked-token", { expiresAt: new Date(Date.now() + 60_000), endedAt: new Date() });
    await create("expired-token", { expiresAt: new Date(Date.now() - 60_000) });
    expect(await getUserForSessionToken("revoked-token")).toBeNull();
    expect(await getUserForSessionToken("expired-token")).toBeNull();
    const active = "active-disabled-token";
    await create(active, { expiresAt: new Date(Date.now() + 60_000) });
    await prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    expect(await getUserForSessionToken(active)).toBeNull();
  });

  it("enforces URL uniqueness within a client but permits the same URL across clients", async () => {
    const agency = await prisma.agency.create({ data: { name: "Uniqueness", slug: `integration-${suffix}-uniqueness` } });
    const [first, second] = await Promise.all([
      prisma.client.create({ data: { agencyId: agency.id, name: "Client One" } }),
      prisma.client.create({ data: { agencyId: agency.id, name: "Client Two" } }),
    ]);
    const content = { agencyId: agency.id, originalUrl: "https://example.com/shared", normalizedUrl: "https://example.com/shared", dedupeHash: "b".repeat(64), platform: "GENERIC" as const, contentType: "OTHER" as const };
    await prisma.content.create({ data: { ...content, clientId: first.id } });
    await expect(prisma.content.create({ data: { ...content, clientId: first.id } })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.content.create({ data: { ...content, clientId: second.id } })).resolves.toMatchObject({ clientId: second.id });
  });

  it("rolls back an import transaction when a row operation fails", async () => {
    const agency = await prisma.agency.create({ data: { name: "Transactions", slug: `integration-${suffix}-transactions` } });
    const client = await prisma.client.create({ data: { agencyId: agency.id, name: "Transaction Client" } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.importBatch.create({ data: {
        agencyId: agency.id, clientId: client.id, idempotencyKey: "c".repeat(64), originalFilename: "transaction.csv", createdById: crypto.randomUUID(),
      } });
      throw new Error("intentional rollback");
    })).rejects.toThrow("intentional rollback");
    await expect(prisma.importBatch.count({ where: { agencyId: agency.id } })).resolves.toBe(0);
  });
});
