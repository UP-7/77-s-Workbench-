# 77's Workbench 技术复盘 · 从零到上线

> 学习向文档：完整记录项目的架构决策、14 个技术难点的问题分析与解决方案。

---

## 第一部分：架构决策（为什么这么选）

### 1.1 本地优先（Local-first）架构

这是整个项目最重要的顶层决策，后面所有难点的解法都源于它：

- **数据分层**：
  - 轻量结构化数据（待办/账目/库存元数据/设置）→ `LocalStorage`（经 zustand persist）
  - 大文件（照片/视频/素材 Blob）→ `IndexedDB`
  - 为什么严禁 LocalStorage 存媒体：容量上限仅 ~5MB、同步 API 阻塞主线程、Blob 需转 base64 膨胀 33%
- **服务器只做两件事**：分发静态代码、代理需要密钥或跨域的请求（AI / RSS）
- **收益**：断网可用、无账号体系、隐私天然安全、服务器几乎零成本

### 1.2 技术选型理由

| 选择 | 理由 | 备选与放弃原因 |
| --- | --- | --- |
| Next.js 14 App Router | 页面 SSG 加速首屏 + API Routes 做服务端代理，一个框架全包 | 纯 Vite SPA：无服务端能力，AI 密钥无处安放 |
| @ducanh2912/next-pwa | 原版 next-pwa 停止维护，此分支活跃且兼容 Next 14 | 手写 SW：workbox 配置成本更低 |
| Zustand + persist | 无 Provider 樣板、选择器订阅精准渲染、persist 中间件天然对接 LocalStorage | Redux：模板代码多；Context：全量重渲染 |
| idb（IndexedDB 封装） | 2KB、Promise 化、类型安全的 schema | Dexie：功能强但体积大，本项目用不到高级查询 |
| 手写手势 | 双指缩放/左滑/下拉刷新逻辑简单且需深度定制 | hammer.js 等：为几个手势引入依赖不值 |

### 1.3 移动端 UI 工程细节

- **主题系统**：CSS 变量存 HSL 分量（`--primary: 27 55% 36%`），Tailwind 里 `hsl(var(--primary))` 引用。好处：一套类名双主题、可做透明度衍生色 `hsl(var(--primary)/0.1)`
- **iOS 安全区**：`viewport-fit=cover` + `env(safe-area-inset-*)` 工具类（`.pt-safe/.pb-safe`），刘海屏/灵动岛不遮挡
- **触控体验**：点击区域 ≥44px（按钮 h-11）、`-webkit-tap-highlight-color: transparent`、`active:scale-[0.97]` 按压反馈、`overscroll-behavior-y: none` 禁止橡皮筋
- **瀑布流**：CSS `column-count` + `break-inside: avoid`，零 JS 实现 Masonry

---

## 第二部分：核心技术难点

### 难点 1：SSR 与本地存储的水合（Hydration）冲突

**问题**：zustand persist 的数据只存在于浏览器。SSR 渲染的 HTML（空数据）与客户端首帧（有数据）不一致，React 报 hydration mismatch，页面闪烁甚至崩溃。

**方案**：`ClientGate` 守卫组件——`useEffect` 置 `mounted=true` 前渲染骨架屏，挂载后才渲染真实数据。原理：`useEffect` 只在客户端执行，保证首帧与 SSR 输出一致，第二帧再展示本地数据。

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton />;
```

### 难点 2：IndexedDB 媒体库设计与版本迁移

- **Schema**：`media` 仓库以 `id` 为主键、`by-item` 索引按藏品聚合；v2 新增 `assets` 仓库（雕刻素材）
- **版本迁移**：`openDB(name, 2, { upgrade(db, oldVersion) })` 按 `oldVersion` 增量建表——老用户升级不丢数据
- **ObjectURL 生命周期**：`URL.createObjectURL` 必须配对 `revokeObjectURL`，否则 Blob 常驻内存泄漏。封装 `useMediaUrl` hook 在 `useEffect` cleanup 中统一回收

### 难点 3：全手写触控手势系统

| 手势 | 核心实现 |
| --- | --- |
| 双指缩放 | `Math.hypot` 算两指距离，`当前距离/起始距离 × 起始scale`，clamp 0.8~5 倍；双击复位用 280ms 内二次 touchstart 判定 |
| 左滑操作 | `touchmove` 中 offset 跟随手指（clamp -136~0），松手按阈值吸附或回弹；**关键细节**：滑动中关闭 CSS transition（跟手），松手才开启（回弹动画） |
| 下拉刷新 | 仅 `scrollY===0` 时启动，位移乘 0.5 阻尼系数，超阈值触发并震动反馈 |
| 包浆对比滑块 | 两张图叠放，上层 `clip-path: inset(0 0 0 X%)`，Pointer Events 拖动手柄改 X |
| 裁剪框 | **相对坐标系（0~1）**存裁剪框，渲染时乘容器尺寸、导出时乘原图像素——一套坐标三处复用；四角手柄 28px 命中半径 + `setPointerCapture` 防拖出丢失 |

**经验**：Touch 事件（多指场景）与 Pointer 事件（单指+鼠标通用）按需混用；容器加 `touch-none` 阻止浏览器默认滚动抢手势。

### 难点 4：盘玩计时器的"后台运行"

**问题**：手机浏览器切后台后 JS 定时器被节流甚至冻结，`setInterval` 累加秒数必然漏计。

**方案**：**时间戳差值法**。开始时只记录 `playingSince = Date.now()` 并持久化；任何时刻的时长 = `playSeconds + (now - playingSince)/1000`。每秒的 tick 仅刷新 UI，不参与计量——App 被杀、手机重启都不丢时长。这是"不要相信定时器，只相信时间戳"的经典实践。

### 难点 5：语音记账的三级降级链路

```
Web Speech API 识别（zh-CN, interimResults 实时回显）
   ↓ 文本
