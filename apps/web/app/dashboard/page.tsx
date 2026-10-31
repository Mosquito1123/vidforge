"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Film, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditsBadge } from "@/components/credits-badge";
import { ProgressBar } from "@/components/task-progress";
import type { TaskProgressMessage } from "@/lib/ws";
import { api, type ApiTask } from "@/lib/api";
import { AuthGuard } from "@/components/auth-guard";
import { toast } from "@/lib/toast";
import { useTaskProgress } from "@/components/task-progress";

function videoUrlFromTask(t: ApiTask): string | undefined {
  const out = t.output as Record<string, unknown> | null | undefined;
  if (!out) return undefined;
  return (
    (out.videoUrl as string) ||
    (out.url as string) ||
    (out.outputUrl as string) ||
    (out.resultUrl as string)
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "done") return "default";
  if (status === "failed" || status === "cancelled") return "destructive";
  if (status === "running" || status === "post_processing") return "secondary";
  return "outline";
}

export default function DashboardPage() {
  const tt = useTranslations();
  const [tasks, setTasks] = React.useState<ApiTask[]>([]);
  const [credits, setCredits] = React.useState<number | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const progressMap = useTaskProgress(userId);

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const [tasksRes, meRes] = await Promise.all([api.listTasks(), api.me()]);
    if (tasksRes.error) {
      setError(tasksRes.error);
      toast({ title: tt("dashboard.failedToLoad"), description: tasksRes.error, variant: "destructive" });
    } else if (tasksRes.data) {
      setTasks(tasksRes.data);
    }
    if (meRes.data) {
      setUserId(meRes.data.id);
      const cb = await api.creditsBalance();
      if (cb.data) setCredits(Number(cb.data.balance));
    }
    if (!silent) setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Merge WS progress updates into tasks list
  React.useEffect(() => {
    const updates = Object.values(progressMap) as TaskProgressMessage[];
    if (!updates.length) return;
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      let changed = false;
      for (const msg of updates) {
        const existing = map.get(msg.taskId);
        if (existing) {
          const updated: ApiTask = {
            ...existing,
            status: msg.status,
            progress: msg.progress,
            stage: msg.stage ?? existing.stage,
            output: (msg.output as Record<string, unknown> | null) ?? existing.output,
            error: msg.error ?? existing.error,
          };
          map.set(msg.taskId, updated);
          changed = true;
        }
      }
      return changed
        ? Array.from(map.values()).sort((a: ApiTask, b: ApiTask) =>
            String(b.createdAt).localeCompare(String(a.createdAt)),
          )
        : prev;
    });
  }, [progressMap]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
    toast({ title: tt("dashboard.refreshed"), variant: "success" });
  };

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tt("dashboard.title")}</h1>
          <p className="text-muted-foreground">{tt("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {credits !== null && <CreditsBadge credits={credits} />}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button asChild>
            <Link href="/generate">
              <Plus className="h-4 w-4" /> {tt("dashboard.generateVideo")}
            </Link>
          </Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Film className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{tt("dashboard.noTasks")}</p>
            <Button asChild className="mt-4">
              <Link href="/generate">{tt("dashboard.generateVideo")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((t) => {
            const url = videoUrlFromTask(t);
            return (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="line-clamp-2 text-base">
                    {(t.input?.prompt as string) || tt("dashboard.untitled")}
                  </CardTitle>
                  <CardDescription>
                    {t.model?.name || t.modelId || tt("tools.model")} · {new Date(t.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                      {(!!t.watermark || !!t.watermarked || !!t.output?.watermark || !!t.output?.watermarked) && (
                        <Badge variant="outline">Watermarked</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(t.progress ?? 0)}%</span>
                  </div>
                  <ProgressBar value={t.progress ?? 0} />
                  {t.stage && <p className="text-xs text-muted-foreground">{t.stage}</p>}
                  {t.error && <p className="text-xs text-destructive">{t.error}</p>}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Film className="h-4 w-4" /> {tt("dashboard.viewVideo")}
                    </a>
                  )}
                  {t.status === "failed" && (
                    <Button variant="outline" size="sm" onClick={() => toast({ title: tt("dashboard.retryNotImplemented") })}>
                      {tt("dashboard.retry")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}