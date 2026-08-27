"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { InvoiceBatch } from "@/lib/types";

/**
 * 发票文件 IndexedDB（与 db.ts 的 qiqi-workbench 隔离，避免 DB 名冲突）。
 * files store 存原文件 / 缩略图 / PDF 首页 Blob；
 * batches store 存历史批次元数据。
 */
const DB_NAME = "qiqi-invoice";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB 仅在客户端可用");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
        if (!db.objectStoreNames.contains("batches"))
          db.createObjectStore("batches", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

/* ---------- 文件 Blob ---------- */

export async function putFile(key: string, blob: Blob) {
  await (await getDB()).put("files", blob, key);
}

export async function getFile(key: string): Promise<Blob | undefined> {
  return (await getDB()).get("files", key);
}

export async function deleteFile(key: string) {
  await (await getDB()).delete("files", key);
}

/** 删除某条发票记录关联的所有 Blob（原文件/缩略图/PDF 首页） */
export async function deleteInvoiceFiles(id: string) {
  await Promise.all([deleteFile(id), deleteFile(`${id}_thumb`), deleteFile(`${id}_page`)]);
}

/* ---------- 批次 ---------- */

export async function saveBatch(batch: InvoiceBatch) {
  await (await getDB()).put("batches", batch);
}

export async function getBatches(): Promise<InvoiceBatch[]> {
  const list = (await (await getDB()).getAll("batches")) as InvoiceBatch[];
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteBatchDB(id: string) {
  await (await getDB()).delete("batches", id);
}

export async function clearAllIDB() {
  const db = await getDB();
  await db.clear("files");
  await db.clear("batches");
}
