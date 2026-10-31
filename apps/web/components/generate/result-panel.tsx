"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Download,
  Film,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPlayer } from "@/components/video-player";
import { BeforeAfter } from "@/components/before-after";
import { ProgressBar } from "@/components/task-progress";
import { toast } from "@/lib/toast";
import type { ApiTask } from "@/lib/api";

const STAGES = ["queued", "running", "post_processing", "done"] as const;
const KNOWN_STATUS = [...STAGES, "failed", "cancelled", "blocked"] as const;

function statusLabel(t: (key: string) => string, status: string) {
  return (KNOWN_STATUS as readonly string[]).includes(status)
    ? t(`generate.status.${status}`)
    : status;
}

function stageIndex(task: ApiTask | null) {
  if (!task) return -1;
  if (task.status === "failed" || task.status === "cancelled" || task.status === "blocked") return -1;
  const index = STAGES.indexOf(task.status as (typeof STAGES)[number]);
  return index === -1 ? 0 : index;
}

export function ResultPanel({
  task,
  videoUrl,
  beforeUrl,
  beforeType = "image",
  onCancel,
  onRetry,
  busy = false,
}: {
  task: ApiTask | null;
  videoUrl?: string;
  beforeUrl?: string | null;
  beforeType?: "image" | "video";
  onCancel?: () => void;
  onRetry?: () => void;
  busy?: boolean;
}) {
  const t = useTranslations();
  const activeIndex = stageIndex(task);
  const running = Boolean(task && ["queued", "running", "post_processing"].includes(task.status));
  const failed = task?.status === "failed" || task?.status === "cancelled";

  const moderation =
    task?.moderation ||
    (task?.output as Record<string, unknown> | null)?.["moderation"] ||
    ((task?.output as Record<string, unknown> | null)?.["metadata"] as Record<string, unknown> | undefined)?.[
      "moderation"
    ];

  const watermarked = Boolean(
    task?.watermark || task?.watermarked || task?.output?.["watermark"] || task?.output?.["watermarked"],
  );

  const download = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${task?.id ?? "vidforge"}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("generate.downloadFailed"), variant: "destructive" });
    }
  };

  const copyLink = async () => {
    if (!videoUrl) return;
    try {
      await navigator.clipboard.writeText(videoUrl);
      toast({ title: t("generate.linkCopied") });
    } catch {
      toast({ title: t("generate.copyFailed"), variant: "destructive" });
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{t("tools.preview")}</CardTitle>
        {task && (
          <Badge variant={failed ? "destructive" : running ? "secondary" : "outline"} className="gap-1">
            {running && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {task.status === "done" && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
            {failed && <XCircle className="h-3 w-3" aria-hidden="true" />}
            {statusLabel(t, task.status)}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!task && (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 text-center">
            <Film className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{t("generate.emptyPreviewTitle")}</p>
              <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">{t("generate.emptyPreviewHint")}</p>
            </div>
          </div>
        )}

        {task && (
          <>
            <ol className="flex items-center gap-1" aria-label={t("generate.stagesLabel")}>
              {STAGES.map((stage, index) => {
                const done = task.status === "done" ? index <= 3 : activeIndex > index;
                const current = activeIndex === index && task.status !== "done";
                return (
                  <li key={stage} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className={cn(
                        "h-1.5 w-full rounded-full transition-colors",
                        done || current ? "bg-primary" : "bg-muted",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[11px]",
                        current ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {t(`generate.stage.${stage}`)}
                    </span>
                  </li>
                );
              })}
            </ol>

            {running && (
              <div className="space-y-1.5">
                <ProgressBar value={task.progress ?? 0} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Math.round(task.progress ?? 0)}%</span>
                  {onCancel && (
                    <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
                      {t("generate.cancel")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {failed && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-destructive">{t("generate.failedTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.error || t("generate.failedHint")}
                  </p>
                </div>
              </div>
            )}

            {videoUrl && (
              <div className="space-y-2">
                <VideoPlayer src={videoUrl} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={download}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t("generate.download")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    {t("generate.copyLink")}
                  </Button>
                  {onRetry && (
                    <Button size="sm" variant="ghost" onClick={onRetry} disabled={busy}>
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      {t("generate.regenerate")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {watermarked && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                <span>{t("generate.watermarkNotice")}</span>
                <Link href="/pricing" className="ml-auto font-medium text-primary hover:underline">
                  {t("generate.upgradeToRemove")}
                </Link>
              </div>
            )}

            {moderation && moderation !== "approved" && (
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="destructive">{t("generate.moderationBlocked")}</Badge>
                <Link href="/report-abuse" className="text-primary underline">
                  {t("generate.appeal")}
                </Link>
              </div>
            )}

            {videoUrl && beforeUrl && (
              <BeforeAfter
                before={beforeUrl}
                after={videoUrl}
                beforeType={beforeType}
                afterType="video"
                beforeLabel={t("generate.before")}
                afterLabel={t("generate.after")}
              />
            )}

            {task.status === "done" && (
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href="/dashboard">{t("generate.viewInDashboard")}</Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
