"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PromptInput({
  value,
  onChange,
  onSubmit,
  loading = false,
  maxLength = 1000,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  loading?: boolean;
  maxLength?: number;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="prompt">{t("tools.prompt")}</Label>
      <Textarea
        id="prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the video you want to generate..."
        maxLength={maxLength}
        className="min-h-[120px]"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {value.length}/{maxLength}
        </span>
        <Button onClick={onSubmit} disabled={loading || !value.trim()}>
          <Sparkles className="h-4 w-4" />
          {loading ? t("generate.generating") : t("generate.generate")}
        </Button>
      </div>
    </div>
  );
}