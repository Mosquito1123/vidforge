"use client";

import * as React from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const STYLE_PRESETS = [
  { key: "cinematic", suffix: "cinematic lighting, shallow depth of field, 35mm film grain" },
  { key: "cyberpunk", suffix: "cyberpunk neon city, rain reflections, volumetric fog, teal and magenta" },
  { key: "product", suffix: "studio product shot, soft box lighting, seamless backdrop, macro detail" },
  { key: "anime", suffix: "anime illustration, vibrant colors, cel shading, dynamic composition" },
  { key: "nature", suffix: "golden hour, natural light, ultra detailed, documentary style" },
  { key: "retro", suffix: "retro 80s aesthetic, VHS grain, chromatic aberration" },
] as const;

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  maxLength = 1000,
  error,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  loading?: boolean;
  disabled?: boolean;
  maxLength?: number;
  error?: string;
  className?: string;
}) {
  const t = useTranslations();
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const append = (suffix: string) => {
    const trimmed = value.trim();
    const next = trimmed ? `${trimmed}, ${suffix}` : suffix;
    onChange(next.slice(0, maxLength));
    ref.current?.focus();
  };

  const usage = value.length / maxLength;
  const nearLimit = usage > 0.9;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="prompt">{t("tools.prompt")}</Label>
        <span className="hidden text-xs text-muted-foreground sm:inline">{t("generate.promptShortcut")}</span>
      </div>

      <Textarea
        id="prompt"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (!loading && !disabled) onSubmit?.();
          }
        }}
        placeholder={t("generate.promptPlaceholder")}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "prompt-error" : "prompt-hint"}
        className={cn(
          "min-h-[132px] resize-y text-base leading-relaxed",
          error && "border-destructive focus-visible:ring-destructive",
        )}
        disabled={disabled}
      />

      <div className="flex items-start justify-between gap-3 text-xs">
        <span id="prompt-hint" className="min-w-0 flex-1 text-muted-foreground">
          {t("generate.promptHint")}
        </span>
        <span className={cn("shrink-0 tabular-nums", nearLimit ? "text-destructive" : "text-muted-foreground")}>
          {value.length}/{maxLength}
        </span>
      </div>

      {error && (
        <p id="prompt-error" className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("generate.stylePresets")}</p>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => append(preset.suffix)}
              disabled={disabled || value.length >= maxLength}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                "transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Wand2 className="h-3 w-3" aria-hidden="true" />
              {t(`generate.styles.${preset.key}`)}
            </button>
          ))}
        </div>
      </div>

      {!value.trim() && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("generate.examplesTitle")}</p>
          <div className="flex flex-col gap-1.5">
            {(["example1", "example2", "example3"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(t(`generate.${key}`));
                  ref.current?.focus();
                }}
                className="rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t(`generate.${key}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={onSubmit}
        disabled={loading || disabled || !value.trim()}
        className="w-full sm:hidden"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {loading ? t("generate.generating") : t("generate.generate")}
      </Button>
    </div>
  );
}
