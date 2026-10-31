"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type KycRecord, type KycStatus, type KycStatusResponse } from "@/lib/api";
import { toast } from "@/lib/toast";

const STATUS_VARIANT: Record<KycStatus, "default" | "secondary" | "destructive" | "outline"> = {
  unverified: "outline",
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
};

export default function KycPage() {
  const t = useTranslations();
  const [state, setState] = React.useState<KycStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [realName, setRealName] = React.useState("");
  const [idNumber, setIdNumber] = React.useState("");
  const [frontUrl, setFrontUrl] = React.useState("");
  const [backUrl, setBackUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.kycStatus();
    if (res.error) {
      toast({ title: t("kyc.loadFailed"), description: res.error, variant: "destructive" });
    } else if (res.data) {
      setState(res.data);
    }
    setLoading(false);
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  const status: KycStatus = state?.status ?? "unverified";
  const record: KycRecord | null = state?.record ?? null;

  // The form is only offered when the identity is not already verified.
  const formVisible = status !== "verified" && (showForm || status === "unverified" || status === "rejected");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = realName.trim();
    const id = idNumber.trim().toUpperCase();

    if (name.length < 2) {
      toast({ title: t("kyc.nameInvalid"), variant: "destructive" });
      return;
    }
    if (!/^\d{17}[\dX]$/.test(id)) {
      toast({ title: t("kyc.idNumberInvalid"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const res = await api.submitKyc({
      realName: name,
      idNumber: id,
      documentType: "id_card",
      idCardFrontUrl: frontUrl.trim() || null,
      idCardBackUrl: backUrl.trim() || null,
    });
    setSubmitting(false);

    if (res.error) {
      toast({ title: t("kyc.submitFailed"), description: res.error, variant: "destructive" });
      return;
    }

    if (res.data) {
      setState({ status: res.data.status, record: res.data });
      if (res.data.status === "verified") {
        toast({ title: t("kyc.verifiedToast"), variant: "success" });
      } else {
        toast({ title: t("kyc.rejectedToast"), description: res.data.rejectionReason ?? undefined, variant: "destructive" });
      }
    }
    setRealName("");
    setIdNumber("");
    setFrontUrl("");
    setBackUrl("");
    setShowForm(false);
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8">{t("common.loading")}</div>;
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{t("kyc.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("kyc.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("kyc.statusTitle")}
            <Badge variant={STATUS_VARIANT[status]}>{t(`kyc.status.${status}`)}</Badge>
          </CardTitle>
          <CardDescription>{t(`kyc.statusDescription.${status}`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {record && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t("kyc.realName")}</dt>
                <dd className="font-medium">{record.maskedRealName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("kyc.idNumber")}</dt>
                <dd className="font-medium">{record.maskedIdNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("kyc.submittedAt")}</dt>
                <dd>{new Date(record.submittedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("kyc.verifiedAt")}</dt>
                <dd>{record.verifiedAt ? new Date(record.verifiedAt).toLocaleString() : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("kyc.age")}</dt>
                <dd>{record.age !== null ? `${record.age}` : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("kyc.provider")}</dt>
                <dd>{record.provider}</dd>
              </div>
            </dl>
          )}

          {record?.status === "rejected" && record.rejectionReason && (
            <p className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {t("kyc.rejectionReason", { reason: record.rejectionReason })}
            </p>
          )}

          {status === "verified" && <p className="text-sm text-muted-foreground">{t("kyc.alreadyVerified")}</p>}

          {status !== "verified" && !showForm && (
            <Button onClick={() => setShowForm(true)}>
              {status === "rejected" ? t("kyc.resubmit") : t("kyc.start")}
            </Button>
          )}
          {status === "pending" && !showForm && (
            <p className="text-sm text-muted-foreground">{t("kyc.pendingHint")}</p>
          )}
        </CardContent>
      </Card>

      {formVisible && (
        <Card>
          <CardHeader>
            <CardTitle>{t("kyc.formTitle")}</CardTitle>
            <CardDescription>{t("kyc.formDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="realName">{t("kyc.realName")}</Label>
                <Input
                  id="realName"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder={t("kyc.realNamePlaceholder")}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idNumber">{t("kyc.idNumber")}</Label>
                <Input
                  id="idNumber"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                  placeholder={t("kyc.idNumberPlaceholder")}
                  inputMode="numeric"
                  maxLength={18}
                  autoComplete="off"
                  required
                />
                <p className="text-xs text-muted-foreground">{t("kyc.idNumberHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frontUrl">{t("kyc.frontUrl")}</Label>
                <Input
                  id="frontUrl"
                  value={frontUrl}
                  onChange={(e) => setFrontUrl(e.target.value)}
                  placeholder="https://"
                  type="url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backUrl">{t("kyc.backUrl")}</Label>
                <Input
                  id="backUrl"
                  value={backUrl}
                  onChange={(e) => setBackUrl(e.target.value)}
                  placeholder="https://"
                  type="url"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("kyc.privacyNote")}</p>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? t("kyc.submitting") : t("kyc.submit")}
                </Button>
                {showForm && status !== "unverified" && (
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
                    {t("common.cancel")}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 text-sm">
        <Link href="/account" className="text-primary hover:underline">
          {t("kyc.backToAccount")}
        </Link>
        <Link href="/account/phone" className="text-primary hover:underline">
          {t("kyc.phoneSettings")}
        </Link>
      </div>
    </div>
  );
}
