"use client";

import * as React from "react";
import { Mic, MicOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

interface VoiceSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  hint: string; // 示例引导语
  parsing?: boolean;
  externalError?: string;
  onConfirm: (text: string) => void;
}

/** 通用语音采集底弹层：录音 → 转写 → 确认解析（计划/商账/账本复用） */
export function VoiceSheet({
  open,
  onClose,
  title,
  hint,
  parsing,
  externalError,
  onConfirm,
}: VoiceSheetProps) {
  const { supported, listening, transcript, error, start, stop, reset } = useSpeech();

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {supported ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <button
            onClick={() => (listening ? stop() : void start())}
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full transition-all active:scale-90",
              listening
                ? "bg-destructive text-destructive-foreground shadow-[0_0_0_12px_hsl(var(--destructive)/0.15)] animate-pulse-soft"
                : "bg-primary text-primary-foreground shadow-lg"
            )}
          >
            {listening ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
          </button>
          <p className="text-xs text-muted-foreground">
            {listening ? "正在聆听… 再点一下结束" : hint}
          </p>
          <div className="min-h-[3rem] w-full rounded-xl bg-muted p-3.5 text-center text-[15px]">
            {transcript || <span className="text-muted-foreground/60">识别结果显示在这里</span>}
          </div>
          {(error || externalError) && (
            <p className="text-xs text-destructive">{error || externalError}</p>
          )}
          <Button
            className="w-full"
            size="lg"
            disabled={!transcript.trim() || parsing}
            onClick={() => onConfirm(transcript)}
          >
            <Sparkles className="h-4 w-4" />
            {parsing ? "AI 解析中…" : "解析"}
          </Button>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          当前浏览器不支持语音识别，请使用手动输入。
        </p>
      )}
    </BottomSheet>
  );
}
