"use client";

/** 图片工具：缩略图、压缩、Base64 转换（纯浏览器端） */

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("读取文件失败"));
    fr.readAsDataURL(blob);
  });
}

/** 返回不带 data: 前缀的纯 base64 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const url = await blobToDataURL(blob);
  return url.slice(url.indexOf(",") + 1);
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片解码失败"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas 导出失败"))), type, quality);
  });
}

function drawScaled(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** 生成 PNG 缩略图（用于网格预览） */
export async function makeThumb(blob: Blob, maxSide = 360): Promise<Blob> {
  const img = await loadImage(blob);
  return canvasToBlob(drawScaled(img, maxSide), "image/png");
}

/** 压缩为 JPEG 供 OCR 上传（控制 base64 体积） */
export async function compressForOcr(blob: Blob, maxSide = 2000, quality = 0.85): Promise<Blob> {
  if (blob.size < 900_000 && blob.type === "image/jpeg") return blob;
  const img = await loadImage(blob);
  return canvasToBlob(drawScaled(img, maxSide), "image/jpeg", quality);
}
