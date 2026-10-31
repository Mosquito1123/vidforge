"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function AdminMetricsPage() {
  const [loading, setLoading] = React.useState(true);
  const [tasksByStatus, setTasksByStatus] = React.useState<Record<string, number>>({});
  const [paymentsByStatus, setPaymentsByStatus] = React.useState<Record<string, number>>({});
  const [refundsByStatus, setRefundsByStatus] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [tasks, payments, refunds] = await Promise.all([
        api.adminListTasks({ limit: 100 }),
        api.adminListPayments({ limit: 100 }),
        api.adminListRefunds({ limit: 100 }),
      ]);
      if (cancelled) return;
      const tb: Record<string, number> = {};
      for (const t of tasks.data?.items ?? []) tb[t.status] = (tb[t.status] ?? 0) + 1;
      const pb: Record<string, number> = {};
      for (const p of payments.data?.items ?? []) pb[p.status] = (pb[p.status] ?? 0) + 1;
      const rb: Record<string, number> = {};
      for (const r of refunds.data?.items ?? []) rb[r.status] = (rb[r.status] ?? 0) + 1;
      setTasksByStatus(tb);
      setPaymentsByStatus(pb);
      setRefundsByStatus(rb);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderBars = (title: string, data: Record<string, number>, color: string) => {
    const max = Math.max(1, ...Object.values(data));
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <div className="w-28 text-sm">{k}</div>
                <div className="flex-1 rounded bg-muted">
                  <div className={`h-6 rounded ${color}`} style={{ width: `${(v / max) * 100}%` }} />
                </div>
                <div className="w-10 text-right text-sm">{v}</div>
              </div>
            ))}
            {Object.keys(data).length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Metrics</h1>
      {renderBars("Tasks by Status", tasksByStatus, "bg-primary")}
      {renderBars("Payments by Status", paymentsByStatus, "bg-emerald-500")}
      {renderBars("Refunds by Status", refundsByStatus, "bg-amber-500")}
    </div>
  );
}