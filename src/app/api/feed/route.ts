import { NextResponse } from "next/server";
import type { FeedItem } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 0;

const SOURCES: { name: string; url: string }[] = [
  { name: "Hacker News", url: "https://hnrss.org/frontpage" },
  { name: "InfoQ 中文", url: "https://www.infoq.cn/feed" },
  { name: "V2EX", url: "https://www.v2ex.com/index.xml" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

/** 轻量 RSS 2.0 / Atom 解析（无第三方依赖） */
function parseFeed(xml: string, source: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const entryBlocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];

  for (const block of itemBlocks) {
    const title = stripHtml(pick(block, "title"));
    let link = stripHtml(pick(block, "link"));
    if (!link) {
      const g = pick(block, "guid");
      if (/^https?:/.test(stripHtml(g))) link = stripHtml(g);
    }
    const desc = stripHtml(pick(block, "description")).slice(0, 140);
    const pub = pick(block, "pubDate") || pick(block, "dc:date");
    const ts = pub ? Date.parse(stripHtml(pub)) : Date.now();
    if (title && link) {
      items.push({
        id: `${source}-${link}`,
        title,
        summary: desc,
        link,
        source,
        publishedAt: Number.isNaN(ts) ? Date.now() : ts,
      });
    }
  }

  for (const block of entryBlocks) {
    const title = stripHtml(pick(block, "title"));
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
    const link = linkMatch ? decodeEntities(linkMatch[1]) : "";
    const desc = stripHtml(pick(block, "summary") || pick(block, "content")).slice(0, 140);
    const pub = pick(block, "published") || pick(block, "updated");
    const ts = pub ? Date.parse(stripHtml(pub)) : Date.now();
    if (title && link) {
      items.push({
        id: `${source}-${link}`,
        title,
        summary: desc,
        link,
        source,
        publishedAt: Number.isNaN(ts) ? Date.now() : ts,
      });
    }
  }
  return items;
}

async function fetchSource(src: { name: string; url: string }): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(src.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QiqiWorkbench/1.0; +pwa)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, src.name).slice(0, 15);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const FALLBACK: FeedItem[] = [
  {
    id: "fb-1",
    title: "离线模式：网络恢复后下拉刷新获取最新资讯",
    summary: "当前无法访问资讯源，这里展示的是内置占位内容。Hacker News、InfoQ、V2EX 源将在网络可用时自动拉取。",
    link: "https://news.ycombinator.com",
    source: "系统提示",
    publishedAt: Date.now(),
  },
];

export async function GET() {
  const results = await Promise.all(SOURCES.map(fetchSource));
  let items = results.flat();
  items.sort((a, b) => b.publishedAt - a.publishedAt);
  // 去重（同链接）
  const seen = new Set<string>();
  items = items.filter((i) => {
    if (seen.has(i.link)) return false;
    seen.add(i.link);
    return true;
  });
  if (items.length === 0) {
    return NextResponse.json({ items: FALLBACK, fallback: true });
  }
  return NextResponse.json({ items: items.slice(0, 40), fallback: false });
}
