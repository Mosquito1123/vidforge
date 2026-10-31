"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertCircle, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

type Mode = "email" | "phone";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations();
  const [mode, setMode] = React.useState<Mode>("email");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneCode, setPhoneCode] = React.useState("");
  const [codeSent, setCodeSent] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setFieldErrors({});
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = t("auth.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t("auth.invalidEmail");
    if (!password) errs.password = t("auth.passwordRequired");
    else if (password.length < 8) errs.password = t("auth.passwordRequired");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    const res = await api.register(email, password, name || undefined);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      toast({ title: t("auth.registrationFailed"), description: res.error, variant: "destructive" });
      return;
    }
    if (res.data?.verificationToken) {
      toast({ title: t("auth.accountCreated"), description: t("auth.accountCreated"), variant: "success" });
    } else {
      toast({ title: t("auth.accountCreated"), variant: "success" });
    }
    router.push("/dashboard");
  };

  const sendPhoneCode = async () => {
    setError(null);
    if (!phone.trim()) {
      setFieldErrors({ phone: t("phone.invalidPhone") });
      return;
    }
    setSending(true);
    const res = await api.sendPhoneCode(phone.trim(), "register");
    setSending(false);
    if (res.error) {
      setError(res.error);
      toast({ title: t("phone.sendFailed"), description: res.error, variant: "destructive" });
      return;
    }
    setCodeSent(true);
    setCooldown(res.data?.retryAfter ?? 60);
    if (res.data?.debugCode) {
      setPhoneCode(res.data.debugCode);
      toast({ title: t("phone.codeSent"), description: t("phone.debugCode", { code: res.data.debugCode }) });
    } else {
      toast({
        title: t("phone.codeSent"),
        description: t("phone.codeSentTo", { phone: res.data?.maskedPhone ?? phone }),
      });
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneCode.trim()) {
      setFieldErrors({ code: t("phone.codeRequired") });
      return;
    }
    setLoading(true);
    const res = await api.phoneRegister(phone.trim(), phoneCode.trim(), name || undefined);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      toast({ title: t("phone.registerFailed"), description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: t("auth.accountCreated"), variant: "success" });
    router.push("/dashboard");
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("auth.register")}</CardTitle>
          <CardDescription>{t("hero.subtitle")}</CardDescription>
        </CardHeader>

        <form onSubmit={mode === "email" ? handleEmailSubmit : handlePhoneSubmit}>
          <CardContent className="space-y-4">
            <SegmentedControl<Mode>
              ariaLabel={t("auth.loginMethod")}
              idBase="register-method"
              value={mode}
              onChange={switchMode}
              options={[
                {
                  value: "email",
                  label: t("phone.emailTab"),
                  icon: <Mail className="h-4 w-4" aria-hidden="true" />,
                },
                {
                  value: "phone",
                  label: t("phone.phoneTab"),
                  icon: <Smartphone className="h-4 w-4" aria-hidden="true" />,
                },
              ]}
            />

            <div
              role="alert"
              aria-live="polite"
              className={error ? "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2" : "sr-only"}
            >
              {error && (
                <>
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  <p className="text-sm text-destructive">{error}</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.name")} (optional)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {mode === "email" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                </div>
              </>
            ) : (
              <>
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
                  {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneCode">{t("phone.code")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phoneCode"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={t("phone.codePlaceholder")}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sendPhoneCode}
                      disabled={sending || cooldown > 0}
                      className="shrink-0"
                    >
                      {cooldown > 0
                        ? t("phone.resendIn", { seconds: cooldown })
                        : sending
                          ? t("phone.sending")
                          : codeSent
                            ? t("phone.resend")
                            : t("phone.sendCode")}
                    </Button>
                  </div>
                  {fieldErrors.code && <p className="text-xs text-destructive">{fieldErrors.code}</p>}
                </div>
                <p className="text-xs text-muted-foreground">{t("phone.registerHint")}</p>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t("common.loading")
                : mode === "phone"
                  ? t("phone.registerWithPhone")
                  : t("auth.register")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="text-primary hover:underline">
                {t("auth.loginLink")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
