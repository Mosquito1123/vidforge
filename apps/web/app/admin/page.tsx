"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

type StatusCount = Record<string, number>;

export default function AdminOverviewPage() {
  const [loading, setLoading] = React.useState(true);
  const [usersTotal, setUsersTotal] = React.useState(0);
  const [bannedTotal, setBannedTotal] = React.useState(0);
  const [tasksTotal, setTasksTotal] = React.useState(0);
  const [tasksByStatus, setTasksByStatus] = React.useState<StatusCount>({});
  const [paymentsTotalCents, setPaymentsTotalCents] = React.useState(0);
  const [refundsPending, setRefundsPending] = React.useState(0);
  const [refundsTotal, setRefundsTotal] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [users, banned, tasks, payments, refunds, pendingRefunds] = await Promise.all([
        api.adminListUsers({ limit: 1 }),
        api.adminListUsers({ status: "banned", limit: 1 }),
        api.adminListTasks({ limit: 100 }),
        api.adminListPayments({ limit: 100 }),
        api.adminListRefunds({ limit: 1 }),
        api.adminListRefunds({ status: "pending", limit: 1 }),
      ]);
      if (cancelled) return;
      setUsersTotal(users.data?.total ?? 0);
      setBannedTotal(banned.data?.total ?? 0);
      setTasksTotal(tasks.data?.total ?? 0);
      const by: StatusCount = {};
      for (const t of tasks.data?.items ?? []) {
        by[t.status] = (by[t.status] ?? 0) + 1;
      }
      setTasksByStatus(by);
      setPaymentsTotalCents(
        (payments.data?.items ?? []).reduce((s, p) => s + (p.amountCents ?? 0), 0)
      );
      setRefundsTotal(refunds.data?.total ?? 0);
      setRefundsPending(pendingRefunds.data?.total ?? 0);
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

  const maxStatus = Math.max(1, ...Object.values(tasksByStatus));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{usersTotal}</div>
            <div className="text-xs text-muted-foreground">{bannedTotal} banned</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tasksTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Payments (recent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(paymentsTotalCents / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{refundsTotal}</div>
            <div className="text-xs text-muted-foreground">{refundsPending} pending</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(tasksByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className="w-28 text-sm">{status}</div>
                <div className="flex-1 rounded bg-muted">
                  <div
                    className="h-6 rounded bg-primary"
                    style={{ width: `${(count / maxStatus) * 100}%` }}
                  />
                </div>
                <div className="w-10 text-right text-sm">{count}</div>
              </div>
            ))}
            {Object.keys(tasksByStatus).length === 0 && (
              <p className="text-sm text-muted-foreground">No tasks</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}