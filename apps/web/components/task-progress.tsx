"use client";

import * as React from "react";
import { taskProgressSocket, type TaskProgressMessage } from "@/lib/ws";

export function useTaskProgress(userId: string | null) {
  const [progress, setProgress] = React.useState<Record<string, TaskProgressMessage>>({});

  React.useEffect(() => {
    if (!userId) return;
    taskProgressSocket.connect(userId);
    const unsub = taskProgressSocket.subscribe((msg) => {
      setProgress((prev) => ({ ...prev, [msg.taskId]: msg }));
    });
    return () => {
      unsub();
    };
  }, [userId]);

  return progress;
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function TaskProgressToast({ msg }: { msg: TaskProgressMessage }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-md border bg-background p-4 shadow-lg">
      <div className="mb-2 text-sm font-medium">Task {msg.taskId.slice(0, 8)}</div>
      <ProgressBar value={msg.progress} />
      <div className="mt-1 text-xs text-muted-foreground">
        {msg.stage ?? msg.status} · {Math.round(msg.progress)}%
      </div>
    </div>
  );
}