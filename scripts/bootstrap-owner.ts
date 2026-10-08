import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";

const input = z.object({
  agencyName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(12).max(256),
}).parse({
  agencyName: process.env.BOOTSTRAP_AGENCY_NAME,
  email: process.env.BOOTSTRAP_OWNER_EMAIL,
  password: process.env.BOOTSTRAP_OWNER_PASSWORD,
});

const slug = input.agencyName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
if (!slug) throw new Error("Agency name cannot produce a valid slug");

const passwordHash = await hashPassword(input.password);

await prisma.$transaction(async (tx) => {
  const agency = await tx.agency.create({ data: { name: input.agencyName, slug } });
  const user = await tx.user.create({ data: { email: input.email, passwordHash } });
  await tx.agencyMembership.create({ data: { agencyId: agency.id, userId: user.id, role: "OWNER" } });
  await tx.auditEvent.create({
    data: {
      agencyId: agency.id,
      actorType: "USER",
      actorUserId: user.id,
      action: "agency.bootstrap",
      targetType: "agency",
      targetId: agency.id,
      sanitizedData: { ownerEmail: input.email },
    },
  });
});

console.log("Agency owner created successfully.");
await prisma.$disconnect();
