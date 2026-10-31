"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, type AdminTask } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";

export default function AdminTasksPage() {
  const [items, setItems] = React.useState<AdminTask[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(20);
  const [status, setStatus] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.adminListTasks({
      status: status || undefined,
      userId: userId || undefined,
      page,
      limit,
    });
    if (res.error) toast({ title: "Failed to load tasks", description: res.error, variant: "destructive" });
    else if (res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [status, userId, page, limit]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRetry = async (id: string) => {
    const res = await api.adminRetryTask(id);
    if (res.error) toast({ title: "Retry failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Task retried", variant: "success" });
      load();
    }
  };
  const handleCancel = async (id: string) => {
    const res = await api.adminCancelTask(id);
    if (res.error) toast({ title: "Cancel failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Task cancelled", variant: "success" });
      load();
    }
  };

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "done") return "default";
    if (s === "failed" || s === "cancelled") return "destructive";
    if (s === "running" || s === "post_processing") return "secondary";
    return "outline";
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Tasks</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="failed / running" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">User ID</Label>
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user id" />
        </div>
        <Button onClick={() => { setPage(1); load(); }}>Apply</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Model</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Progress</th>
                <th className="px-3 py-2 text-left">Moderation</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="px-3 py-2 font-mono text-xs">{t.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{t.user?.email || t.userId || "—"}</td>
                  <td className="px-3 py-2">{t.model?.name || t.modelId || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="px-3 py-2">{Math.round(t.progress ?? 0)}%</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const m = (t as any).moderation || (t.output as any)?.moderation || (t.output as any)?.metadata?.moderation || "—";
                      return <Badge variant={m === "approved" || m === "—" ? "outline" : "destructive"}>{String(m)}</Badge>;
                    })()}
                    {(((t as any).moderation || (t.output as any)?.moderation || (t.output as any)?.metadata?.moderation) &&
                      ((t as any).moderation || (t.output as any)?.moderation || (t.output as any)?.metadata?.moderation) !== "approved") && (
                      <a href="/report-abuse" className="ml-2 text-xs text-primary underline">Appeal</a>
                    )}
                  </td>
                  <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleRetry(t.id)}>
                        Retry
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCancel(t.id)}>
                        Cancel
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No tasks
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Total {total} · Page {page}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * limit >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}