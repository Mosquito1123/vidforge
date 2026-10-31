"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, type AdminUser } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Loader2, Search } from "lucide-react";

export default function AdminUsersPage() {
  const [items, setItems] = React.useState<AdminUser[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const [adjusting, setAdjusting] = React.useState<AdminUser | null>(null);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.adminListUsers({ search: search || undefined, status: status || undefined, page, limit });
    if (res.error) {
      toast({ title: "Failed to load users", description: res.error, variant: "destructive" });
    } else if (res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [search, status, page, limit]);

  React.useEffect(() => {
    load();
  }, [load]);

  const isBanned = (u: AdminUser) => !!(u.banned || u.isBanned);

  const handleBan = async (u: AdminUser) => {
    const r = window.prompt(`Ban reason for ${u.email}`) ?? "";
    const res = await api.adminBanUser(u.id, r);
    if (res.error) toast({ title: "Ban failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "User banned", variant: "success" });
      load();
    }
  };
  const handleUnban = async (u: AdminUser) => {
    const res = await api.adminUnbanUser(u.id);
    if (res.error) toast({ title: "Unban failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "User unbanned", variant: "success" });
      load();
    }
  };
  const submitAdjust = async () => {
    if (!adjusting) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await api.adminAdjustCredits(adjusting.id, amt, reason || undefined);
    setSaving(false);
    if (res.error) toast({ title: "Adjust failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Credits adjusted", variant: "success" });
      setAdjusting(null);
      setAmount("");
      setReason("");
      load();
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="email or name"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        <Button onClick={() => { setPage(1); load(); }}>Apply</Button>
      </div>

      {adjusting && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="font-medium">Adjust credits for {adjusting.email}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Amount (+/-)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="admin adjust" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={submitAdjust} disabled={saving}>
                {saving ? "Saving…" : "Apply"}
              </Button>
              <Button variant="outline" onClick={() => setAdjusting(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Balance</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.name || "—"}</td>
                  <td className="px-3 py-2">{u.role || (u.isAdmin ? "admin" : "user")}</td>
                  <td className="px-3 py-2">{u.creditAccount?.balance ?? "—"}</td>
                  <td className="px-3 py-2">
                    {isBanned(u) ? <Badge variant="destructive">banned</Badge> : <Badge variant="outline">active</Badge>}
                  </td>
                  <td className="px-3 py-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setAdjusting(u)}>
                        Credits
                      </Button>
                      {isBanned(u) ? (
                        <Button size="sm" variant="outline" onClick={() => handleUnban(u)}>
                          Unban
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => handleBan(u)}>
                          Ban
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No users
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