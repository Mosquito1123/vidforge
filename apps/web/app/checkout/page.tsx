"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, QrCode, CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type CreditPackage, type Plan } from "@/lib/api";
import { getToken } from "@/lib/api";
import { toast } from "@/lib/toast";
import { toRMB } from "@/lib/utils";

type Provider = "stripe" | "alipay" | "wechat";

export default function CheckoutPage() {
  const [loading, setLoading] = React.useState(true);
  const [packages, setPackages] = React.useState<CreditPackage[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [provider, setProvider] = React.useState<Provider>("alipay");
  const [selectedPkg, setSelectedPkg] = React.useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("pending");
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    (async () => {
      const [pkgRes, planRes] = await Promise.all([api.listCreditPackages(), api.listPlans()]);
      if (pkgRes.data) setPackages(pkgRes.data);
      if (planRes.data) setPlans(planRes.data);
      setLoading(false);
    })();
  }, []);

  // status polling
  React.useEffect(() => {
    if (!paymentId) return;
    if (status === "succeeded" || status === "failed" || status === "refunded") return;
    const timer = setInterval(async () => {
      const res = await api.getPayment(paymentId);
      if (res.data) {
        setStatus(res.data.status || "pending");
        const md = (res.data as { metadata?: Record<string, unknown> | null }).metadata;
        if (md && typeof md.qrCode === "string") setQrCode((prev) => (prev ? prev : (md.qrCode as string)));
        if (res.data.status === "succeeded") {
          toast({ title: "Payment succeeded", variant: "success" });
        }
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [paymentId, status]);

  const startCheckout = async () => {
    setActing(true);
    setMessage(null);
    try {
      let payload: Record<string, unknown> = { provider };
      if (selectedPkg) {
        payload = { ...payload, type: "credit_purchase", packageId: selectedPkg };
      } else if (selectedPlan) {
        payload = { ...payload, type: "subscription", planId: selectedPlan };
      } else {
        toast({ title: "Select a package or plan", variant: "destructive" });
        setActing(false);
        return;
      }

      const { data, error } = await api.createCheckout(payload);
      if (error || !data) {
        toast({ title: "Checkout failed", description: error || "Unknown error", variant: "destructive" });
        setActing(false);
        return;
      }
      if (data.paymentId) setPaymentId(data.paymentId);
      if (data.qrCode) setQrCode(data.qrCode);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setStatus(data.status || "pending");
      setMessage(data.message || null);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>Select how you want to pay</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(["alipay", "wechat", "stripe"] as Provider[]).map((p) => (
            <Button
              key={p}
              variant={provider === p ? "default" : "outline"}
              onClick={() => setProvider(p)}
            >
              {p === "alipay" ? "Alipay" : p === "wechat" ? "WeChat Pay" : "Stripe"}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit packages</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {packages.length === 0 && <p className="text-sm text-muted-foreground">No packages</p>}
          {packages.map((pkg) => (
            <Button
              key={pkg.id}
              variant={selectedPkg === pkg.id ? "default" : "outline"}
              onClick={() => {
                setSelectedPkg(pkg.id);
                setSelectedPlan(null);
              }}
            >
              {pkg.name} — {pkg.credits} credits — ${(pkg.priceCents / 100).toFixed(2)} ({toRMB(pkg.priceCents)})
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription plans</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {plans.length === 0 && <p className="text-sm text-muted-foreground">No plans</p>}
          {plans.map((p) => (
            <Button
              key={p.id}
              variant={selectedPlan === p.id ? "default" : "outline"}
              onClick={() => {
                setSelectedPlan(p.id);
                setSelectedPkg(null);
              }}
            >
              {p.name} — {p.credits || p.creditsAmount} credits
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={acting} onClick={startCheckout}>
          {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Pay with {provider === "alipay" ? "Alipay" : provider === "wechat" ? "WeChat" : "Stripe"}
        </Button>
        {paymentId && <Badge variant="outline">Status: {status}</Badge>}
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {qrCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" /> Scan to pay
            </CardTitle>
            <CardDescription>Status: {status}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCode)}`}
              alt="Payment QR code"
              width={256}
              height={256}
            />
            <p className="text-xs text-muted-foreground break-all">{qrCode}</p>
            <p className="text-sm">Polling payment status…</p>
          </CardContent>
        </Card>
      )}

      {status === "succeeded" && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-lg font-semibold text-green-600">Payment succeeded</p>
            <Link href="/billing" className="text-primary hover:underline text-sm">
              Back to billing
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
