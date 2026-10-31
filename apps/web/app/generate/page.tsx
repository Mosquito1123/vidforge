"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Coins, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { Upload } from "@/components/upload";
import { PromptComposer } from "@/components/generate/prompt-composer";
import { ResultPanel } from "@/components/generate/result-panel";
import { RecentRuns } from "@/components/generate/recent-runs";
import {
  AdvancedOptions,
  AspectPicker,
  DurationPicker,
  ModelPicker,
  type AdvancedValues,
} from "@/components/generate/option-controls";
import { CreditsBadge } from "@/components/credits-badge";
import { api, type ApiModel, type ApiTask } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useTaskProgress } from "@/components/task-progress";

const MAX_PROMPT = 1000;

export default function GeneratePage() {
  const router = useRouter();
  const t = useTranslations();

  const [prompt, setPrompt] = React.useState("");
  const [duration, setDuration] = React.useState("5");
  const [aspect, setAspect] = React.useState("16:9");
  const [file, setFile] = React.useState<File | null>(null);
  const [advanced, setAdvanced] = React.useState<AdvancedValues>({
    negativePrompt: "",
    seed: "",
    resolution: "auto",
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [promptError, setPromptError] = React.useState<string | null>(null);

  const [models, setModels] = React.useState<ApiModel[]>([]);
  const [modelId, setModelId] = React.useState("");
  const [credits, setCredits] = React.useState<number | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);

  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [task, setTask] = React.useState<ApiTask | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | undefined>();
  const [recent, setRecent] = React.useState<ApiTask[]>([]);
  const [filePreview, setFilePreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const progressMap = useTaskProgress(userId);
  const selectedModel = models.find((model) => model.id === modelId) ?? null;
  const cost = Number(selectedModel?.creditsCost ?? 0);
  const insufficient = credits !== null && cost > 0 && credits < cost;

  const refreshCredits = React.useCallback(() => {
    api.creditsBalance().then((res) => {
      if (!res.data) return;
      const balance = Number(res.data.balance);
      setCredits(balance);
      // Let the header (and any other surface) stay in sync without a reload.
      window.dispatchEvent(new CustomEvent("vidforge:credits", { detail: balance }));
    });
  }, []);

  const refreshRecent = React.useCallback(() => {
    api.listTasks().then((res) => {
      if (res.data) setRecent(res.data.slice(0, 5));
    });
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const meRes = await api.me();
      if (!mounted) return;
      if (meRes.error || !meRes.data) {
        toast({ title: t("generate.pleaseLogin"), description: t("auth.authRequired"), variant: "destructive" });
        router.push("/login");
        return;
      }
      setUserId(meRes.data.id);

      const [cb, mRes] = await Promise.all([api.creditsBalance(), api.listModels()]);
      if (cb.data) setCredits(Number(cb.data.balance));

      if (mRes.data?.length) {
        const videoModels = mRes.data.filter((m) => m.type === "VIDEO" && m.active);
        const list = videoModels.length ? videoModels : mRes.data.filter((m) => m.active);
        setModels(list);

        let initial = list[0]?.id ?? "";
        try {
          const wanted = new URLSearchParams(window.location.search).get("model");
          const found = wanted ? list.find((m) => m.id === wanted || m.slug === wanted) : undefined;
          if (found) initial = found.id;
        } catch {
          // ignore malformed query strings
        }
        setModelId(initial);
      }

      refreshRecent();
    })();
    return () => {
      mounted = false;
    };
  }, [router, t, refreshRecent]);

  // Sync task progress from the WebSocket stream.
  React.useEffect(() => {
    if (!taskId) return;
    const message = progressMap[taskId];
    if (!message) return;

    setTask((prev) => ({
      ...(prev ?? ({ id: taskId, status: message.status, progress: message.progress } as ApiTask)),
      id: taskId,
      status: message.status,
      progress: message.progress,
      stage: message.stage ?? prev?.stage ?? null,
      output: (message.output as Record<string, unknown>) ?? prev?.output ?? null,
      error: message.error ?? prev?.error ?? null,
    }));

    if (message.status === "done") {
      const output = message.output as Record<string, unknown> | undefined;
      const url =
        (output?.videoUrl as string) || (output?.url as string) || (output?.outputUrl as string);
      if (url) setVideoUrl(url);
      toast({ title: t("generate.generationComplete"), variant: "success" });
      refreshCredits();
      refreshRecent();
    }
    if (message.status === "failed") {
      toast({
        title: t("generate.generationFailed"),
        description: message.error || t("common.error"),
        variant: "destructive",
      });
      refreshCredits();
      refreshRecent();
    }
  }, [progressMap, taskId, t, refreshCredits, refreshRecent]);

  // Polling fallback: covers reconnects and browsers where the socket is blocked.
  React.useEffect(() => {
    if (!taskId) return;
    if (!task || !["queued", "running", "post_processing"].includes(task.status)) return;

    const timer = window.setInterval(async () => {
      const { data } = await api.getTask(taskId);
      if (!data) return;
      setTask(data);
      const output = data.output ?? undefined;
      const url =
        (output?.videoUrl as string) || (output?.url as string) || (output?.outputUrl as string);
      if (url) setVideoUrl(url);
      if (["done", "failed", "cancelled"].includes(data.status)) {
        refreshCredits();
        refreshRecent();
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [taskId, task, refreshCredits, refreshRecent]);

  const validate = () => {
    if (!prompt.trim()) {
      setPromptError(t("generate.promptRequired"));
      return false;
    }
    if (prompt.length > MAX_PROMPT) {
      setPromptError(t("generate.promptTooLong"));
      return false;
    }
    if (!modelId) {
      setError(t("generate.selectModel"));
      return false;
    }
    setPromptError(null);
    return true;
  };

  const handleGenerate = async () => {
    setError(null);
    if (!validate()) return;
    if (insufficient) {
      toast({ title: t("generate.insufficientCredits"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    let imageUrl: string | undefined;
    if (file) {
      const { data, error: uploadError } = await api.uploadFile(file);
      if (uploadError) {
        setSubmitting(false);
        setError(uploadError);
        toast({ title: t("generate.uploadFailed"), description: uploadError, variant: "destructive" });
        return;
      }
      imageUrl = (data as { url?: string } | null)?.url;
    }

    const input: Record<string, unknown> = {
      prompt,
      durationSeconds: Number(duration),
      aspectRatio: aspect,
      imageUrl,
    };
    if (advanced.negativePrompt.trim()) input.negativePrompt = advanced.negativePrompt.trim();
    if (advanced.seed) input.seed = Number(advanced.seed);
    if (advanced.resolution !== "auto") input.resolution = advanced.resolution;

    const { data, error: apiError } = await api.createTask({
      modelId,
      input,
      priority: "normal",
    });
    setSubmitting(false);

    if (apiError || !data) {
      setError(apiError || t("generate.failedToStart"));
      toast({ title: t("generate.failedToStart"), description: apiError || undefined, variant: "destructive" });
      return;
    }

    setVideoUrl(undefined);
    setTaskId(data.id);
    setTask(data);
    setRecent((prev) => [data, ...prev].slice(0, 5));
    refreshCredits();
    toast({ title: t("generate.generationStarted"), variant: "success" });
  };

  const handleCancel = async () => {
    if (!taskId) return;
    setCancelling(true);
    const { data, error: cancelError } = await api.cancelTask(taskId);
    setCancelling(false);
    if (cancelError) {
      toast({ title: t("common.error"), description: cancelError, variant: "destructive" });
      return;
    }
    if (data) setTask(data);
    toast({ title: t("generate.cancelled") });
    refreshCredits();
  };

  const selectRecent = (next: ApiTask) => {
    setTaskId(next.id);
    setTask(next);
    const output = next.output ?? {};
    const url =
      (output.videoUrl as string) || (output.url as string) || (output.outputUrl as string);
    setVideoUrl(url);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("generate.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("generate.subtitle")}</p>
        </div>
        {credits !== null && <CreditsBadge credits={credits} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("generate.promptSection")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PromptComposer
                value={prompt}
                onChange={(value) => {
                  setPrompt(value);
                  if (promptError) setPromptError(null);
                }}
                onSubmit={handleGenerate}
                loading={submitting}
                disabled={insufficient}
                error={promptError ?? undefined}
                maxLength={MAX_PROMPT}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("generate.options")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>{t("tools.model")}</Label>
                <ModelPicker models={models} value={modelId} onChange={setModelId} disabled={submitting} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("tools.duration")}</Label>
                  <DurationPicker value={duration} onChange={setDuration} disabled={submitting} />
                </div>
                <div className="space-y-2">
                  <Label>{t("tools.aspectRatio")}</Label>
                  <AspectPicker value={aspect} onChange={setAspect} disabled={submitting} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("tools.referenceImage")}</Label>
                <Upload onFileSelect={setFile} disabled={submitting} />
              </div>

              <AdvancedOptions values={advanced} onChange={setAdvanced} disabled={submitting} />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{t("generate.estimatedCost")}</span>
                <span className="inline-flex items-center gap-1 text-lg font-semibold tabular-nums">
                  <Coins className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {cost}
                </span>
              </div>

              <dl className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <dt>{t("tools.model")}</dt>
                  <dd className="max-w-[60%] truncate text-foreground">{selectedModel?.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("tools.duration")}</dt>
                  <dd className="text-foreground">{duration}s</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("tools.aspectRatio")}</dt>
                  <dd className="text-foreground">{aspect}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("generate.balanceAfter")}</dt>
                  <dd className="text-foreground">
                    {credits === null ? "—" : Math.max(credits - cost, 0)}
                  </dd>
                </div>
              </dl>

              {insufficient ? (
                <div className="space-y-2">
                  <p className="text-xs text-destructive">{t("generate.insufficientCredits")}</p>
                  <Button asChild className="w-full">
                    <Link href="/billing">{t("generate.topUp")}</Link>
                  </Button>
                </div>
              ) : (
                <Button
                  className="hidden w-full sm:inline-flex"
                  onClick={handleGenerate}
                  disabled={submitting || !prompt.trim()}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {submitting ? t("generate.generating") : t("generate.generate")}
                </Button>
              )}
            </CardContent>
          </Card>

          <ResultPanel
            task={task}
            videoUrl={videoUrl}
            beforeUrl={filePreview}
            beforeType={file?.type?.startsWith("video") ? "video" : "image"}
            onCancel={handleCancel}
            onRetry={handleGenerate}
            busy={cancelling || submitting}
          />

          <RecentRuns tasks={recent} onSelect={selectRecent} activeId={taskId} />
        </div>
      </div>
    </div>
  );
}
