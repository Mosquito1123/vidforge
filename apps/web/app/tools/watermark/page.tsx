"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Upload } from "@/components/upload";
import { ToolPage, ToolSection } from "@/components/tools/tool-page";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

const PRESETS = [
  { key: "bottomRight", x: 76, y: 82, width: 20, height: 12 },
  { key: "topRight", x: 76, y: 4, width: 20, height: 12 },
  { key: "bottomLeft", x: 4, y: 82, width: 20, height: 12 },
  { key: "topLeft", x: 4, y: 4, width: 20, height: 12 },
  { key: "bottomBanner", x: 0, y: 86, width: 100, height: 14 },
] as const;

export default function WatermarkToolPage() {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const [preset, setPreset] = React.useState<string>("bottomRight");
  const [method, setMethod] = React.useState<string>("auto");
  const [custom, setCustom] = React.useState({ x: 76, y: 82, width: 20, height: 12 });

  const region = preset === "custom" ? custom : PRESETS.find((item) => item.key === preset) ?? PRESETS[0];

  const buildInput = async (): Promise<Record<string, unknown> | null> => {
    if (!file) return null;
    const { data, error } = await api.uploadFile(file);
    const url = (data as { url?: string } | null)?.url;
    if (error || !url) {
      toast({ title: t("generate.uploadFailed"), description: error ?? undefined, variant: "destructive" });
      return null;
    }
    return {
      sourceUrl: url,
      region: { x: region.x, y: region.y, width: region.width, height: region.height },
      method,
    };
  };

  return (
    <ToolPage
      tool="watermark-removal"
      title={t("toolsPage.watermark.title")}
      subtitle={t("toolsPage.watermark.subtitle")}
      cost={15}
      canSubmit={Boolean(file)}
      buildInput={buildInput}
      summary={
        <>
          <div className="flex justify-between">
            <span>{t("toolsPage.watermark.region")}</span>
            <span className="text-foreground">
              {region.width}% × {region.height}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>{t("toolsPage.watermark.method")}</span>
            <span className="text-foreground">{method}</span>
          </div>
        </>
      }
    >
      <ToolSection title={t("toolsPage.watermark.source")}>
        <Upload accept="video/*" maxSizeMB={200} onFileSelect={setFile} />
        <p className="text-xs text-muted-foreground">{t("toolsPage.watermark.sourceHint")}</p>
      </ToolSection>

      <ToolSection title={t("toolsPage.watermark.regionTitle")}>
        <div
          role="radiogroup"
          aria-label={t("toolsPage.watermark.region")}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {[...PRESETS, { key: "custom" as const }].map((item) => {
            const active = preset === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreset(item.key)}
                className={
                  active
                    ? "rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm font-medium"
                    : "rounded-md border px-3 py-2 text-sm text-muted-foreground hover:border-primary/40"
                }
              >
                {t(`toolsPage.watermark.presets.${item.key}`)}
              </button>
            );
          })}
        </div>

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {(["x", "y", "width", "height"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`region-${key}`} className="text-xs uppercase">
                  {key} %
                </Label>
                <input
                  id={`region-${key}`}
                  type="range"
                  min={0}
                  max={100}
                  value={custom[key]}
                  onChange={(event) => setCustom({ ...custom, [key]: Number(event.target.value) })}
                  className="w-full accent-primary"
                />
                <span className="text-xs tabular-nums text-muted-foreground">{custom[key]}%</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="method">{t("toolsPage.watermark.method")}</Label>
          <select
            id="method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="auto">{t("toolsPage.watermark.methods.auto")}</option>
            <option value="delogo">{t("toolsPage.watermark.methods.delogo")}</option>
            <option value="blur">{t("toolsPage.watermark.methods.blur")}</option>
            <option value="mosaic">{t("toolsPage.watermark.methods.mosaic")}</option>
          </select>
        </div>
      </ToolSection>
    </ToolPage>
  );
}
