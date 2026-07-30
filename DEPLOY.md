# 腾讯云 EdgeOne Pages 上线手册

> 适用项目：77的工作台（Next.js 全栈 PWA）
> **正式地址**：https://hyqfxr.site（自定义域名，免备案，永久有效无 token）
> 当前项目（海外区域）：`qiqi-workbench-hw` · ID：`makers-spg3crwfmrtm`
> 旧项目（已弃用）：`qiqi-workbench` · ID：`makers-nj7pfho3jvjl`

---

## 〇、手动上线全流程速查

```bash
cd ~/Documents/model/modelA

# 1.（可选）本地先跑通：npm run dev 调试，改完退出
# 2. 构建验证（必须过，报错就先修）
npm run build

# 3. 发布到线上（约 2~3 分钟，看到 Deploy Success 即成功）
npx edgeone makers deploy . -n qiqi-workbench-hw -e production -a overseas

# 4. 手机验证：打开 https://hyqfxr.site（已安装的把 App 关开 1~2 次拿新版）

# 5.（推荐）代码备份到 GitHub
git add -A && git commit -m "feat: 本次改了什么" && git push
```

---

## 一、一次性准备（已完成，换电脑才需要重做）

1. **腾讯云账号**：注册 + 实名认证（https://cloud.tencent.com）
2. **开通 EdgeOne Pages**：控制台搜索 EdgeOne → Makers/Pages → 首次进入按引导开通（免费）
   - 若提示"站点初始化失败"，点提示旁的"重试"直到右上角出现站点名（如 default-pages-zone）
3. **CLI 登录**（本机执行一次）：
   ```bash
   npx edgeone login      # 浏览器弹出授权，点确认
   npx edgeone whoami     # 显示账号信息即为成功
   ```

---

## 二、每次发布（日常就这三步，约 5 分钟）

在项目根目录（`~/Documents/model/modelA`）执行：

```bash
# 1. 本地构建（验证代码没问题）
npm run build

# 2. 部署到腾讯云（上传 + 云端构建，约 2~3 分钟）
npx edgeone makers deploy . -n qiqi-workbench-hw -e production -a overseas

# 3. 手机直接访问 https://hyqfxr.site 验证（无需任何链接）
```

部署成功的标志：终端输出 `Deploy Success` + 一条 `Deploy URL`。

---

## 三、手机使用与更新（域名版，已无 token 限制）

- **安装**：手机浏览器（iPhone 用 Safari / 安卓用 Chrome）打开 **https://hyqfxr.site** → 各页面逛一遍 → "添加到主屏幕"
- **日常**：随时随地打开，离线也能用（本地功能全量可用）
- **版本更新**：发布新版后，手机把 App 关闭重开 1~2 次即自动拿到新版，无需任何手动操作
- 旧的带 `eo_token` 的预览链接已不再需要，忽略即可

---

## 三·五、线上 AI 功能配置（可选，一次性）

线上想让 AI 晨报 / 语音智能解析走 DeepSeek（不配置则自动用内置本地引擎，功能不缺失）：

1. 控制台 → 项目 `qiqi-workbench-hw` → **项目设置** → **环境变量** → 新增：
   - `DEEPSEEK_API_KEY` = 你的密钥（platform.deepseek.com 申请）
   - 可选：`AI_BASE_URL`（默认 https://api.deepseek.com/v1）、`AI_MODEL`（默认 deepseek-chat）
2. 环境变量在**下一次部署后生效** → 重新执行一次发布命令
3. 验证：首页晨报右下角显示「DeepSeek 生成」即成功
4. ⚠️ 密钥只放控制台环境变量或本地 `.env.local`，**绝不能**写进代码或提交 Git

---

## 四、三种部署方式（任选其一）

| 方式 | 操作 | 适合场景 |
|---|---|---|
| **CLI 命令**（当前用法） | `npx edgeone makers deploy . -n 项目名 -e production` | 本机开发，最快 |
| **控制台直接上传** | Makers 页面 →「直接上传」→ 拖入项目文件夹 | 不想碰命令行 |
| **Git 自动部署** | Makers →「导入 Git 仓库」→ 关联 GitHub/Gitee 仓库 | 代码推送后**自动**构建发布，一劳永逸（需先把代码传到 Git 仓库） |

---

## 五、彻底去掉 3 小时限制（可选，花几十元/年）

1. 买一个域名（腾讯云/阿里云/Namesilo 均可，`.top` `.xyz` 首年约 ¥10~30）
2. 控制台 → 项目 → **域名管理** → 添加自定义域名（如 `app.你的域名.top`）
3. 加速区域选「**全球可用区（不含中国大陆）**」→ **免备案**
4. 到域名商处按提示添加一条 CNAME 解析
5. 之后手机直接访问你的域名，永久有效、无 token
   - 一个域名可用不同子域名绑定多个项目（`app.xxx` / `blog.xxx` / `demo.xxx`）

---

## 六、常见问题

| 问题 | 处理 |
|---|---|
| `Zone is not active` | 控制台开通/重试站点初始化（见"一、2"） |
| `Could not find a production build` | 先跑 `npm run build` 再部署/启动 |
| 部署卡在 Uploading | 网络问题，Ctrl+C 重新执行部署命令 |
| 401 Authorization Required | token 过期，控制台「预览」生成新链接 |
| 新增依赖后云端构建失败 | 确认 `package.json` 已提交，本地 `npm run build` 能过再部署 |

---

## 七、部署其他新项目

```bash
cd 新项目目录
npx edgeone makers deploy . -n 新项目名 -e production
```

免费套餐支持多个项目，每个项目独立域名与部署记录，互不影响。
