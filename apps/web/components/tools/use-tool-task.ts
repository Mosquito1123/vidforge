"use client";

import * as React from "react";
import { api, type ApiTask } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useTaskProgress } from "@/components/task-progress";

type SubmitOptions = {
  tool: string;
  input: Record<string, unknown>;
  cost: number;
};

/**
 * Shared state machine for the `/tools/*` pages: credit guard, submission,
 * live progress (WebSocket + polling fallback), cancel and recent runs.
 */
export function useToolTask({ onEvent }: { onEvent?: (task: ApiTask) => void } = {}) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [credits, setCredits] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [task, setTask] = React.useState<ApiTask | null>(null);
  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<ApiTask[]>([]);

  const progressMap = useTaskProgress(userId);
  const activeToolRef = React.useRef<string>("generate");

  const refreshCredits = React.useCallback(() => {
    api.creditsBalance().then((res) => {
      if (!res.data) return;
      const balance = Number(res.data.balance);
      setCredits(balance);
      window.dispatchEvent(new CustomEvent("vidforge:credits", { detail: balance }));
    });
  }, []);

  const refreshRecent = React.useCallback((tool: string) => {
    api.listTasks().then((res) => {
      if (!res.data) return;
      const filtered = res.data.filter((item) => ((item as ApiTask & { tool?: string }).tool ?? "generate") === tool);
      setRecent(filtered.slice(0, 5));
    });
  }, []);

  React.useEffect(() => {
    (async () => {
      const me = await api.me();
      if (!me.data) return;
      setUserId(me.data.id);
      refreshCredits();
    })();
  }, [refreshCredits]);

  // Live progress.
  React.useEffect(() => {
    if (!taskId) return;
    const message = progressMap[taskId];
    if (!message) return;
    setTask((prev) => ({
      ...(prev ?? ({ id: taskId } as ApiTask)),
      id: taskId,
      status: message.status,
      progress: message.progress,
      stage: message.stage ?? prev?.stage ?? null,
      output: (message.output as Record<string, unknown>) ?? prev?.output ?? null,
      error: message.error ?? prev?.error ?? null,
    }));
    if (message.status === "done") {
      refreshCredits();
      refreshRecent(activeToolRef.current);
    }
  }, [progressMap, taskId, refreshCredits, refreshRecent]);

  // Polling fallback.
  React.useEffect(() => {
    if (!taskId) return;
    if (!task || !["queued", "running", "post_processing"].includes(task.status)) return;
    const timer = window.setInterval(async () => {
      const { data } = await api.getTask(taskId);
      if (!data) return;
      setTask(data);
      if (["done", "failed", "cancelled"].includes(data.status)) {
        refreshCredits();
        refreshRecent(activeToolRef.current);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [taskId, task, refreshCredits]);

  React.useEffect(() => {
    if (task) onEvent?.(task);
  }, [task, onEvent]);

  const submit = async ({ tool, input, cost }: SubmitOptions) => {
    activeToolRef.current = tool;
    if (credits !== null && credits < cost) {
      toast({ title: "积分不足", description: "请先充值后再使用该工具", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await api.createTask({ tool, input, priority: "normal" });
    setSubmitting(false);

    if (error || !data) {
      toast({ title: "提交失败", description: error ?? undefined, variant: "destructive" });
      return;
    }

    setTaskId(data.id);
    setTask(data);
    setRecent((prev) => [data, ...prev].slice(0, 5));
    refreshCredits();
    toast({ title: "任务已提交", variant: "success" });
    refreshRecent(tool);
  };

  const cancel = async () => {
    if (!taskId) return;
    const { data } = await api.cancelTask(taskId);
    if (data) setTask(data);
  };

  const pickRecent = (next: ApiTask) => {
    setTaskId(next.id);
    setTask(next);
  };

  return {
    userId,
    credits,
    submitting,
    task,
    taskId,
    recent,
    submit,
    cancel,
    pickRecent,
    refreshRecent,
  };
}