POST /api/ai/parse-expense（DeepSeek，温度0，few-shot 示例，强制 JSON 输出）
   ↓ 失败/超时(12s AbortSignal)
parseExpenseLocal 本地规则引擎
   ↓ 无论哪级成功
预填充确认表单（用户可改） → 落账
```

本地规则引擎细节：
- 金额：正则抓阿拉伯数字 + **中文数字解析器**（"二十五块"→25，处理十/百/千/万进位）+ "毛"→÷10
- 分类：领域词典匹配（8 大类 × 关键词表）
- 收支判定：收入关键词表（"卖了/工资/收到"）
- 环境不支持语音（iOS 部分 WebView）→ 直接降级手动表单，功能不断链

### 难点 6：AI 集成的可用性设计

- **协议适配**：DeepSeek 兼容 OpenAI 协议，`createOpenAI({ baseURL })` 一行切换任意网关
- **全链路降级**：无 Key → 本地模板；调用异常 → 本地模板；晨报的本地模板也做了拟人化（按时段问候 + 湿度判断提醒加湿）
- **安全**：密钥只在服务端 `process.env`，前端只调自家 `/api/*`
- **成本控制**：晨报按天缓存于 sessionStorage，手动刷新才重新生成

### 难点 7：RSS 聚合的健壮性

- **CORS**：浏览器不能直接抓第三方 RSS，走服务端 API Route 代理
- **零依赖解析**：正则提取 `<item>/<entry>` 块 + 字段，统一处理 RSS 2.0 与 Atom 两种格式、CDATA 剥离、HTML 实体解码、标签清洗
- **容错**：三源并发（`Promise.all`），每源独立 `AbortController` 9 秒超时，单源失败不影响其他；全部失败返回内置离线数据并标记 `fallback: true`，前端展示黄色提示条

### 难点 8：Canvas 艺术字与中文字体工程（最曲折）

**第一版败因**：字体列表写的是系统字体（楷体/隶书/行楷）。开发机上有，但 iOS 没有楷体、安卓只有一种黑体——Canvas 静默回退默认字体，用户切换字体毫无变化。**教训：Web 排版永远不要假设客户端有某个本地字体。**

**第二版方案**：`next/font/google` 引入 6 款开源中文字体（马善政毛笔楷、志莽行草、站酷小薇、龙藏、思源宋/黑）：
- 构建时下载字体文件、**自托管**进产物——运行时不依赖 Google，国内可用、离线可用
- 中文字体的 **unicode-range 分片机制**：一款字体切成 100+ 个 woff2 分片，浏览器只下载页面用到的字符所在分片（写"福"只拉几十 KB）
- 坑：中文字体没有可 preload 的 subset，必须 `subsets:["latin"] + preload:false`

**Canvas 渲染细节**：
- **等字体就绪**：`await document.fonts.load(fontSpec, 文本)`——带上具体文本才会触发对应分片加载；不等就绘制会用回退字体
- **防竞态**：`renderSeq` 序号，快速切换字体时旧的异步渲染作废
- **高清**：canvas 物理尺寸 ×3（`setTransform(3,0,0,3,0,0)`），导出不糊
- **竖排**：Canvas 无竖排 API，逐字绘制，列序从右向左（传统书写）
- **镜像**：`translate(w,0) + scale(-1,1)`——雕刻转印贴纸必须镜像
- **加粗**：Canvas 不产生伪粗体，单字重字体加粗无效 → `fillText + strokeText` 描边合成
- **测量**：先 `measureText` 算画布尺寸再绘制；注意重设 `canvas.width` 会重置全部 context 状态

### 难点 9：毫米级 PDF 排版导出

**需求本质**：素材按真实物理尺寸打印，贴在葫芦上 1:1 描刻。

- 每个素材存 `widthMm/heightMm`（物理尺寸），编辑器可改（锁比例联动）
- **流式装箱算法**：A4 版心（210-24mm）内从左到右摆放，放不下换行（行高=本行最高元素），页满 `addPage()`；单图超版心先等比缩到最大
- jsPDF 用 `unit:"mm"` 直接毫米作业，免像素换算；图片走 `Blob→FileReader→DataURL→addImage`
- 每图画浅灰裁切参考框 + 尺寸标注文字
- **Word 导出**：生成带 `xmlns:w` 命名空间的 HTML，`<img style="width:Xmm">` 内嵌 base64，Blob 类型 `application/msword` 存为 `.doc`——Word/WPS 可直接打开（Office 的 HTML 兼容模式）

### 难点 10：TS 编译目标的迭代坑

`for...of Set` / 字符串扩展在默认 target（ES5）下报错 `Type 'Set<string>' can only be iterated...`。解法：`tsconfig.json` 提升 `target: "ES2017"`——现代移动浏览器全部支持，还减少 polyfill 体积。备选 `downlevelIteration` 会生成额外辅助代码，不如直接提目标。

---

## 第三部分：交付与部署实战

### 难点 11：端口冲突的三次排查

现象链：用户访问 3000 看到陌生"登录页"→ 其实是另一个项目占了端口，我们的服务启动时 `EADDRINUSE` 静默失败。

**方法论**：
```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN   # 谁在监听
lsof -p <PID> | awk '$4=="cwd"'    # 该进程的项目目录 → 定位是哪个项目
tail /tmp/xxx.log                   # 自己服务的启动日志（EADDRINUSE 藏在这里）
```

### 难点 12：安全上下文（Secure Context）限制

浏览器把强能力锁在 HTTPS/localhost：Service Worker、Notification、getUserMedia（摄像头/麦克风）、BarcodeDetector。局域网 `http://10.x.x.x` 全部静默不可用——"权限申请点了没反应"的真相。

**工程应对**：`window.isSecureContext` 检测 + 权限页明示"当前 HTTP 环境不可用"，把静默失败变成明确提示。**根治**：HTTPS 部署。

另附：办公 WiFi 常开 AP 隔离（客户端互访被禁），局域网调试不通时先怀疑网络策略，可用手机热点绕过。

### 难点 13：EdgeOne Pages 部署的四个坑

1. **CLI 版本断层**：IDE 集成调用已废弃的 `edgeone pages` 子命令必失败 → 直接用新版 `npx edgeone makers deploy`
2. **两套凭据**：IDE 里的腾讯云授权 ≠ CLI 登录态，`edgeone whoami` 验证后者
3. **`Zone is not active`**：服务开通时站点初始化失败，控制台点"重试"即可
4. **eo_token 合规限制**：大陆区域默认域名强制 3 小时 token 鉴权且**不可关闭**。出路三选一：绑自定义域名（选"全球不含大陆"区域可免备案）/ Vercel（域名公开但大陆连通性看运气）/ 离线过渡方案（见难点 14）

### 难点 14：离线优先缓存策略调优（token 限制的技术自救）

**初版缺陷**：runtimeCaching 用 `NetworkFirst`——有网但 token 过期时，网络"成功"返回 401 页面并直接展示，App 反而打不开；只有彻底断网才回落缓存。

**终版策略**：
```js
handler: "StaleWhileRevalidate",
options: { cacheableResponse: { statuses: [0, 200] } }
```
- **StaleWhileRevalidate**：有缓存立即返回（打开永远秒开且成功），同时后台静默请求更新
- **cacheableResponse [0,200]**：后台请求若是 401 直接丢弃，**不污染缓存**；只有 200 才更新
- 结果：token 有效期内自动拿新版；过期后 App 继续用旧缓存正常运行——把平台限制的伤害面缩小到"更新时才需要新链接"

**PWA 更新机制**（配套理解）：`skipWaiting + clientsClaim` 让新 SW 立即接管；浏览器每次导航按字节比对 `sw.js`，变了就后台拉新资源。安装到桌面的应用会自动更新代码，唯独 manifest 快照（图标/名称）多数平台不刷新，需重新添加。

---

## 第四部分：可复用的工程原则

1. **降级链思维**：每个依赖外部环境的功能（AI/语音/扫码/字体/网络）都设计"次优路径"，功能可降级但不断链
2. **不信任定时器，信任时间戳**（计时器）；**不信任本地字体，自托管**（Canvas）；**不信任网络响应，校验后再缓存**（SW）
3. **相对坐标系**贯穿交互（裁剪框 0~1 坐标三处复用）；**物理单位**贯穿输出（毫米从编辑到 PDF 一致）
4. **静默失败是体验之敌**：环境不支持就明说（安全上下文提示、离线提示条、字体加载角标）
5. **排查三板斧**：日志文件（服务真实报错）→ lsof（端口/进程归属）→ curl 分层验证（首页/manifest/sw 逐个测）

## 延伸学习关键词

Service Worker 生命周期与 Workbox 策略 · IndexedDB 事务与索引 · CSS unicode-range 字体分片 · Pointer Events 与手势数学 · OpenAI 兼容协议生态 · Local-first 软件理念（CRDT 是进阶方向）
