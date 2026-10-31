"use client";

import * as React from "react";
import { Film, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "@/components/upload";
import { ToolPage, ToolSection } from "@/components/tools/tool-page";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function EditToolPage() {
  const t = useTranslations();
  const [clips, setClips] = React.useState<File[]>([]);
  const [trimStart, setTrimStart] = React.useState("0");
  const [trimEnd, setTrimEnd] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [bgm, setBgm] = React.useState<File | null>(null);

  const addClip = (next: File | null) => {
    if (!next) return;
    if (clips.length >= 6) {
      toast({ title: t("toolsPage.edit.maxClips"), variant: "destructive" });
      return;
    }
    setClips((prev) => [...prev, next]);
  };

  const buildInput = async (): Promise<Record<string, unknown> | null> => {
    if (!clips.length) return null;
    const urls: string[] = [];
    for (const clip of clips) {
      const { data, error } = await api.uploadFile(clip);
      const url = (data as { url?: string } | null)?.url;
      if (error || !url) {
        toast({ title: t("generate.uploadFailed"), description: error ?? undefined, variant: "destructive" });
        return null;
      }
      urls.push(url);
    }

    let bgmUrl: string | undefined;
    if (bgm) {
      const { data } = await api.uploadFile(bgm);
      bgmUrl = (data as { url?: string } | null)?.url;
    }

    return {
      clips: urls,
      trimStart: Number(trimStart) || 0,
      trimEnd: trimEnd ? Number(trimEnd) : null,
      caption: caption.trim() || null,
      bgmUrl: bgmUrl ?? null,
      bgmVolume: 0.25,
    };
  };

  return (
    <ToolPage
      tool="video-edit"
      title={t("toolsPage.edit.title")}
      subtitle={t("toolsPage.edit.subtitle")}
      cost={12}
      canSubmit={clips.length > 0}
      buildInput={buildInput}
      summary={
        <>
          <div className="flex justify-between">
            <span>{t("toolsPage.edit.clips")}</span>
            <span className="text-foreground">{clips.length}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("toolsPage.edit.duration")}</span>
            <span className="text-foreground">
              {trimStart || 0}s {trimEnd ? `→ ${trimEnd}s` : ""}
            </span>
          </div>
        </>
      }
    >
      <ToolSection title={t("toolsPage.edit.clipsTitle")}>
        <div className="space-y-3">
          {clips.length > 0 && (
            <ul className="space-y-2">
              {clips.map((clip, index) => (
                <li key={`${clip.name}-${index}`} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Film className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm">{clip.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(clip.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("tools.removeFile")}
                    onClick={() => setClips((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {clips.length < 6 && (
            <div className="space-y-2">
              <Upload accept="video/*" maxSizeMB={200} onFileSelect={addClip} resetAfterSelect />
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Plus className="h-3 w-3" aria-hidden="true" />
                {t("toolsPage.edit.addClipHint")}
              </p>
            </div>
          )}
        </div>
      </ToolSection>

      <ToolSection title={t("toolsPage.edit.options")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trimStart">{t("toolsPage.edit.trimStart")}</Label>
            <Input
              id="trimStart"
              inputMode="decimal"
              value={trimStart}
              onChange={(event) => setTrimStart(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trimEnd">{t("toolsPage.edit.trimEnd")}</Label>
            <Input
              id="trimEnd"
              inputMode="decimal"
              value={trimEnd}
              onChange={(event) => setTrimEnd(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={t("toolsPage.edit.trimEndPlaceholder")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caption">{t("toolsPage.edit.caption")}</Label>
          <Input
            id="caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value.slice(0, 80))}
            placeholder={t("toolsPage.edit.captionPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("toolsPage.edit.bgm")}</Label>
          <Upload accept="audio/*" maxSizeMB={30} onFileSelect={setBgm} />
        </div>
      </ToolSection>
    </ToolPage>
  );
}
