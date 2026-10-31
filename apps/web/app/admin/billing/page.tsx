"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, type AdminPayment, type AdminRefund } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Loader2 } from "lucide-react";

export default function AdminBillingPage() {
  const [payments, setPayments] = React.useState<AdminPayment[]>([]);
  const [refunds, setRefunds] = React.useState<AdminRefund[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pPage, setPPage] = React.useState(1);
  const [rPage, setRPage] = React.useState(1);
  const [pTotal, setPTotal] = React.useState(0);
  const [rTotal, setRTotal] = React.useState(0);
  const limit = 20;

  const [paymentId, setPaymentId] = React.useState("");
  const [amountCents, setAmountCents] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");
  const [processing, setProcessing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [pr, rr] = await Promise.all([
      api.adminListPayments({ page: pPage, limit }),
      api.adminListRefunds({ page: rPage, limit }),
    ]);
    if (pr.error) toast({ title: "Payments failed", description: pr.error, variant: "destructive" });
    else if (pr.data) {
      setPayments(pr.data.items);
      setPTotal(pr.data.total);
    }
    if (rr.error) toast({ title: "Refunds failed", description: rr.error, variant: "destructive" });
    else if (rr.data) {
      setRefunds(rr.data.items);
      setRTotal(rr.data.total);
    }
    setLoading(false);
  }, [pPage, rPage]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleProcessRefund = async () => {
    if (!paymentId.trim()) {
      toast({ title: "Payment ID required", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const res = await api.adminProcessRefund({
      paymentId: paymentId.trim(),
      amountCents: amountCents ? Number(amountCents) : undefined,
      reason: refundReason || undefined,
    });
    setProcessing(false);
    if (res.error) toast({ title: "Process refund failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Refund processed", variant: "success" });
      setPaymentId("");
      setAmountCents("");
      setRefundReason("");
      load();
    }
  };

  const handleApprove = async (id: string) => {
    const res = await api.adminApproveRefund(id);
    if (res.error) toast({ title: "Approve failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Refund approved", variant: "success" });
      load();
    }
  };
  const handleReject = async (id: string) => {
    const r = window.prompt("Reject reason") ?? "";
    const res = await api.adminRejectRefund(id, r);
    if (res.error) toast({ title: "Reject failed", description: res.error, variant: "destructive" });
    else {
      toast({ title: "Refund rejected", variant: "success" });
      load();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Billing / Refunds</h1>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="font-medium">Process Refund</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Payment ID</Label>
              <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (cents, optional)</Label>
              <Input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleProcessRefund} disabled={processing}>
            {processing ? "Processing…" : "Process Refund"}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div>
            <h2 className="mb-2 text-lg font-semibold">Payments</h2>
            <div className="overflow-x-auto rounded border bg-background">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">{p.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{p.user?.email || p.user?.id || "—"}</td>
                      <td className="px-3 py-2">{p.type}</td>
                      <td className="px-3 py-2">{p.amountCents}</td>
                      <td className="px-3 py-2">
                        <Badge variant={p.status === "succeeded" ? "default" : "outline"}>{p.status}</Badge>
                      </td>
                      <td className="px-3 py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        No payments
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total {pTotal} · Page {pPage}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pPage <= 1} onClick={() => setPPage((x) => x - 1)}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" disabled={pPage * limit >= pTotal} onClick={() => setPPage((x) => x + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Refunds</h2>
            <div className="overflow-x-auto rounded border bg-background">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Payment</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Created</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">{r.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.payment?.id?.slice(0, 8) || "—"}</td>
                      <td className="px-3 py-2">{r.payment?.user?.email || "—"}</td>
                      <td className="px-3 py-2">{r.amountCents ?? r.payment?.amountCents ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === "succeeded" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleApprove(r.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(r.id)}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {refunds.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No refunds
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total {rTotal} · Page {rPage}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={rPage <= 1} onClick={() => setRPage((x) => x - 1)}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" disabled={rPage * limit >= rTotal} onClick={() => setRPage((x) => x + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}