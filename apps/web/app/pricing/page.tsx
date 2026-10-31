"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type Plan } from "@/lib/api";
import { getToken } from "@/lib/api";
import { toast } from "@/lib/toast";
import { toRMB } from "@/lib/utils";

const mockPlans: Plan[] = [
  { id: "starter", name: "Starter", price: "$9", credits: "100 credits", priceCents: 900, creditsAmount: 100, features: ["100 credits/mo", "720p output", "Watermark-free", "Email support"] },
  { id: "pro", name: "Pro", price: "$29", credits: "500 credits", priceCents: 2900, creditsAmount: 500, features: ["500 credits/mo", "1080p output", "Priority queue", "Commercial use"], highlight: true },
  { id: "studio", name: "Studio", price: "$99", credits: "2500 credits", priceCents: 9900, creditsAmount: 2500, features: ["2500 credits/mo", "4K output", "Dedicated support", "API access"] },
];

function planPrice(p: Plan): string {
  if (p.price) return p.price;
  if (typeof p.priceCents === "number") return `$${(p.priceCents / 100).toFixed(0)}`;
  return "$0";
}

function planCredits(p: Plan): string {
  if (p.credits) return p.credits;
  if (typeof p.creditsAmount === "number") return `${p.creditsAmount} credits`;
  return "";
}

function planFeatures(p: Plan): string[] {
  if (Array.isArray(p.features)) return p.features;
  return [];
}

export default function PricingPage() {
  const t = useTranslations();
  const [plans, setPlans] = React.useState<Plan[]>(mockPlans);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [checkingOut, setCheckingOut] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await api.listPlans();
      if (!mounted) return;
      if (data && data.length) {
        const normalized = data.map((p) => ({
          ...p,
          price: p.price || (typeof p.priceCents === "number" ? `$${(p.priceCents / 100).toFixed(0)}` : p.price),
          credits: p.credits || (typeof p.creditsAmount === "number" ? `${p.creditsAmount} credits` : p.credits),
          features: Array.isArray(p.features) ? p.features : [],
        }));
        setPlans(normalized);
      } else {
        setPlans(mockPlans);
        if (err && err !== "No plans endpoint") {
          setError(err);
          toast({ title: t("pricing.couldNotLoad"), description: err, variant: "destructive" });
        }
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCheckout = async (plan: Plan) => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    setCheckingOut(plan.id);
    const { data, error: err } = await api.createCheckout({
      type: "subscription",
      planId: plan.id,
      provider: "stripe",
    });
    setCheckingOut(null);
    if (err || !data) {
      toast({ title: t("pricing.checkoutFailed"), description: err || t("common.error"), variant: "destructive" });
      return;
    }
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      toast({ title: t("pricing.checkoutCreated"), description: data.message || t("pricing.noRedirect"), variant: "default" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">{t("pricing.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <p className="mb-4 text-center text-sm text-destructive">{error}</p>}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id || p.name} className={p.highlight ? "border-primary shadow-lg" : ""}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{planCredits(p)}</CardDescription>
              <div className="mt-2 text-4xl font-bold">{planPrice(p)}<span className="text-base font-normal text-muted-foreground">/mo</span></div>
              {typeof p.priceCents === "number" && (
                <div className="text-sm text-muted-foreground">{toRMB(p.priceCents)}/月</div>
              )}
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {planFeatures(p).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={p.highlight ? "default" : "outline"}
                disabled={checkingOut === p.id}
                onClick={() => handleCheckout(p)}
              >
                {checkingOut === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("pricing.subscribe")}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}