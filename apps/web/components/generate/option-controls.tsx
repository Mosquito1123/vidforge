"use client";

import * as React from "react";
import { Check, Coins, Dices, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApiModel } from "@/lib/api";

export function ModelPicker({
  models,
  value,
  onChange,
  disabled = false,
}: {
  models: ApiModel[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();

  return (
    <div role="radiogroup" aria-label={t("tools.model")} className="grid gap-2 sm:grid-cols-2">
      {models.map((model) => {
        const selected = model.id === value;
        return (
          <button
            key={model.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(model.id)}
            className={cn(
              "relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary/5"
                : "hover:border-primary/40 hover:bg-muted/40",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">{model.name}</span>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5">{model.provider}</span>
              <span>{model.type === "IMAGE" ? t("generate.imageModel") : t("generate.videoModel")}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-foreground">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {t("generate.creditsPerRun", { credits: Number(model.creditsCost) })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const ASPECTS = [
  { value: "16:9", width: 28, height: 16 },
  { value: "9:16", width: 16, height: 28 },
  { value: "1:1", width: 22, height: 22 },
] as const;

export function AspectPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();

  return (
    <div role="radiogroup" aria-label={t("tools.aspectRatio")} className="grid grid-cols-3 gap-2">
      {ASPECTS.map((aspect) => {
        const selected = value === aspect.value;
        return (
          <button
            key={aspect.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(aspect.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-md border py-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:border-primary/40",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "rounded-[3px] border-2",
                selected ? "border-primary bg-primary/20" : "border-muted-foreground/50",
              )}
              style={{ width: aspect.width, height: aspect.height }}
            />
            {aspect.value}
          </button>
        );
      })}
    </div>
  );
}

const DURATIONS = ["3", "5", "10"] as const;

export function DurationPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();

  return (
    <div role="radiogroup" aria-label={t("tools.duration")} className="grid grid-cols-3 gap-2">
      {DURATIONS.map((duration) => {
        const selected = value === duration;
        return (
          <button
            key={duration}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(duration)}
            className={cn(
              "rounded-md border py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:border-primary/40",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {duration}s
          </button>
        );
      })}
    </div>
  );
}

export type AdvancedValues = {
  negativePrompt: string;
  seed: string;
  resolution: string;
};

export function AdvancedOptions({
  values,
  onChange,
  disabled = false,
}: {
  values: AdvancedValues;
  onChange: (values: AdvancedValues) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);

  const set = (patch: Partial<AdvancedValues>) => onChange({ ...values, ...patch });
  const advancedCount = [values.negativePrompt, values.seed, values.resolution !== "auto" ? values.resolution : ""].filter(Boolean).length;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="advanced-options"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {t("generate.advanced")}
          {advancedCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">{advancedCount}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{open ? t("generate.collapse") : t("generate.expand")}</span>
      </button>

      {open && (
        <div id="advanced-options" className="space-y-4 border-t px-3 py-3">
          <div className="space-y-2">
            <Label htmlFor="negativePrompt">{t("generate.negativePrompt")}</Label>
            <Textarea
              id="negativePrompt"
              value={values.negativePrompt}
              onChange={(e) => set({ negativePrompt: e.target.value })}
              placeholder={t("generate.negativePromptPlaceholder")}
              className="min-h-[72px]"
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">{t("generate.negativePromptHint")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seed">{t("generate.seed")}</Label>
              <div className="flex gap-2">
                <Input
                  id="seed"
                  inputMode="numeric"
                  value={values.seed}
                  onChange={(e) => set({ seed: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) })}
                  placeholder={t("generate.seedPlaceholder")}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("generate.randomSeed")}
                  onClick={() => set({ seed: String(Math.floor(Math.random() * 1_000_000)) })}
                  disabled={disabled}
                >
                  <Dices className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution">{t("generate.resolution")}</Label>
              <select
                id="resolution"
                value={values.resolution}
                onChange={(e) => set({ resolution: e.target.value })}
                disabled={disabled}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="auto">{t("generate.autoOption")}</option>
                <option value="1280x720">1280×720 (HD)</option>
                <option value="1920x1080">1920×1080 (FHD)</option>
                <option value="1080x1920">1080×1920 (竖屏)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
