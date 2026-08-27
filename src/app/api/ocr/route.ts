import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { mapVatInfos } from "@/lib/invoice/parse";

export const runtime = "nodejs";
export const maxDuration = 30;

/** 腾讯云 OCR 未配置时抛出，前端据此降级到本地 Tesseract */
class OcrNotConfiguredError extends Error {
  constructor() {
    super("OCR_NOT_CONFIGURED");
  }
}

function sha256hex(msg: string): string {
  return crypto.createHash("sha256").update(msg, "utf8").digest("hex");
}

function hmac(key: Buffer | string, msg: string): Buffer {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest();
}

/** 腾讯云 API TC3-HMAC-SHA256 签名调用（仅服务端，密钥走环境变量） */
async function tencentOcr(
  action: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) throw new OcrNotConfiguredError();

  const host = "ocr.tencentcloudapi.com";
  const service = "ocr";
  const version = "2018-11-19";
  const region = process.env.TENCENT_OCR_REGION || "ap-guangzhou";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);

  const canonicalRequest = [
    "POST",
    "/",
    "",
    `content-type:application/json; charset=utf-8\nhost:${host}\n`,
    "content-type;host",
    sha256hex(body),
  ].join("\n");

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = crypto
    .createHmac("sha256", secretSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=content-type;host, Signature=${signature}`;

  const res = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: authorization,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Region": region,
    },
    body,
    signal: AbortSignal.timeout(25_000),
  });

  const data = (await res.json()) as {
    Response?: { Error?: { Code: string; Message: string } } & Record<string, unknown>;
  };
  if (!data.Response) throw new Error("腾讯云返回异常");
  if (data.Response.Error) {
    throw new Error(`${data.Response.Error.Code}: ${data.Response.Error.Message}`);
  }
  return data.Response;
}

export async function GET() {
  return NextResponse.json({
    configured: !!(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { imageBase64?: unknown };
    const imageBase64 = body.imageBase64;
    if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
      return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });
    }
    if (imageBase64.length > 9_500_000) {
      return NextResponse.json({ error: "图片过大，请压缩后重试" }, { status: 413 });
    }

    const resp = await tencentOcr("VatInvoiceOCR", { ImageBase64: imageBase64 });
    const infos = (resp.VatInvoiceInfos || []) as Array<{ Name: string; Value: string }>;
    const fields = mapVatInfos(infos);
    const rawText = infos.map((i) => `${i.Name}: ${i.Value}`).join("\n");

    return NextResponse.json({ fields, rawText });
  } catch (e) {
    if (e instanceof OcrNotConfiguredError) {
      return NextResponse.json({ error: "OCR_NOT_CONFIGURED" }, { status: 501 });
    }
    const msg = e instanceof Error ? e.message : "OCR 识别失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
