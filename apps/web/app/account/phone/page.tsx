"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type PhoneBindingStatus } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function PhoneSettingsPage() {
  const t = useTranslations();
  const [status, setStatus] = React.useState<PhoneBindingStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  const [unbindOpen, setUnbindOpen] = React.useState(false);
  const [unbindCode, setUnbindCode] = React.useState("");
  const [unbindSent, setUnbindSent] = React.useState(false);
  const [unbinding, setUnbinding] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.phoneStatus();
    if (res.data) setStatus(res.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (!phone.trim()) {
      toast({ title: t("phone.invalidPhone"), variant: "destructive" });
      return;
    }
    setSending(true);
    const res = await api.sendPhoneCode(phone.trim(), "bind");
    setSending(false);
    if (res.error) {
      toast({ title: t("phone.sendFailed"), description: res.error, variant: "destructive" });
      return;
    }
    setCooldown(res.data?.retryAfter ?? 60);
    if (res.data?.debugCode) {
      setCode(res.data.debugCode);
      toast({ title: t("phone.codeSent"), description: t("phone.debugCode", { code: res.data.debugCode }) });
    } else {
      toast({ title: t("phone.codeSent"), description: res.data?.maskedPhone ?? phone });
    }
  };

  const bind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: t("phone.codeRequired"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const res = await api.bindPhone(phone.trim(), code.trim());
    setSubmitting(false);
    if (res.error) {
      toast({ title: t("phone.bindFailed"), description: res.error, variant: "destructive" });
      return;
    }
    setStatus(res.data);
    setPhone("");
    setCode("");
    toast({ title: t("phone.bound"), variant: "success" });
  };

  const sendUnbindCode = async () => {
    setUnbindSent(true);
    const res = await api.sendUnbindCode();
    if (res.error) {
      setUnbindSent(false);
      toast({ title: t("phone.sendFailed"), description: res.error, variant: "destructive" });
      return;
    }
    if (res.data?.debugCode) {
      setUnbindCode(res.data.debugCode);
      toast({ title: t("phone.codeSent"), description: t("phone.debugCode", { code: res.data.debugCode }) });
    } else {
      toast({ title: t("phone.codeSent"), description: t("phone.unbindCodeSent") });
    }
  };

  const unbind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unbindCode.trim()) {
      toast({ title: t("phone.codeRequired"), variant: "destructive" });
      return;
    }
    setUnbinding(true);
    const res = await api.unbindPhone(unbindCode.trim());
    setUnbinding(false);
    if (res.error) {
      toast({ title: t("phone.unbindFailed"), description: res.error, variant: "destructive" });
      return;
    }
    setUnbindOpen(false);
    setUnbindCode("");
    setUnbindSent(false);
    toast({ title: t("phone.unbound"), variant: "success" });
    load();
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8">{t("common.loading")}</div>;
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{t("phone.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("phone.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("phone.bindingTitle")}</CardTitle>
          <CardDescription>{t("phone.bindingDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.bound ? (
            <>
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">{status.maskedPhone ?? status.phone}</p>
                <p className="text-xs text-muted-foreground">
                  {t("phone.verifiedAt")}:{" "}
                  {status.verifiedAt ? new Date(status.verifiedAt).toLocaleString() : "-"}
                </p>
              </div>
              {!unbindOpen ? (
                <Button variant="outline" onClick={() => setUnbindOpen(true)}>
                  {t("phone.unbind")}
                </Button>
              ) : (
                <form onSubmit={unbind} className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("phone.unbindDescription")}</p>
                  {!unbindSent ? (
                    <Button type="button" variant="outline" onClick={sendUnbindCode}>
                      {t("phone.sendCode")}
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="unbindCode">{t("phone.code")}</Label>
                        <Input
                          id="unbindCode"
                          value={unbindCode}
                          onChange={(e) => setUnbindCode(e.target.value)}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" variant="destructive" disabled={unbinding}>
                          {unbinding ? t("phone.unbinding") : t("phone.confirmUnbind")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setUnbindOpen(false);
                            setUnbindSent(false);
                            setUnbindCode("");
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </>
          ) : (
            <form onSubmit={bind} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone.phoneNumber")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder={t("phone.phonePlaceholder")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">{t("phone.code")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t("phone.codePlaceholder")}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendCode}
                    disabled={sending || cooldown > 0}
                    className="shrink-0"
                  >
                    {cooldown > 0
                      ? t("phone.resendIn", { seconds: cooldown })
                      : sending
                        ? t("phone.sending")
                        : t("phone.sendCode")}
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? t("phone.binding") : t("phone.bind")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4 text-sm">
        <Link href="/account" className="text-primary hover:underline">
          {t("phone.backToAccount")}
        </Link>
        <Link href="/account/kyc" className="text-primary hover:underline">
          {t("kyc.title")}
        </Link>
      </div>
    </div>
  );
}
