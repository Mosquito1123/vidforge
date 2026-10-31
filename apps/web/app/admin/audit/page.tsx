"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AdminAuditLog } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";

export default function AdminAuditPage() {
  const [items, setItems] = React.useState<AdminAuditLog[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(30);
  const [userId, setUserId] = React.useState("");
  const [action, setAction] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.adminListAuditLogs({
      userId: userId || undefined,
      action: action || undefined,
      page,
      limit,
    });
    if (res.error) toast({ title: "Failed to load audit logs", description: res.error, variant: "destructive" });
    else if (res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [userId, action, page, limit]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">User ID</Label>
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="user.ban" />
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
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="px-3 py-2">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{a.user?.email || a.userId || "—"}</td>
                  <td className="px-3 py-2">{a.action}</td>
                  <td className="px-3 py-2">
                    {a.targetType || "—"} {a.targetId ? `#${String(a.targetId).slice(0, 8)}` : ""}
                  </td>
                  <td className="px-3 py-2">{a.ip || "—"}</td>
                  <td className="px-3 py-2">
                    <pre className="max-w-xs overflow-auto text-xs">
                      {JSON.stringify(a.metadata ?? a.details ?? null)}
                    </pre>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No audit logs
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