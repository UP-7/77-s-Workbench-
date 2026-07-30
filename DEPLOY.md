# 腾讯云 EdgeOne Pages 上线手册

> 适用项目：77的工作台（Next.js 全栈 PWA）
> **当前项目（海外区域，绑自定义域名免备案）**：`qiqi-workbench-hw` · ID：`makers-spg3crwfmrtm`
> 旧项目（含大陆区域，默认域名带 3 小时 token）：`qiqi-workbench` · ID：`makers-nj7pfho3jvjl`

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

# 3. 复制输出里的 Deploy URL（带 eo_token 的完整链接），手机打开
```

部署成功的标志：终端输出 `Deploy Success` + 一条 `Deploy URL`。

---

## 三、手机使用与更新

- **首次安装**：手机浏览器（iPhone 用 Safari / 安卓用 Chrome）打开 Deploy URL → 各页面逛一遍 → "添加到主屏幕"
- **链接时效**：Deploy URL 里的 `eo_token` 仅 **3 小时有效**（平台合规限制，无法关闭）。过期后：
  - 已安装的 App **不受影响**，靠离线缓存照常使用（本地功能全可用）
  - 需要新链接时：控制台 → 项目概览 → 右上角「**预览**」按钮，随时生成新链接
- **版本更新**：发布新版后，用新的预览链接打开一次，App 自动更新缓存

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
