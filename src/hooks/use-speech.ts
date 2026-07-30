"use client";

import * as React from "react";
import { requestMediaPermission } from "@/lib/notifications";
import { vibrate } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 通用中文语音识别 Hook（Web Speech API，不支持时 supported=false） */
export function useSpeech() {
  const [supported, setSupported] = React.useState(true);
  const [listening, setListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [error, setError] = React.useState("");
  const recRef = React.useRef<any>(null);

  React.useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === "not-allowed") setError("麦克风权限被拒绝，请到设置中开启");
      else if (e.error !== "aborted") setError("识别出错了，再试一次");
    };
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  const start = React.useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    setError("");
    setTranscript("");
    await requestMediaPermission("microphone");
    try {
      rec.start();
      setListening(true);
      vibrate(20);
    } catch {
      setError("无法启动识别");
    }
  }, []);

  const stop = React.useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const reset = React.useCallback(() => {
    setTranscript("");
    setError("");
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}
