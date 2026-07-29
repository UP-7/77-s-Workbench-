"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { MediaMeta, CarvingAsset } from "./types";
import { uid } from "./utils";

/**
 * 媒体大文件（图片/视频 Blob）严格存放于 IndexedDB，
 * 元数据（条目信息）存放于 zustand persist(LocalStorage)。
 * v2：新增雕刻素材仓库 assets（艺术字 / 简笔画）。
 */
interface QiqiDB extends DBSchema {
  media: {
    key: string;
    value: MediaMeta & { blob: Blob };
    indexes: { "by-item": string };
  };
  assets: {
    key: string;
    value: CarvingAsset & { blob: Blob };
  };
}

let dbPromise: Promise<IDBPDatabase<QiqiDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB 仅在客户端可用");
  }
  if (!dbPromise) {
    dbPromise = openDB<QiqiDB>("qiqi-workbench", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("media", { keyPath: "id" });
          store.createIndex("by-item", "itemId");
        }
        if (oldVersion < 2) {
          db.createObjectStore("assets", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/* ================= 文玩媒体 ================= */

export async function saveMedia(itemId: string, file: File | Blob): Promise<MediaMeta> {
  const db = await getDB();
  const type: MediaMeta["type"] = file.type.startsWith("video") ? "video" : "image";
  const meta: MediaMeta = {
    id: uid(),
    itemId,
    type,
    takenAt: file instanceof File && file.lastModified ? file.lastModified : Date.now(),
    size: file.size,
  };
  await db.put("media", { ...meta, blob: file });
  return meta;
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  const db = await getDB();
  const rec = await db.get("media", id);
  return rec?.blob ?? null;
}

export async function listMediaByItem(itemId: string): Promise<(MediaMeta & { blob: Blob })[]> {
  const db = await getDB();
  const list = await db.getAllFromIndex("media", "by-item", itemId);
  return list.sort((a, b) => a.takenAt - b.takenAt);
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("media", id);
}

export async function deleteMediaByItem(itemId: string): Promise<void> {
  const db = await getDB();
  const keys = await db.getAllKeysFromIndex("media", "by-item", itemId);
  const tx = db.transaction("media", "readwrite");
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
}

export async function mediaStorageUsage(): Promise<{ count: number; bytes: number }> {
  const db = await getDB();
  const all = await db.getAll("media");
  return { count: all.length, bytes: all.reduce((s, m) => s + (m.size || 0), 0) };
}

/* ================= 雕刻素材（v2） ================= */

export async function saveAsset(input: {
  name: string;
  kind: CarvingAsset["kind"];
  blob: Blob;
  widthMm?: number;
  heightMm?: number;
}): Promise<CarvingAsset> {
  const db = await getDB();
  // 读取图片实际像素，按 96dpi 估算默认毫米尺寸（上限 60mm）
  let widthMm = input.widthMm ?? 40;
  let heightMm = input.heightMm ?? 40;
  if (!input.widthMm || !input.heightMm) {
    try {
      const dim = await imageDimensions(input.blob);
      const scale = Math.min(60 / (dim.w / 3.78), 60 / (dim.h / 3.78), 1);
      widthMm = Math.round((dim.w / 3.78) * scale);
      heightMm = Math.round((dim.h / 3.78) * scale);
    } catch {
      /* 用默认值 */
    }
  }
  const asset: CarvingAsset = {
    id: uid(),
    name: input.name,
    kind: input.kind,
    widthMm: Math.max(5, widthMm),
    heightMm: Math.max(5, heightMm),
    size: input.blob.size,
    createdAt: Date.now(),
  };
  await db.put("assets", { ...asset, blob: input.blob });
  return asset;
}

export async function updateAsset(
  id: string,
  patch: Partial<Pick<CarvingAsset, "name" | "widthMm" | "heightMm">> & { blob?: Blob }
): Promise<void> {
  const db = await getDB();
  const rec = await db.get("assets", id);
  if (!rec) return;
  await db.put("assets", {
    ...rec,
    ...patch,
    blob: patch.blob ?? rec.blob,
    size: patch.blob ? patch.blob.size : rec.size,
  });
}

export async function listAssets(): Promise<(CarvingAsset & { blob: Blob })[]> {
  const db = await getDB();
  const all = await db.getAll("assets");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAsset(id: string): Promise<(CarvingAsset & { blob: Blob }) | null> {
  const db = await getDB();
  return (await db.get("assets", id)) ?? null;
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("assets", id);
}

export function imageDimensions(blob: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
