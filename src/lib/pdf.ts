"use client";

/** PDF 处理：首页渲染为 PNG（浏览器端，pdf.js classic worker） */

export async function pdfFirstPageToPng(blob: Blob, maxWidth = 1400): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist");
  // 使用 CDN 加载 worker（版本与安装包一致，首次加载后由 SW 缓存可离线复用）
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await blob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / base.width, 3);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PDF 转图片失败"))), "image/png")
    );
  } finally {
    void loadingTask.destroy();
  }
}
