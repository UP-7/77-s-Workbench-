# 77's Workbench · 77的工作台

> A personal, offline-first PWA "second brain" for mobile — daily planner, tech feed, voice expense tracker, artifact collection gallery, gourd business ledger, and a carving-material studio, all in one app.

面向个人的移动端「第二大脑」PWA：计划、资讯、文玩、账本、商账、雕刻素材，一站式轻应用。支持添加到手机桌面，全屏、离线、可推送，体验接近原生 App。

## ✨ 功能模块

| 模块 | 亮点 |
| --- | --- |
| 🏠 首页 Dashboard | AI 晨报（天气 + 待办 + 文玩养护拟人化问候）、今日完成率 / 月支出 / 库存预警、FAB 快捷入口 |
| 📅 每日计划 Planner | 月历打点、左滑完成/删除、划掉动画、到点系统通知提醒 |
| 📰 技术资讯 Tech Feed | Hacker News / InfoQ / V2EX 聚合，下拉刷新，收藏（LocalStorage） |
| 💎 文玩阁 Collection | 拍摄/相册多选入库（IndexedDB）、瀑布流、大图双指缩放、盘玩计时器（后台安全 + 震动提醒）、照片时间轴与包浆 Before/After 滑块对比 |
| ✒️ 素材坊 Atelier | DIY 艺术字（6 款开源中文字体 / 空心描边 / 竖排 / 镜像）、简笔画素材库、毫米级尺寸 / 裁剪 / 翻转编辑、批量 A4 排版导出 PDF & Word |
| 💰 收支账本 Finance | Web Speech 语音记账（"今天午饭花了25块" → 自动解析金额/类别/备注）、AI + 本地规则双解析、不支持语音自动降级表单 |
| 🏪 葫芦商账 Business | 库存三态流转（在库/预定/已售）、扫码定位（BarcodeDetector 降级编号搜索）、成本/售出/损耗记账、月度利润图与畅销榜 |
| ⚙️ 设置 Settings | PWA 安装引导（含 iOS 指引）、JSON 备份导入导出、通知/摄像头/麦克风权限管理（含 HTTP 环境提示） |

## 🛠 技术栈

| 领域 | 方案 |
| --- | --- |
| 框架 | Next.js 14 (App Router) · React 18 · TypeScript |
| 样式 | Tailwind CSS（移动端优先；自研双指缩放 / 左滑 / 下拉刷新手势） |
| 状态 | Zustand + persist |
| AI | Vercel AI SDK（DeepSeek / 任意 OpenAI 兼容网关），无 Key 自动降级本地规则 |
| PWA | @ducanh2912/next-pwa（Service Worker + Manifest + 离线优先缓存策略） |
| 字体 | next/font 自托管开源中文字体（Ma Shan Zheng / Noto SC 等，分片按需加载） |
| 轻量数据 | LocalStorage（配置、待办、账目、库存元数据） |
| 媒体大文件 | IndexedDB（照片 / 视频 / 素材 Blob，严禁走 LocalStorage） |
| 导出 | jsPDF（A4 毫米级排版分页）· HTML→Word(.doc) |
| 图表 | Recharts |

## 🚀 快速开始

```bash
npm install
npm run dev                 # 开发模式（Service Worker 关闭）
npm run build && npm start  # 生产模式（完整 PWA 能力）
```

可选 AI 配置（`.env.local`，参考 `.env.example`）：

```bash
DEEPSEEK_API_KEY=sk-xxx
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

> 不配置 Key 时，AI 晨报 / 语音解析自动切换到内置本地引擎，全部功能可用。

## 📱 部署与安装到手机

完整流程见 [DEPLOY.md](./DEPLOY.md)（腾讯云 EdgeOne Pages 免费部署手册）。

```bash
npm run build
npx edgeone makers deploy . -n qiqi-workbench -e production
```

部署后用手机打开 Deploy URL → 添加到主屏幕 → 之后离线随时可用。

## 🔒 隐私

本地优先设计：所有业务数据仅存于设备本地（LocalStorage + IndexedDB），服务器只分发代码与代理 AI/RSS 请求；AI Key 仅存服务端环境变量，绝不下发客户端。

## 📄 License

MIT · Made for 77
