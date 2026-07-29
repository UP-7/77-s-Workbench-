"use client";

import * as React from "react";

/**
 * 客户端水合守卫：persist store 数据在服务端不可用，
 * 挂载前渲染占位，避免 hydration 不一致。
 */
export function ClientGate({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <>
        {fallback ?? (
          <div className="space-y-3 p-4">
            <div className="h-28 animate-pulse-soft rounded-2xl bg-muted" />
            <div className="h-20 animate-pulse-soft rounded-2xl bg-muted" />
            <div className="h-20 animate-pulse-soft rounded-2xl bg-muted" />
          </div>
        )}
      </>
    );
  }
  return <>{children}</>;
}
