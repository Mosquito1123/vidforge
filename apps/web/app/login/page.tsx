"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AlertCircle, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskChallenge, type RiskChallengeState } from "@/components/risk-challenge";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

type Mode = "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations();
  const [mode, setMode] = React.useState<Mode>("email");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneCode, setPhoneCode] = React.useState("");
  const [codeSent, setCodeSent] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mfaToken, setMfaToken] = React.useState<string | null>(null);
  const [mfaCode, setMfaCode] = React.useState("");
  const [challenge, setChallenge] = React.useState<RiskChallengeState | null>(null);
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
    setChallenge(null);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = t("auth.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t("auth.invalidEmail");
    if (!password) errs.password = t("auth.passwordRequired");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mfaToken) {
      if (!mfaCode.trim()) {
        setError(t("auth.mfaCodeRequired"));
        return;
      }
      setLoading(true);
      const { error } = await api.mfaVerify(mfaToken, mfaCode.trim());
      setLoading(false);
      if (error) {
        setError(error);
        toast({ title: t("auth.mfaFailed"), description: error, variant: "destructive" });
        return;
      }
      toast({ title: t("auth.welcomeBack"), variant: "success" });
      router.push("/dashboard");
      return;
    }
    if (!validate()) return;
    setLoading(true);
    const res = await api.login(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      toast({ title: t("auth.loginFailed"), description: res.error, variant: "destructive" });
      return;
    }
    if (res.data?.riskChallengeRequired && res.data.challengeToken) {
      setChallenge({
        challengeToken: res.data.challengeToken,
        maskedPhone: res.data.maskedPhone ?? null,
        debugCode: res.data.debugCode,
      });
      return;
    }
    if (res.data?.mfaRequired && res.data.mfaToken) {
      setMfaToken(res.data.mfaToken);
      toast({ title: t("auth.mfaRequired"), description: t("auth.enterAuthenticatorCode") });
      return;
    }
    toast({ title: t("auth.welcomeBack"), variant: "success" });
    router.push("/dashboard");
  };

  const sendPhoneCode = async () => {
    setError(null);
    if (!phone.trim()) {
      setFieldErrors({ phone: t("phone.invalidPhone") });
      return;
    }
    setSending(true);
    const res = await api.sendPhoneCode(phone.trim(), "login");
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
    const res = await api.phoneLogin(phone.trim(), phoneCode.trim());
    setLoading(false);
    if (res.error) {
      setError(res.error);
      toast({ title: t("phone.loginFailed"), description: res.error, variant: "destructive" });
      return;
    }
    const data = res.data;
    if (data?.riskChallengeRequired && data.challengeToken) {
      setChallenge({
        challengeToken: data.challengeToken,
        maskedPhone: data.maskedPhone ?? null,
        debugCode: data.debugCode,
      });
      return;
    }
    toast({ title: t("auth.welcomeBack"), variant: "success" });
    router.push("/dashboard");
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-2xl">{t("auth.welcomeBack")}</CardTitle>
          <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
        </CardHeader>

        {challenge ? (
          <CardContent>
            <RiskChallenge
              challenge={challenge}
              onVerified={() => router.push("/dashboard")}
              onCancel={() => setChallenge(null)}
            />
          </CardContent>
        ) : (
          <form onSubmit={mode === "email" ? handleEmailSubmit : handlePhoneSubmit}>
            <CardContent className="space-y-5">
              <SegmentedControl<Mode>
                ariaLabel={t("auth.loginMethod")}
                idBase="login-method"
                value={mode}
                onChange={switchMode}
                options={[
                  {
                    value: "email",
                    label: t("phone.emailTab"),
                    icon: <Mail className="h-4 w-4" aria-hidden="true" />,
                    panelId: "login-panel-email",
                  },
                  {
                    value: "phone",
                    label: t("phone.phoneTab"),
                    icon: <Smartphone className="h-4 w-4" aria-hidden="true" />,
                    panelId: "login-panel-phone",
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

              <div
                id={mode === "email" ? "login-panel-email" : "login-panel-phone"}
                role="tabpanel"
                aria-labelledby={`login-method-tab-${mode}`}
                className="space-y-4"
              >
                {mode === "email" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("auth.email")}</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <Label htmlFor="password">{t("auth.password")}</Label>
                        <Link
                          href="/forgot-password"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {t("auth.forgotPassword")}
                        </Link>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                    </div>
                    {mfaToken && (
                      <div className="space-y-2">
                        <Label htmlFor="mfaCode">{t("auth.authenticatorCode")}</Label>
                        <Input id="mfaCode" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} inputMode="numeric" />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("phone.phoneNumber")}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
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
                    <p className="text-xs text-muted-foreground">{t("phone.loginHint")}</p>
                  </>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-0">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? t("auth.loggingIn")
                  : mode === "phone"
                    ? t("phone.loginWithPhone")
                    : t("auth.login")}
              </Button>
              <p className="text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  {t("auth.signup")}
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
