import { AuthGuard } from "@/components/layout/auth-guard";
import { ProtectedShell } from "@/components/layout/protected-shell";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthGuard>
  );
}
