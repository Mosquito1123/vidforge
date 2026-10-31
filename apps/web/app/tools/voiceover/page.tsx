"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "@/components/upload";
import { ToolPage, ToolSection } from "@/components/tools/tool-page";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

const MAX_SCRIPT = 5000;

export default function VoiceoverToolPage() {
  const t = useTranslations();
  const [script, setScript] = React.useState("");
  const [video, setVideo] = React.useState<File | null>(null);
  const [bgm, setBgm] = React.useState<File | null>(null);
  const [voice, setVoice] = React.useState("");
  const [burnSubtitles, setBurnSubtitles] = React.useState(true);
  const [keepOriginal, setKeepOriginal] = React.useState(true);

  const buildInput = async (): Promise<Record<string, unknown> | null> => {
    if (script.trim().length < 2) return null;

    let videoUrl: string | null = null;
    if (video) {
      const { data, error } = await api.uploadFile(video);
      if (error || !(data as { url?: string } | null)?.url) {
        toast({ title: t("generate.uploadFailed"), description: error ?? undefined, variant: "destructive" });
        return null;
      }
      videoUrl = (data as { url: string }).url;
    }

    let bgmUrl: string | null = null;
    if (bgm) {
      const { data } = await api.uploadFile(bgm);
      bgmUrl = (data as { url?: string } | null)?.url ?? null;
    }

    return {
      script: script.trim(),
      videoUrl,
      bgmUrl,
      voice: voice.trim() || null,
      burnSubtitles,
      keepOriginalAudio: keepOriginal,
      bgmVolume: 0.15,
    };
  };

  return (
    <ToolPage
      tool="voiceover"
      title={t("toolsPage.voiceover.title")}
      subtitle={t("toolsPage.voiceover.subtitle")}
      cost={18}
      canSubmit={script.trim().length >= 2}
      buildInput={buildInput}
      summary={
        <>
          <div className="flex justify-between">
            <span>{t("toolsPage.voiceover.scriptLength")}</span>
            <span className="text-foreground">{script.length}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("toolsPage.voiceover.background")}</span>
            <span className="text-foreground">
              {video ? t("toolsPage.voiceover.uploaded") : t("toolsPage.voiceover.auto")}
            </span>
          </div>
        </>
      }
    >
      <ToolSection title={t("toolsPage.voiceover.scriptTitle")}>
        <Label htmlFor="script">{t("toolsPage.voiceover.script")}</Label>
        <Textarea
          id="script"
          value={script}
          onChange={(event) => setScript(event.target.value.slice(0, MAX_SCRIPT))}
          placeholder={t("toolsPage.voiceover.scriptPlaceholder")}
          className="min-h-[140px]"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t("toolsPage.voiceover.scriptHint")}</span>
          <span className="tabular-nums">
            {script.length}/{MAX_SCRIPT}
          </span>
        </div>
      </ToolSection>

      <ToolSection title={t("toolsPage.voiceover.backgroundTitle")}>
        <Upload accept="video/*" maxSizeMB={200} onFileSelect={setVideo} />
        <p className="text-xs text-muted-foreground">{t("toolsPage.voiceover.backgroundHint")}</p>
      </ToolSection>

      <ToolSection title={t("toolsPage.voiceover.voice")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="voice">{t("toolsPage.voiceover.voiceName")}</Label>
            <input
              id="voice"
              value={voice}
              onChange={(event) => setVoice(event.target.value)}
              placeholder={t("toolsPage.voiceover.voicePlaceholder")}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("toolsPage.voiceover.bgm")}</Label>
            <Upload accept="audio/*" maxSizeMB={30} onFileSelect={setBgm} />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={burnSubtitles}
              onChange={(event) => setBurnSubtitles(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {t("toolsPage.voiceover.burnSubtitles")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={keepOriginal}
              onChange={(event) => setKeepOriginal(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {t("toolsPage.voiceover.keepOriginal")}
          </label>
        </div>
      </ToolSection>
    </ToolPage>
  );
}
