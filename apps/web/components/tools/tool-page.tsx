"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditsBadge } from "@/components/credits-badge";
import { ResultPanel } from "@/components/generate/result-panel";
import { RecentRuns } from "@/components/generate/recent-runs";
import { useToolTask } from "@/components/tools/use-tool-task";
import { api } from "@/lib/api";

/**
 * Shared chrome for the `/tools/*` pages: page header, two-column layout,
 * credit summary + submit card, result panel and recent runs.
 */
export function ToolPage({
  tool,
  title,
  subtitle,
  cost,
  canSubmit,
  buildInput,
  children,
  summary,
}: {
  tool: string;
  title: string;
  subtitle: string;
  cost: number;
  canSubmit: boolean;
  buildInput: () => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  children: React.ReactNode;
  summary?: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { credits, submitting, task, taskId, recent, submit, cancel, pickRecent, refreshRecent } = useToolTask();

  React.useEffect(() => {
    api.me().then((res) => {
      if (!res.data) router.push("/login");
    });
  }, [router]);

  React.useEffect(() => {
    refreshRecent(tool);
  }, [tool, refreshRecent]);

  const videoUrl = React.useMemo(() => {
    const output = task?.output ?? undefined;
    if (!output) return undefined;
    return (output.videoUrl as string) || (output.url as string) || (output.outputUrl as string);
  }, [task]);

  const estimatedAfter = credits === null ? null : Math.max(credits - cost, 0);
  const insufficient = credits !== null && credits < cost;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {credits !== null && <CreditsBadge credits={credits} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-6">{children}</div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{t("toolsPage.cost")}</span>
                <span className="inline-flex items-center gap-1 text-lg font-semibold tabular-nums">
                  <Coins className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {cost}
                </span>
              </div>

              {summary && <div className="space-y-1 text-xs text-muted-foreground">{summary}</div>}

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("toolsPage.balanceAfter")}</span>
                <span className="text-foreground">{estimatedAfter ?? "—"}</span>
              </div>

              {insufficient ? (
                <div className="space-y-2">
                  <p className="text-xs text-destructive">{t("generate.insufficientCredits")}</p>
                  <Button className="w-full" onClick={() => router.push("/billing")}>
                    {t("generate.topUp")}
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={async () => {
                    const input = await buildInput();
                    if (!input) return;
                    await submit({ tool, input, cost });
                  }}
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? t("toolsPage.submitting") : t("toolsPage.run")}
                </Button>
              )}
            </CardContent>
          </Card>

          <ResultPanel
            task={task}
            videoUrl={videoUrl}
            onCancel={cancel}
            busy={submitting}
          />

          <RecentRuns tasks={recent} onSelect={pickRecent} activeId={taskId} />
        </div>
      </div>
    </div>
  );
}

export function ToolSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
