"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiTask } from "@/lib/api";

const STATUS_TONE: Record<string, string> = {
  done: "bg-emerald-500",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground",
  blocked: "bg-amber-500",
  queued: "bg-sky-500",
  running: "bg-sky-500",
  post_processing: "bg-sky-500",
};

const KNOWN_STATUS = ["queued", "running", "post_processing", "done", "failed", "cancelled", "blocked"];

function statusLabel(t: (key: string) => string, status: string) {
  return KNOWN_STATUS.includes(status) ? t(`generate.status.${status}`) : status;
}

export function RecentRuns({
  tasks,
  onSelect,
  activeId,
}: {
  tasks: ApiTask[];
  onSelect: (task: ApiTask) => void;
  activeId?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const formatAgo = (iso: string) => {
    const diff = Math.round((new Date(iso).getTime() - now) / 60000);
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (Math.abs(diff) < 60) return formatter.format(diff, "minute");
    return formatter.format(Math.round(diff / 60), "hour");
  };

  const TOOL_KEY: Record<string, string> = {
    "video-edit": "edit",
    "watermark-removal": "watermark",
    voiceover: "voiceover",
  };

  const titleFor = (task: ApiTask) => {
    const prompt = task.input?.["prompt"];
    if (typeof prompt === "string" && prompt.trim()) return prompt;
    const toolKey = task.tool ? TOOL_KEY[task.tool] : undefined;
    return toolKey ? t(`toolsPage.cards.${toolKey}.title`) : t("generate.untitledPrompt");
  };

  const subtitleFor = (task: ApiTask) => {
    const modelName = task.model?.name;
    if (modelName) return modelName;
    const toolKey = task.tool ? TOOL_KEY[task.tool] : undefined;
    return toolKey ? t(`toolsPage.cards.${toolKey}.title`) : t("generate.unknownModel");
  };

  if (!tasks.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t("generate.recentRuns")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelect(task)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              task.id === activeId ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_TONE[task.status] ?? "bg-muted-foreground")}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{titleFor(task)}</span>
              <span className="text-xs text-muted-foreground">
                {subtitleFor(task)} · {formatAgo(task.createdAt)}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{statusLabel(t, task.status)}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
