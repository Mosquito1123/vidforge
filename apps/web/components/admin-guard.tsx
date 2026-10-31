"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { api } from "@/lib/api";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await api.adminListUsers({ limit: 1 });
      if (cancelled) return;
      if (res.error) {
        // Not admin or unauthorized
        router.replace("/dashboard");
        return;
      }
      setReady(true);
      setChecking(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {checking ? "Checking admin access…" : "Redirecting…"}
        </div>
      </div>
    );
  }
  return <>{children}</>;
}