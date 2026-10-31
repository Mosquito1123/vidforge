import { AdminGuard } from "@/components/admin-guard";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/models", label: "Models" },
  { href: "/admin/billing", label: "Billing / Refunds" },
  { href: "/admin/audit", label: "Audit Logs" },
  { href: "/admin/metrics", label: "Metrics" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-muted/30">
        <div className="flex">
          <aside className="hidden w-56 shrink-0 border-r bg-background md:block">
            <div className="p-4 text-lg font-bold">Admin</div>
            <nav className="space-y-1 px-2">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="p-4">
              <a href="/dashboard" className="text-xs text-muted-foreground hover:underline">
                ← Back to app
              </a>
            </div>
          </aside>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}