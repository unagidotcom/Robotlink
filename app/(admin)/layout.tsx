import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/dal/viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
