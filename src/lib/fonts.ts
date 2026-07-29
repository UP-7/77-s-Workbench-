import {
  Ma_Shan_Zheng,
  Zhi_Mang_Xing,
  ZCOOL_XiaoWei,
  Long_Cang,
  Noto_Serif_SC,
  Noto_Sans_SC,
} from "next/font/google";

/**
 * 雕刻艺术字字体：全部为开源中文字体，
 * next/font 构建时下载并自托管（分片按需加载，离线可用）。
 */
const maShanZheng = Ma_Shan_Zheng({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
const zhiMangXing = Zhi_Mang_Xing({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
const zcoolXiaoWei = ZCOOL_XiaoWei({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
const longCang = Long_Cang({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
const notoSerif = Noto_Serif_SC({ weight: ["400", "700"], subsets: ["latin"], preload: false, display: "swap" });
const notoSans = Noto_Sans_SC({ weight: ["400", "700"], subsets: ["latin"], preload: false, display: "swap" });

export const CARVING_FONTS: { label: string; family: string; weight?: number }[] = [
  { label: "毛笔楷", family: maShanZheng.style.fontFamily },
  { label: "行草", family: zhiMangXing.style.fontFamily },
  { label: "古风", family: zcoolXiaoWei.style.fontFamily },
  { label: "手写", family: longCang.style.fontFamily },
  { label: "宋体", family: notoSerif.style.fontFamily },
  { label: "宋·粗", family: notoSerif.style.fontFamily, weight: 700 },
  { label: "黑体", family: notoSans.style.fontFamily },
  { label: "黑·粗", family: notoSans.style.fontFamily, weight: 700 },
];
