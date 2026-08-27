"use client";

/** Tesseract.js 本地 OCR（懒加载单例；模型首次联网下载后被 SW 缓存，可离线复用） */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("chi_sim+eng");
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

export async function tesseractRecognize(image: Blob): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return String(data?.text || "");
}
