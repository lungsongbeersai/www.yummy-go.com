import { AppShell } from "@/components/layout/web/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
