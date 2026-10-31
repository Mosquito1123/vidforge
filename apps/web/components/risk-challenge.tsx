"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export type RiskChallengeState = {
  challengeToken: string;
  maskedPhone?: string | null;
  debugCode?: string;
};

type Props = {
  challenge: RiskChallengeState;
  onVerified: () => void;
  onCancel?: () => void;
};

/**
 * Suspicious-login challenge: the API holds the session until the user proves
 * control of the phone bound to the account.
 */
export function RiskChallenge({ challenge, onVerified, onCancel }: Props) {
  const t = useTranslations();
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(60);

  React.useEffect(() => {
    if (challenge.debugCode) {
      setCode(challenge.debugCode);
      toast({ title: t("risk.demoCode"), description: challenge.debugCode });
    }
  }, [challenge.debugCode, t]);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError(t("risk.codeRequired"));
      return;
    }
    setLoading(true);
    const res = await api.verifyRiskChallenge(challenge.challengeToken, code.trim());
    setLoading(false);
    if (res.error || res.data?.riskChallengeRequired) {
      const message = res.error || t("risk.failed");
      setError(message);
      toast({ title: t("risk.failed"), description: message, variant: "destructive" });
      return;
    }
    toast({ title: t("risk.verified"), variant: "success" });
    onVerified();
  };

  const resend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setError(null);
    const res = await api.resendRiskChallenge(challenge.challengeToken);
    setResending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSecondsLeft(60);
    if (res.data?.debugCode) {
      setCode(res.data.debugCode);
      toast({ title: t("risk.demoCode"), description: res.data.debugCode });
    } else {
      toast({ title: t("risk.resent"), description: res.data?.maskedPhone ?? challenge.maskedPhone ?? "" });
    }
  };

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("risk.challengeRequired")}</p>
        <p className="text-sm text-muted-foreground">
          {t("risk.description", { phone: challenge.maskedPhone || t("risk.yourPhone") })}
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="risk-code">{t("risk.code")}</Label>
        <Input
          id="risk-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t("risk.codePlaceholder")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? t("risk.verifying") : t("risk.verify")}
        </Button>
        <Button type="button" variant="outline" onClick={resend} disabled={secondsLeft > 0 || resending}>
          {secondsLeft > 0
            ? t("risk.resendIn", { seconds: secondsLeft })
            : resending
              ? t("risk.resending")
              : t("risk.resend")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("risk.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
