"use client";

import * as React from "react";
import { getMediaBlob } from "@/lib/db";
import { cn } from "@/lib/utils";
import { ImageOff, Play } from "lucide-react";

/** 从 IndexedDB 加载媒体并渲染（自动管理 ObjectURL 生命周期） */
export function useMediaUrl(mediaId?: string) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [type, setType] = React.useState<"image" | "video">("image");

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!mediaId) {
      setUrl(null);
      return;
    }
    void getMediaBlob(mediaId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setType(blob.type.startsWith("video") ? "video" : "image");
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  return { url, type };
}

export function MediaThumb({
  mediaId,
  className,
  onClick,
}: {
  mediaId?: string;
  className?: string;
  onClick?: () => void;
}) {
  const { url, type } = useMediaUrl(mediaId);

  if (!mediaId || !url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground/40", className)}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  if (type === "video") {
    return (
      <div className={cn("relative overflow-hidden bg-black", className)} onClick={onClick}>
        <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={cn("object-cover", className)} onClick={onClick} />;
}
