"use client";

import * as React from "react";
import {
  Smartphone,
  Download,
  Upload,
  Bell,
  Camera,
  Mic,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Database,
  Share,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ClientGate } from "@/components/client-gate";
import { useSettingsStore } from "@/stores/settings";
import {
  queryPermissionState,
  requestNotificationPermission,
  requestMediaPermission,
} from "@/lib/notifications";
import { mediaStorageUsage } from "@/lib/db";
import { vibrate } from "@/lib/utils";
import type { BackupPayload } from "@/lib/types";

const STORE_KEYS = [
  "qiqi-planner",
  "qiqi-finance",
  "qiqi-business",
  "qiqi-collection",
  "qiqi-feed-favorites",
  "qiqi-settings",
] as const;

/* ---------------- PWA 安装 ---------------- */
function InstallCard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferred, setDeferred] = React.useState<any>(null);
  const [standalone, setStandalone] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);

  React.useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Boolean((window.navigator as any).standalone)
    );
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4 text-primary" /> 添加到手机桌面
        </CardTitle>
        <CardDescription>
          安装后全屏运行、离线可用，体验与原生 App 一致
        </CardDescription>
      </CardHeader>
      <CardContent>
        {standalone ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> 已安装，正以独立 App 模式运行
          </p>
        ) : deferred ? (
          <Button
            className="w-full"
            onClick={async () => {
              deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
          >
            <Download className="h-4 w-4" /> 一键添加到桌面
          </Button>
        ) : isIOS ? (
          <div className="rounded-xl bg-muted p-3.5 text-[13px] leading-relaxed text-muted-foreground">
            iPhone 安装方法：点击 Safari 底部
            <Share className="mx-1 inline h-3.5 w-3.5" />
            分享按钮 → 选择「添加到主屏幕」→ 点右上角「添加」。
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            在 Chrome / Edge 中打开本页，浏览器菜单里选择「安装应用 / 添加到主屏幕」。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- 个人化 ---------------- */
function ProfileCard() {
  const { nickname, city, setNickname, setCity } = useSettingsStore();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserRound className="h-4 w-4 text-primary" /> 个人化
        </CardTitle>
        <CardDescription>昵称与城市用于 AI 晨报的称呼和天气</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="s-nick">昵称</Label>
          <Input id="s-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-city">城市</Label>
          <Input id="s-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- 数据备份 ---------------- */
function BackupCard() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [usage, setUsage] = React.useState<{ count: number; bytes: number } | null>(null);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => {
    void mediaStorageUsage().then(setUsage).catch(() => setUsage(null));
  }, []);

  const exportJson = () => {
    const read = (k: string) => {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    };
    const payload: BackupPayload = {
      version: 1,
      exportedAt: Date.now(),
      planner: read("qiqi-planner"),
      finance: read("qiqi-finance"),
      business: read("qiqi-business"),
      collection: read("qiqi-collection"),
      feedFavorites: read("qiqi-feed-favorites"),
      settings: read("qiqi-settings"),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `77工作台备份-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    vibrate(20);
    setMsg("备份已导出（照片视频存于本机 IndexedDB，不含在内）");
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupPayload;
      if (data.version !== 1) throw new Error("版本不兼容");
      const map: Record<string, unknown> = {
        "qiqi-planner": data.planner,
        "qiqi-finance": data.finance,
        "qiqi-business": data.business,
        "qiqi-collection": data.collection,
        "qiqi-feed-favorites": data.feedFavorites,
        "qiqi-settings": data.settings,
      };
      for (const [k, v] of Object.entries(map)) {
        if (v) localStorage.setItem(k, JSON.stringify(v));
      }
      setMsg("导入成功，正在刷新…");
      setTimeout(() => location.reload(), 600);
    } catch {
      setMsg("导入失败：文件格式不正确");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-primary" /> 数据管理
        </CardTitle>
        <CardDescription>
          {usage
            ? `媒体库：${usage.count} 个文件 · ${(usage.bytes / 1024 / 1024).toFixed(1)} MB（IndexedDB）`
            : "全部数据仅保存在你的手机本地"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={exportJson}>
            <Download className="h-4 w-4" /> 导出备份
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> 导入备份
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = "";
          }}
        />
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}

/* ---------------- 权限管理 ---------------- */
const PERMS = [
  { key: "notifications", label: "通知", desc: "待办到点提醒", icon: Bell },
  { key: "camera", label: "摄像头", desc: "拍摄藏品 / 扫码", icon: Camera },
  { key: "microphone", label: "麦克风", desc: "语音记账", icon: Mic },
] as const;

function PermissionCard() {
  const [states, setStates] = React.useState<Record<string, string>>({});
  const [secure, setSecure] = React.useState(true);
  const [tip, setTip] = React.useState("");

  const refresh = React.useCallback(async () => {
    const next: Record<string, string> = {};
    for (const p of PERMS) {
      next[p.key] = await queryPermissionState(p.key);
    }
    setStates(next);
  }, []);

  React.useEffect(() => {
    setSecure(window.isSecureContext);
    void refresh();
  }, [refresh]);

  const request = async (key: (typeof PERMS)[number]["key"]) => {
    if (!secure) {
      setTip("当前是 HTTP 访问，浏览器禁止申请该权限。请通过 HTTPS 域名或 localhost 打开。");
      return;
    }
    setTip("");
    let ok = false;
    if (key === "notifications") {
      ok = (await requestNotificationPermission()) === "granted";
    } else {
      ok = await requestMediaPermission(key);
    }
    if (!ok) {
      setTip("申请未通过：可能被浏览器拦截或已被拒绝，需到浏览器/系统设置中手动开启。");
    }
    await refresh();
  };

  const stateUI = (s?: string) => {
    if (s === "granted")
      return (
        <span className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> 已授权
        </span>
      );
    if (s === "denied")
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="h-3.5 w-3.5" /> 已拒绝
        </span>
      );
    if (s === "unsupported" || !secure)
      return (
        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <XCircle className="h-3.5 w-3.5" /> 环境不可用
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <HelpCircle className="h-3.5 w-3.5" /> 未询问
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4 text-primary" /> 权限管理
        </CardTitle>
        <CardDescription>
          {secure
            ? "被拒绝的权限需到系统浏览器设置中重新开启"
            : "⚠️ 当前为 HTTP 访问：浏览器在非 HTTPS 环境下禁用通知/摄像头/麦克风。部署到 HTTPS 后即可正常申请。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {PERMS.map((p) => (
          <div key={p.key} className="flex items-center gap-3 px-4 py-3.5">
            <p.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-[11px] text-muted-foreground">{p.desc}</p>
            </div>
            {stateUI(states[p.key])}
            {states[p.key] !== "granted" && (
              <Button size="sm" variant="outline" onClick={() => void request(p.key)}>
                申请
              </Button>
            )}
          </div>
        ))}
        {tip && (
          <p className="px-4 py-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400">{tip}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-4 p-4">
      <ClientGate>
        <InstallCard />
        <ProfileCard />
        <BackupCard />
        <PermissionCard />
        <p className="pb-4 pt-2 text-center text-[11px] text-muted-foreground/60">
          77的工作台 v1.0 · 本地优先 · 你的数据只属于你
        </p>
      </ClientGate>
    </div>
  );
}
