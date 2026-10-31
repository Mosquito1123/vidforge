"use client";

import * as React from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function VideoPlayer({
  src,
  poster,
  className,
}: {
  src?: string;
  poster?: string;
  className?: string;
}) {
  const t = useTranslations();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const fullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-black", className)}>
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="aspect-video w-full"
          onEnded={() => setPlaying(false)}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
          {t("tools.noVideoYet")}
        </div>
      )}
      {src && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
          <Button size="icon" variant="ghost" onClick={togglePlay} className="text-white hover:bg-white/20">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={toggleMute} className="text-white hover:bg-white/20">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <div className="flex-1" />
          <Button size="icon" variant="ghost" onClick={fullscreen} className="text-white hover:bg-white/20">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}