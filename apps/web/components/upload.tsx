"use client";

import * as React from "react";
import { FileVideo, ImageIcon, RefreshCw, Upload as UploadIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type UploadedAsset = {
  file: File;
  previewUrl: string;
  kind: "image" | "video";
};

export function Upload({
  onFileSelect,
  accept = "image/*,video/*",
  maxSizeMB = 50,
  disabled = false,
  resetAfterSelect = false,
  className,
}: {
  onFileSelect?: (file: File | null) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
  /** Clear the local selection right after a pick (multi-file pickers). */
  resetAfterSelect?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const kind: "image" | "video" =
    file?.type.startsWith("video") ? "video" : "image";

  const handleFile = (next: File | null) => {
    setError(null);
    if (next && next.size > maxSizeMB * 1024 * 1024) {
      setError(t("tools.fileTooLarge", { max: maxSizeMB }));
      return;
    }
    setFile(resetAfterSelect ? null : next);
    onFileSelect?.(next);
  };

  const clear = () => {
    handleFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {file && preview ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            {kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={file.name} className="h-full w-full object-cover" />
            ) : (
              <video src={preview} className="h-full w-full object-cover" muted playsInline />
            )}
            {kind === "video" && (
              <span className="absolute bottom-1 left-1 rounded bg-black/60 p-0.5 text-white">
                <FileVideo className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {kind === "video" ? t("tools.video") : t("tools.image")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("tools.replaceFile")}
              onClick={openPicker}
              disabled={disabled}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("tools.removeFile")}
              onClick={clear}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={t("tools.upload")}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (disabled) return;
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <UploadIcon className="h-5 w-5" aria-hidden="true" />
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm">
            <span className="font-medium">{t("tools.upload")}</span>
            <p className="text-xs text-muted-foreground">{t("tools.uploadHint", { max: maxSizeMB })}</p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
