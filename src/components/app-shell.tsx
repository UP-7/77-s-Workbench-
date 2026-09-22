"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Menu,
  X,
  Home,
  CalendarCheck2,
  Newspaper,
  Gem,
  Wallet,
  Store,
  Settings,
  Moon,
  Sun,
  Sparkles,
  PenTool,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReminders } from "@/hooks/use-reminders";
import Toaster from "@/components/ui/Toaster";

const NAV_ITEMS = [
  { href: "/", label: "首页", sub: "Dashboard", icon: Home },
  { href: "/planner", label: "每日计划", sub: "Planner", icon: CalendarCheck2 },
  { href: "/finance", label: "收支账本", sub: "Daily Finance", icon: Wallet },
  { href: "/feed", label: "技术资讯", sub: "Tech Feed", icon: Newspaper },
  { href: "/collection", label: "文玩阁", sub: "Collection", icon: Gem },
  { href: "/atelier", label: "素材坊", sub: "Atelier", icon: PenTool },
  { href: "/business", label: "生意商账", sub: "Business Hub", icon: Store },
  { href: "/invoices", label: "发票管家", sub: "Invoices", icon: Receipt },
  { href: "/settings", label: "设置", sub: "Settings", icon: Settings },
] as const;

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/collection/")) return "藏品详情";
  const hit = NAV_ITEMS.find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
  );
  return hit?.label ?? "77的工作台";
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-11 w-11" />;
  const dark = resolvedTheme === "dark";
  return (
    <button
      aria-label="切换主题"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted active:scale-95"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const pathname = usePathname();
  useReminders();

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      {/* 顶栏 */}
      <header className="sticky top-0 z-40 border-b bg-background/85 pt-safe backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-2">
          <button
            aria-label="打开菜单"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-[15px] font-semibold tracking-wide">{pageTitle(pathname)}</h1>
          <ThemeToggle />
        </div>
      </header>

      {/* 抽屉导航 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/45 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[78%] max-w-[300px] flex-col bg-card pt-safe shadow-2xl animate-slide-in-left">
            <div className="flex items-center justify-between px-5 pb-4 pt-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-bold leading-tight">77的工作台</p>
                    <p className="text-[11px] text-muted-foreground">你的第二大脑</p>
                  </div>
                </div>
              </div>
              <button
                aria-label="关闭菜单"
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors",
                      active
                        ? "bg-primary/10 text-primary dark:bg-primary/15"
                        : "text-foreground/80 hover:bg-muted active:bg-muted"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="flex-1 text-[15px] font-medium">{item.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      {item.sub}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t px-5 py-4 pb-safe">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                离线可用 · 数据存于本机
                <br />
                v1.0 · Made for 77
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* 内容区 */}
      <main className="flex-1 pb-safe">{children}</main>

      <Toaster />
    </div>
  );
}
