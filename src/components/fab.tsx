"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Mic, Camera, X } from "lucide-react";
import { cn, vibrate } from "@/lib/utils";

/** 悬浮操作按钮：展开语音记账 / 拍照入库 */
export function Fab() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const actions = [
    {
      label: "语音记账",
      icon: Mic,
      onClick: () => router.push("/finance?voice=1"),
      bg: "bg-accent text-accent-foreground",
    },
    {
      label: "拍照入库",
      icon: Camera,
      onClick: () => router.push("/collection?capture=1"),
      bg: "bg-primary text-primary-foreground",
    },
  ];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 animate-fade-in" onClick={() => setOpen(false)} />
      )}
      <div className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-3 pb-safe">
        {open &&
          actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className={cn(
                "flex h-12 items-center gap-2 rounded-full pl-4 pr-5 text-sm font-medium shadow-lg animate-fade-up active:scale-95",
                a.bg
              )}
            >
              <a.icon className="h-5 w-5" />
              {a.label}
            </button>
          ))}
        <button
          aria-label={open ? "收起" : "快捷操作"}
          onClick={() => {
            vibrate(15);
            setOpen((v) => !v);
          }}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-90",
            open && "rotate-45"
          )}
        >
          {open ? <X className="h-6 w-6 -rotate-45" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}
