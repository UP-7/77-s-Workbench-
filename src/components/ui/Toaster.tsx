"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useToastStore } from "@/stores/useToastStore";
import { cn } from "@/lib/utils";

const ICONS = {
  success: <CheckCircle2 size={17} className="text-primary" />,
  error: <AlertCircle size={17} className="text-destructive" />,
  info: <Info size={17} className="text-accent" />,
  heart: <span className="text-base leading-none">💕</span>,
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex max-w-full items-center gap-2 rounded-full bg-card/95 px-4 py-2.5 text-[13px] font-medium text-foreground shadow-sm backdrop-blur animate-fade-up",
            t.type === "heart" && "bg-primary/10 text-primary"
          )}
        >
          {ICONS[t.type]}
          <span className="truncate">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
