import { prisma } from "@/lib/prisma";
import { getInspectionConfig } from "@/lib/inspection/config";
import { inspectUrl } from "@/lib/inspection/http-inspector";
import { claimInspectionJob, finishInspection, recoverExpiredLeases } from "@/lib/inspection/queue";

const config = getInspectionConfig(); let stopping = false;
process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });

async function run() {
  while (!stopping) {
    await recoverExpiredLeases();
    const job = await claimInspectionJob(config.INSPECTION_WORKER_ID, config);
    if (!job) { await new Promise((resolve) => setTimeout(resolve, config.INSPECTION_POLL_MS)); continue; }
    const content = await prisma.content.findFirst({ where: { id: job.contentId, agencyId: job.agencyId, clientId: job.clientId }, select: { normalizedUrl: true } });
    if (!content) continue;
    const result = await inspectUrl(content.normalizedUrl, config);
    await finishInspection(job, result, config);
  }
}

run().catch((error) => { console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
