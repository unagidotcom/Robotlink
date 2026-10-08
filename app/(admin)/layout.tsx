import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/dal/viewer";
import { getEnv } from "@/lib/env";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer} workersEnabled={getEnv().WORKERS_ENABLED}>{children}</AppShell>;
}
