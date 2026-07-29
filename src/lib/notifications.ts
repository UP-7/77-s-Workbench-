"use client";

import { vibrate } from "./utils";

export type PermissionResult = "granted" | "denied" | "unsupported" | "default";

export function notificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (!notificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    const res = await Notification.requestPermission();
    return res as PermissionResult;
  } catch {
    return "denied";
  }
}

export async function notify(title: string, body: string, tag?: string): Promise<boolean> {
  if (!notificationSupported() || Notification.permission !== "granted") return false;
  vibrate([80, 40, 80]);
  try {
    // 优先经由 Service Worker 展示（PWA 后台也可见）
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body,
        tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      });
      return true;
    }
  } catch {
    /* 回落到页面级通知 */
  }
  try {
    new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
    return true;
  } catch {
    return false;
  }
}

export async function queryPermissionState(
  name: "camera" | "microphone" | "notifications"
): Promise<string> {
  if (typeof navigator === "undefined") return "unsupported";
  if (name === "notifications") {
    return notificationSupported() ? Notification.permission : "unsupported";
  }
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    return status.state;
  } catch {
    return "unsupported";
  }
}

export async function requestMediaPermission(kind: "camera" | "microphone"): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === "camera" ? { video: true } : { audio: true }
    );
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
