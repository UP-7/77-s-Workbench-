/** 带重试的 fetch：5xx 自动等待重试，AbortError 尊重调用方取消 */
export async function fetchRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: { retries?: number; delays?: number[] } = {}
): Promise<Response> {
  const delays = opts.delays ?? [1500, 4000];
  const retries = opts.retries ?? delays.length;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.status >= 500 && attempt < retries) {
        await sleep(delays[Math.min(attempt, delays.length - 1)]);
        continue;
      }
      return res;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      lastErr = e;
      if (attempt < retries) {
        await sleep(delays[Math.min(attempt, delays.length - 1)]);
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("网络请求失败");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
