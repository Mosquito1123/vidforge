"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type ApiUser, type LoginAuditEntry, type Session } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function AccountPage() {
  const t = useTranslations();
  const [user, setUser] = React.useState<ApiUser | null>(null);
  const [name, setName] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [locale, setLocale] = React.useState("en");
  const [saving, setSaving] = React.useState(false);

  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [mfaSecret, setMfaSecret] = React.useState<string | null>(null);
  const [mfaOtpauth, setMfaOtpauth] = React.useState<string | null>(null);
  const [mfaCode, setMfaCode] = React.useState("");
  const [mfaLoading, setMfaLoading] = React.useState(false);

  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [audit, setAudit] = React.useState<LoginAuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const me = await api.me();
    if (me.data) {
      setUser(me.data);
      setName(me.data.name || "");
      setAvatarUrl(me.data.avatarUrl || "");
      setBio(me.data.bio || "");
      setLocale(me.data.locale || "en");
      setMfaEnabled(!!me.data.mfaEnabled);
    }
    const ms = await api.mfaStatus();
    if (ms.data) setMfaEnabled(ms.data.mfaEnabled);
    const ss = await api.listSessions();
    if (ss.data) setSessions(ss.data);
    const la = await api.loginAudit();
    if (la.data) setAudit(la.data.slice(0, 5));
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async () => {
    setSaving(true);
    const res = await api.updateMe({ name, avatarUrl: avatarUrl || undefined, bio: bio || undefined, locale });
    setSaving(false);
    if (res.error) {
      toast({ title: t("account.saveFailed"), description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: t("account.profileUpdated"), variant: "success" });
    if (res.data) setUser(res.data);
  };

  const startMfa = async () => {
    setMfaLoading(true);
    const res = await api.mfaSetup();
    setMfaLoading(false);
    if (res.error || !res.data) {
      toast({ title: t("account.mfaSetupFailed"), description: res.error || t("common.error"), variant: "destructive" });
      return;
    }
    setMfaSecret(res.data.secret);
    setMfaOtpauth(res.data.otpauthUrl);
  };

  const enableMfa = async () => {
    if (!mfaCode.trim()) return;
    setMfaLoading(true);
    const res = await api.mfaEnable(mfaCode.trim());
    setMfaLoading(false);
    if (res.error) {
      toast({ title: t("account.enableFailed"), description: res.error, variant: "destructive" });
      return;
    }
    setMfaEnabled(true);
    setMfaSecret(null);
    setMfaOtpauth(null);
    setMfaCode("");
    toast({ title: t("account.mfaEnabled"), variant: "success" });
  };

  const disableMfa = async () => {
    if (!mfaCode.trim()) return;
    setMfaLoading(true);
    const res = await api.mfaDisable(mfaCode.trim());
    setMfaLoading(false);
    if (res.error) {
      toast({ title: t("account.disableFailed"), description: res.error, variant: "destructive" });
      return;
    }
    setMfaEnabled(false);
    setMfaCode("");
    toast({ title: t("account.mfaDisabled"), variant: "success" });
  };

  const revokeSession = async (id: string) => {
    const res = await api.revokeSession(id);
    if (res.error) {
      toast({ title: t("account.revokeFailed"), description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: t("account.sessionRevoked"), variant: "success" });
    load();
  };

  if (loading) return <div className="container mx-auto px-4 py-8">{t("account.loading")}</div>;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">{t("account.title")}</h1>
      {user && (
        <p className="text-sm text-muted-foreground">
          {user.email} {user.emailVerified ? t("common.verified") : t("common.unverified")}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("account.security")}</CardTitle>
          <CardDescription>{t("account.securityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded border p-3 text-sm">
            <div>
              <p className="font-medium">{t("account.phoneTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("account.phoneDescription")}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/account/phone">{t("account.manage")}</Link>
            </Button>
          </div>
          <div className="flex items-center justify-between rounded border p-3 text-sm">
            <div>
              <p className="font-medium">{t("account.kycTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("account.kycDescription")}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/account/kyc">{t("account.manage")}</Link>
            </Button>
          </div>
          {audit.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("account.recentLogins")}</p>
              {audit.map((entry) => (
                <div key={entry.id} className="rounded border p-2 text-xs">
                  <p className="font-medium">
                    {entry.method} · {entry.result}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {entry.ipMasked || "unknown IP"} · {new Date(entry.createdAt).toLocaleString()} ·{" "}
                    {t("account.riskScore", { score: entry.riskScore, level: entry.riskLevel })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.profile")}</CardTitle>
          <CardDescription>{t("account.updateDetails")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("account.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("account.avatarUrl")}</Label>
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("account.bio")}</Label>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("account.locale")}</Label>
            <Input value={locale} onChange={(e) => setLocale(e.target.value)} />
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? t("common.saving") : t("account.saveProfile")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.mfa")}</CardTitle>
          <CardDescription>{t("account.mfaDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{t("account.status", { status: mfaEnabled ? t("account.enabled") : t("account.disabled") })}</p>
          {!mfaEnabled && !mfaSecret && (
            <Button onClick={startMfa} disabled={mfaLoading}>
              {mfaLoading ? t("account.starting") : t("account.setupMfa")}
            </Button>
          )}
          {mfaSecret && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("account.secret", { secret: mfaSecret })}</p>
              {mfaOtpauth && <p className="break-all text-xs text-muted-foreground">{mfaOtpauth}</p>}
              <Input
                placeholder={t("account.enterCode")}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              <Button onClick={enableMfa} disabled={mfaLoading}>
                {mfaLoading ? t("account.enabling") : t("account.enableMfa")}
              </Button>
            </div>
          )}
          {mfaEnabled && (
            <div className="space-y-2">
              <Input
                placeholder={t("account.enterCodeToDisable")}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              <Button variant="destructive" onClick={disableMfa} disabled={mfaLoading}>
                {mfaLoading ? t("account.disabling") : t("account.disableMfa")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.sessions")}</CardTitle>
          <CardDescription>{t("account.manageSessions")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 && <p className="text-sm text-muted-foreground">{t("account.noSessions")}</p>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border p-3 text-sm">
              <div>
                <p className="font-medium">{s.userAgent || "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.ipAddress || "unknown IP"} · {new Date(s.createdAt).toLocaleString()}
                  {s.current ? " · current" : ""}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="outline" onClick={() => revokeSession(s.id)}>
                  {t("account.revoke")}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
