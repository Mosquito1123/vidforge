"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, CreditCard, Receipt, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, type Subscription, type Invoice, type Payment, type CreditPackage, type AutoRefillSettings } from "@/lib/api";
import { getToken } from "@/lib/api";
import { toast } from "@/lib/toast";
import { toRMB } from "@/lib/utils";

export default function BillingPage() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [packages, setPackages] = React.useState<CreditPackage[]>([]);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);
  const [autoRefill, setAutoRefill] = React.useState<AutoRefillSettings>({ enabled: false, threshold: 0, amount: 0, packageId: null });
  const [savingAuto, setSavingAuto] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [subRes, invRes, payRes, pkgRes, balRes, arRes] = await Promise.all([
      api.getSubscription(),
      api.listInvoices(),
      api.listPayments(),
      api.listCreditPackages(),
      api.creditsBalance(),
      api.getAutoRefillSettings(),
    ]);
    if (subRes.data) setSubscription(subRes.data);
    if (invRes.data) setInvoices(invRes.data);
    if (payRes.data) setPayments(payRes.data);
    if (pkgRes.data) setPackages(pkgRes.data);
    if (balRes.data) setBalance(Number(balRes.data.balance));
    if (arRes.data) setAutoRefill(arRes.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    load();
  }, [load]);

  const buyCredits = async (pkg: CreditPackage) => {
    setActing(pkg.id);
    const { data, error } = await api.createCheckout({
      type: "credit_purchase",
      packageId: pkg.id,
      provider: "stripe",
    });
    setActing(null);
    if (error || !data) {
      toast({ title: t("billing.checkoutFailed"), description: error || t("common.error"), variant: "destructive" });
      return;
    }
    if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    else toast({ title: t("pricing.checkoutCreated"), description: data.message || t("pricing.noRedirect") });
  };

  const buyCustomCredits = async () => {
    const input = window.prompt(t("billing.howManyCredits"), "500");
    if (!input) return;
    const credits = Number(input);
    if (!Number.isFinite(credits) || credits <= 0) return;
    setActing("custom");
    const { data, error } = await api.createCheckout({
      type: "credit_purchase",
      credits,
      amountCents: Math.round(credits),
      provider: "stripe",
    });
    setActing(null);
    if (error || !data) {
      toast({ title: t("billing.checkoutFailed"), description: error || t("common.error"), variant: "destructive" });
      return;
    }
    if (data.checkoutUrl) window.location.href = data.checkoutUrl;
  };

  const cancelSub = async () => {
    if (!confirm(t("billing.cancelAtPeriodEnd"))) return;
    setActing("cancel");
    const { data, error } = await api.cancelSubscription();
    setActing(null);
    if (error) {
      toast({ title: t("billing.cancelFailed"), description: error, variant: "destructive" });
      return;
    }
    setSubscription(data);
    toast({ title: t("billing.subscriptionCanceled"), variant: "success" });
  };

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("billing.title")}</h1>
          <p className="text-muted-foreground">{t("billing.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Credits balance */}
      <Card>
        <CardHeader>
          <CardTitle>{t("billing.credits")}</CardTitle>
          <CardDescription>{t("billing.currentBalance", { balance: balance !== null ? balance : "—" })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {packages.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("billing.noPackages")}</p>
          )}
          {packages.map((pkg) => (
            <Button
              key={pkg.id}
              variant="outline"
              disabled={acting === pkg.id}
              onClick={() => buyCredits(pkg)}
            >
              {acting === pkg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              {pkg.name} — {pkg.credits} credits — ${(pkg.priceCents / 100).toFixed(2)} ({toRMB(pkg.priceCents)})
            </Button>
          ))}
          <Button variant="secondary" disabled={acting === "custom"} onClick={buyCustomCredits}>
            {acting === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {t("billing.buyCustomCredits")}
          </Button>
        </CardContent>
      </Card>

      {/* Auto-refill */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-refill credits</CardTitle>
          <CardDescription>
            Automatically purchase credits when balance drops below threshold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!autoRefill.enabled}
              onChange={(e) => setAutoRefill((s) => ({ ...s, enabled: e.target.checked }))}
            />
            <Label>Enabled</Label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Threshold (credits)</Label>
              <Input
                type="number"
                value={autoRefill.threshold}
                onChange={(e) => setAutoRefill((s) => ({ ...s, threshold: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Refill amount (credits)</Label>
              <Input
                type="number"
                value={autoRefill.amount}
                onChange={(e) => setAutoRefill((s) => ({ ...s, amount: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={savingAuto}
              onClick={async () => {
                setSavingAuto(true);
                const res = await api.updateAutoRefillSettings(autoRefill);
                setSavingAuto(false);
                if (res.error) {
                  toast({ title: "Save failed", description: res.error, variant: "destructive" });
                  return;
                }
                if (res.data) setAutoRefill(res.data);
                toast({ title: "Auto-refill settings saved", variant: "success" });
              }}
            >
              {savingAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const res = await api.runAutoRefill();
                if (res.error) {
                  toast({ title: "Auto-refill failed", description: res.error, variant: "destructive" });
                  return;
                }
                toast({ title: "Auto-refill triggered", variant: "success" });
                load();
              }}
            >
              Run now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coupons & invites */}
      <Card>
        <CardHeader>
          <CardTitle>Coupons & invite codes</CardTitle>
          <CardDescription>Redeem a coupon or invite code for credits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CouponRedeem />
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>{t("billing.subscription")}</CardTitle>
          <CardDescription>
            {subscription ? `${subscription.status}` : t("billing.noActiveSubscription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscription ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{subscription.status}</Badge>
                {subscription.cancelAtPeriodEnd && <Badge variant="outline">{t("billing.cancelsAtPeriodEnd")}</Badge>}
              </div>
              {subscription.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  {t("billing.currentPeriodEnds", { date: new Date(subscription.currentPeriodEnd).toLocaleDateString() })}
                </p>
              )}
              {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
                <Button variant="destructive" size="sm" disabled={acting === "cancel"} onClick={cancelSub}>
                  {acting === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("billing.cancelSubscription")}
                </Button>
              )}
            </>
          ) : (
            <Link href="/pricing" className="text-sm text-primary hover:underline">
              {t("billing.viewPlans")}
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>{t("billing.invoices")}</CardTitle>
          <CardDescription>{t("billing.invoiceCount", { count: invoices.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("billing.noInvoices")}</p>
          ) : (
            <ul className="divide-y">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span>{inv.number}</span>
                    <Badge variant="outline">{inv.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>${(inv.amountCents / 100).toFixed(2)}</span>
                    {inv.hostedUrl && (
                      <a href={inv.hostedUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {t("billing.view")}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>{t("billing.paymentHistory")}</CardTitle>
          <CardDescription>{t("billing.paymentCount", { count: payments.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("billing.noPayments")}</p>
          ) : (
            <ul className="divide-y">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{p.type}</span>
                    <Badge variant={p.status === "succeeded" ? "default" : "outline"}>{p.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>${(p.amountCents / 100).toFixed(2)}</span>
                    <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function CouponRedeem() {
  const [code, setCode] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const redeem = async (kind: "coupon" | "invite") => {
    if (!code.trim()) return;
    setActing(true);
    try {
      const res =
        kind === "coupon"
          ? await api.redeemCoupon(code.trim())
          : await api.redeemInviteCode(code.trim());
      if (res.error) {
        toast({ title: "Redeem failed", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Redeemed", variant: "success" });
      setCode("");
    } finally {
      setActing(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" />
      <Button disabled={acting} onClick={() => redeem("coupon")}>Redeem coupon</Button>
      <Button variant="outline" disabled={acting} onClick={() => redeem("invite")}>Redeem invite</Button>
    </div>
  );
}
