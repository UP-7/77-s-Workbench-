"use client";

import { useRef, useState } from "react";
import { FileUp, FolderOpen, Package } from "lucide-react";
import { cn } from "@/lib/utils";

/** 批量上传区：多选 / 文件夹 / 拖拽（含文件夹）/ ZIP；粘贴在页面级监听 */
export default function UploadZone({
  onFiles,
  compact,
}: {
  onFiles: (files: File[]) => void;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.items;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: any[] = [];
    if (items) {
      for (let i = 0; i < items.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry = (items[i] as any).webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
    }
    if (entries.length) {
      const files: File[] = [];
      for (const entry of entries) {
        files.push(...(await traverseEntry(entry)));
      }
      if (files.length) onFiles(files);
    } else if (e.dataTransfer.files.length) {
      onFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-3xl border-2 border-dashed transition-colors",
        dragging ? "border-primary bg-primary/10" : "border-input bg-card",
        compact ? "p-3" : "p-5"
      )}
    >
      {!compact && (
        <div className="mb-3 text-center">
          <p className="text-3xl">🧾</p>
          <p className="mt-1.5 text-sm font-bold text-foreground">把发票都丢进来</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            支持图片 / PDF / ZIP 压缩包（自动递归解压）
            <br />
            可拖拽整个文件夹，或直接 Ctrl/⌘+V 粘贴截图
          </p>
        </div>
      )}
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-3")}>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary py-2.5 text-[11px] font-bold text-primary-foreground shadow-sm active:scale-95"
        >
          <FileUp size={17} />
          选择文件
        </button>
        <button
          onClick={() => dirRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary/10 py-2.5 text-[11px] font-bold text-primary active:scale-95"
        >
          <FolderOpen size={17} />
          选文件夹
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary/10 py-2.5 text-[11px] font-bold text-primary active:scale-95"
        >
          <Package size={17} />
          上传 ZIP
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.bmp,.pdf,.zip,image/*,application/pdf,application/zip"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <input
        ref={dirRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function traverseEntry(entry: any): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>((resolve) =>
      entry.file(
        (f: File) => resolve([f]),
        () => resolve([])
      )
    );
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: any[] = await new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all: any[] = [];
      const read = () =>
        reader.readEntries(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (batch: any[]) => {
            if (!batch.length) resolve(all);
            else {
              all.push(...batch);
              read();
            }
          },
          () => resolve(all)
        );
      read();
    });
    const files: File[] = [];
    for (const e of entries) files.push(...(await traverseEntry(e)));
    return files;
  }
  return [];
}
