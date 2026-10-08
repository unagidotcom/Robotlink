import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/dal/viewer";
import { prisma } from "@/lib/prisma";
import { buildCsv } from "@/lib/imports/csv";

export async function GET(_request: Request, context: RouteContext<"/api/imports/[id]/rejections">) {
  const { id } = await context.params; const viewer = await requireViewer();
  const batch = await prisma.importBatch.findFirst({ where: { id, agencyId: viewer.agencyId }, include: { rows: { where: { status: { in: ["REJECTED", "DUPLICATE"] } }, orderBy: { rowNumber: "asc" } } } });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const csv = buildCsv([["row", "status", "reason", "data"], ...batch.rows.map((row) => [String(row.rowNumber), row.status, row.rejectionReason ?? "", JSON.stringify(row.rawData)])]);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${batch.id}-rejections.csv"`, "cache-control": "private, no-store" } });
}
