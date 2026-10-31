"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useToasts, dismissToast } from "@/lib/toast";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "w-80 rounded-md border bg-background p-4 shadow-lg",
            t.variant === "destructive" && "border-destructive bg-destructive/10",
            t.variant === "success" && "border-primary",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              {t.title && <div className="text-sm font-medium">{t.title}</div>}
              {t.description && (
                <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
              )}
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}