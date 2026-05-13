# 日常博客 · 特性与技术栈

## 项目概览

基于 Astro Charm 主题的日常博客（IUHNEHC），记录碎碎念、读书感悟和胡思乱想。

- **域名**: `https://haibarai.dpdns.org`
- **开发**: `http://localhost:4321`
- **技术博客**: `https://xuchenhui.cc`（使用同一套 Waline 评论服务）
- **作者**: CHENHUI
- **建站时间**: 2026-05-01

---

## 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| Astro | 静态站点框架 | v5.15.9 |
| Astro Charm | 博客主题 | workspace（monorepo） |
| pnpm | 包管理器 | v11+ |
| TypeScript | 开发语言 | - |
| Waline | 评论系统 | 服务端 @waline/vercel + 客户端 @waline/client v3.13 |
| MongoDB Atlas | Waline 数据库 | M0 Sandbox 免费版 |
| Vercel | Waline 服务端托管 | Hobby 免费版 |
| GitHub Actions | CI/CD 部署 | ubuntu-latest |
| GitHub Pages | 博客托管 | gh-pages 分支 |
| Cloudflare | DNS + CDN 代理 | orange cloud（proxied） |

---

## 项目结构

```
Garden/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions 部署工作流
├── package/                        # Astro Charm 主题源码（monorepo 子包，一般不改）
├── playground/                     # 博客站点（日常博客）
│   ├── src/
│   │   ├── components/
│   │   │   ├── CustomScriptComponent.astro   # 全局 CSS + 背景图 + About 统计
│   │   │   ├── CustomPostHeaderBottom.astro  # 文章头部多语言提示
│   │   │   └── WalineComment.astro           # 文章底部评论组件
│   │   ├── content/
│   │   │   ├── posts/                        # 博客文章目录（.md 文件）
│   │   │   └── specials/                     # 侧边栏特殊页面
│   │   │       ├── about.md                  # 关于页
│   │   │       ├── murmur.md                 # 碎碎念页（含 per-item 评论）
│   │   │       └── friends.md                # 友链页
│   │   └── content.config.ts                 # 内容集合定义
│   ├── public/
│   │   ├── favicon/                          # 站点图标
│   │   ├── scripts/
│   │   │   └── anime-bg.js                   # 二次元背景图切换脚本
│   │   └── favicon.svg                       # 默认 favicon
│   ├── charm.theme.ts                        # 主题配置（站点信息、侧边栏、组件注册）
│   ├── astro.config.ts                       # Astro 配置（site URL、output、集成）
│   ├── package.json                          # 站点依赖
│   └── .env                                  # Waline 服务端 URL（gitignored）
├── package.json             # monorepo 根配置
├── pnpm-lock.yaml           # 依赖锁文件
├── pnpm-workspace.yaml      # monorepo 工作区配置
├── BLOG_FEATURES.md         # 本文档
├── CLAUDE.md                # Claude Code 项目指南
└── ASTRO_CHARM_REFERENCE.md # Charm 主题参考文档
```

---

## 已实现特性

### 1. 动态二次元背景图
- **脚本**: `playground/public/scripts/anime-bg.js`（静态文件，实时生效，无构建依赖）
- **注入**: 通过 `CustomScriptComponent.astro` 的 `<script is:inline src="/scripts/anime-bg.js">`，在 `<head>` 末尾注入
- **API 源**:
  - 主用：夜轻 API（`api.yppp.net/pc.php` 横屏 / `pe.php` 竖屏）
  - 备用：赫萝 API（`api.horosama.com`）
- **切换方式**: 每 30 秒自动切换，两张 `<img>` 交替 CSS `opacity` 过渡（1.2s ease）
- **自适应**: 横屏 `object-position: right center` 靠右显示；竖屏 `center top` 居中覆盖
- **透明度**: 亮色模式 `opacity: 0.18` / 暗色模式 `opacity: 0.22`
- **实现要点**:
  - 容器 `<div id="anime-bg">` 由 JS 动态创建并插入 `<body>`
  - `z-index: -1` + `pointer-events: none` 不影响交互
  - `html.charm body { background-color: transparent !important; }` 让背景图透出
  - 同时监听 `DOMContentLoaded` 和 `astro:page-load`（兼容 Astro View Transitions SPA 导航）
  - 带 `initialized` 标志位防止重复初始化

### 2. Waline 评论系统

#### 博客文章评论
- **组件**: `playground/src/components/WalineComment.astro`
- **注册**: 通过 `charm.theme.ts` 的 `overrides.custom.CustomPostFooterBottom` 注入到每篇文章底部
- **初始化参数**:
  - `reaction: true` — 表情反应（点赞/踩）
  - `pageview: true` — 阅读量计数
  - `dark: "html.charm.dark"` — 跟随主题暗色模式
  - `requiredMeta: ["nick", "mail"]` — 昵称和邮箱必填，关闭匿名评论
- **CDN 加载**: 使用 `https://unpkg.com/@waline/client@3/` 动态导入 JS + CSS，不走 node_modules 打包（绕过 Astro 的 `<script is:inline>` 无法 bundle import 的限制）
- **数据传递**: 通过 `<div>` 的 `data-serverurl` 和 `data-path` 属性传递变量

#### 碎碎念每条独立评论
- **实现**: `playground/src/content/specials/murmur.md` 内的 inline script
- **每条说说**：一个 `<button>` + 隐藏的 `<div>` 评论区容器
- **点击展开**：`window.toggleComment(id)` 函数，懒加载 Waline
  - 首次点击加载 Waline JS/CSS + `mod.init()`
  - 再次点击切换显示/隐藏
- **path**: `/murmur/{日期}`（如 `/murmur/2026-05-10`），实现每条说说评论独立
- **全局函数**: `toggleComment` 挂在 `window` 上，供 HTML 的 `onclick` 调用

#### Waline 服务端配置
- **地址**: `https://waline-comment-smoky.vercel.app`
- **数据库**: MongoDB Atlas（M0 Sandbox 免费版）
  - 环境变量：`MONGO_DB=waline`、`MONGO_USER=chenhui2422xu_db_user`、`MONGO_HOST=cluster0.ruazaa0.mongodb.net`、`MONGO_OPT_SSL=true`
- **已授权域名（SECURE_DOMAINS）**:
  `localhost:4322, localhost, garden-jade-eight.vercel.app, xuchenhui.cc, eosphor.dpdns.org, xuchenhui.dpdns.org, haibarai.dpdns.org`
- **管理后台**: `https://waline-comment-smoky.vercel.app/ui/`
  - 首次登录需注册，第一注册用户自动成为管理员
  - 管理功能：删除/编辑评论、设置精选、查看统计、配置敏感词等

### 3. About 页面统计
- **实现**: 构建时在 `CustomScriptComponent.astro` 的 frontmatter 中通过 `getCollection("posts")` 统计
- **数据项**: 文章数、标签数、全站字数、建站时间、运行天数、最后更新日期
- **字数趣味对照**: 自动计算相当于多少本《活着》（约 11 万字/本）
- **展示**: `about.md` 中的 `<ul id="site-stats-dynamic">`，由 JS 在 `DOMContentLoaded` 时动态填充
- **数据传递**: 通过 `<script define:vars>` 注入 `window.__siteStats` 全局变量

### 4. 侧边栏导航

| 入口 | 文件 | URL | 说明 |
|------|------|-----|------|
| 首页 | - | `/` | 博客文章列表 |
| 碎碎念 | `specials/murmur.md` | `/murmur` | 短文流，时间戳 + 内容 + 独立评论 |
| 朋友们 | `specials/friends.md` | `/friends` | 友链卡片网格 |
| 关于 | `specials/about.md` | `/about` | 个人介绍 + 博客统计 |
| 归档 | 主题内置 | `/archive` | 文章归档（自动生成） |
| 搜索 | 主题内置 | `/search` | 站内搜索（自动生成） |

### 5. 友链页
- **文件**: `playground/src/content/specials/friends.md`
- **布局**: CSS Grid 卡片网格（`auto-fill, minmax(200px, 1fr)`）
- **卡片**: 头像 + 名称 + 描述，悬停上浮效果
- **申请**: 邮件链接 `chenhui2422.xu@gmail.com`
- **当前友链**: CHENHUI · 技术博客（`xuchenhui.cc`）
- **头像**: DiceBear pixel-art 风格（`api.dicebear.com/7.x/pixel-art/svg?seed=xxx`）

---

## 配置指南

### 主题配置（charm.theme.ts）

`playground/charm.theme.ts` 是博客的核心配置：

```typescript
config: {
  lang: "zh-CN",                        // 语言
  title: "IUHNEHC",                     // 站点标题
  titleSuffix: " · 随想",               // 标题后缀
  description: "记录日常的碎碎念、读书感悟和胡思乱想",
  author: "CHENHUI",                    // 作者
  licenseId: "CC-BY-NC-SA-4.0",         // 文章许可协议
  shootingStar: true,                   // 流星效果
  font: "auto",                         // 字体（auto 自动选择）
  side: {
    title: "IUHNEHC",                   // 侧边栏标题
    sub: "吾生也有涯，而知也无涯",       // 侧边栏副标题
    bio: "这里是一些日常的碎碎念和想法。",
    navHome: {                          // 首页导航配置（图标集使用 Iconify solar 图标）
      title: "首页", link: "/",
      icon: { default: "solar:home-smile-broken", hover: "solar:home-smile-outline", active: "solar:home-smile-bold-duotone" },
    },
    footer: [                           // 底部社交链接
      { title: "GitHub",    link: "https://github.com/CHENHUI-X",         icon: "simple-icons:github" },
      { title: "Bilibili",  link: "https://space.bilibili.com/294132471", icon: "simple-icons:bilibili" },
      { title: "Email",     link: "mailto:chenhui2422.xu@gmail.com",      icon: "simple-icons:gmail" },
    ],
    navStyle: "default",                // 导航样式
    footerStyle: "default",             // 底部样式
    toc: { enabled: true, title: "目录", minLength: 2 },
  },
  markdown: {
    headingAnchor: "#",                 // 标题锚点符号
  },
}
overrides: {
  components: { ShootingStar: undefined },  // 禁用内置流星组件（因为启用了 shootingStar: true，不需要额外加载）
  custom: {
    CustomScriptComponent: "./src/components/CustomScriptComponent.astro",   // <head> 末尾
    CustomPostHeaderBottom: "./src/components/CustomPostHeaderBottom.astro", // 文章标题下方
    CustomPostFooterBottom: "./src/components/WalineComment.astro",          // 文章底部
  },
}
```

**注意**：
- `CustomPostHeaderBottom` 是多语言文章切换提示（可以不配，不影响核心功能）
- 自定义组件路径基于 `playground/` 目录
- 图标使用 Iconify 格式，支持 `solar:`、`simple-icons:` 等前缀

### Astro 配置（astro.config.ts）

```typescript
// playground/astro.config.ts
export default defineConfig({
  prefetch: true,
  site: "https://haibarai.dpdns.org/",    // 站点 URL（影响 canonical URL 和 sitemap）
  output: "static",                         // 静态输出
  integrations: [charm],
});
```

### 侧边栏页面（specials 目录）

在 `playground/src/content/specials/` 下创建 .md 文件即可自动生成侧边栏入口：

```markdown
---
title: "页面标题"         # 侧边栏显示文字
icon:
  default: "solar:..."    # 默认图标
  hover: "solar:..."      # 悬停图标
  active: "solar:..."     # 选中图标
published: 2026-05-10     # 发布日期（影响排序）
index: 1                  # 侧边栏显示顺序（数字越小越靠前）
---

页面内容（支持 HTML + Markdown 混写）
```

### 博客文章（posts 目录）

在 `playground/src/content/posts/` 下创建 .md 文件：

```markdown
---
title: "文章标题"             # 必填
published: 2026-05-10        # 必填
description: "文章描述"       # 选填，用于 SEO 和列表预览
tags: ["tag1", "tag2"]       # 选填，标签
category: "分类名"            # 选填，分类
draft: false                  # 选填，草稿模式
image:                        # 选填，文章封面图
  src: "/path/to/image.png"
  width: 1200
  height: 600
  format: "png"
---

文章正文（Markdown）
```

### 评论配置（.env）

```env
PUBLIC_WALINE_SERVER_URL=https://waline-comment-smoky.vercel.app
```

此文件在 `.gitignore` 中，部署时需在 GitHub Actions Secrets 中配置，或直接在 workflow 中设置环境变量。

### Waline 初始化参数说明

| 参数 | 当前值 | 说明 |
|------|--------|------|
| `serverURL` | `https://waline-comment-smoky.vercel.app` | Waline 服务端地址 |
| `path` | `/文章slug` 或 `/murmur/日期` | 评论区分标识 |
| `lang` | `zh-CN` | 界面语言 |
| `reaction` | `true` | 允许表情反应（点赞/踩） |
| `pageview` | `true` | 显示阅读量 |
| `dark` | `html.charm.dark` | 暗色模式 CSS 选择器 |
| `requiredMeta` | `["nick", "mail"]` | 必填字段（关闭匿名评论） |

---

## 部署

### 博客部署（GitHub Pages + Cloudflare）

**GitHub Actions 工作流**（`.github/workflows/deploy.yml`）：

```yaml
name: Deploy Garden Blog to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: latest }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run playground:build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: haibarai.dpdns.org    # 自动创建 CNAME + .nojekyll
```

**构建输出**: `playground/dist/`（通过 `pnpm run playground:build`，实际为 `pnpm --filter playground build --outDir ../dist`）

**关键点**:
- `cname` 参数让 action 自动在 gh-pages 分支创建 `CNAME` + `.nojekyll`
- `.nojekyll` 防止 GitHub Pages 默认用 Jekyll 构建报错

**Cloudflare DNS**:
- 域名 `haibarai.dpdns.org` 通过 Cloudflare 代理（orange cloud）
- DNS 记录：4 条 A 记录指向 GitHub Pages IP（`185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`）
- SSL/TLS 加密：Full（strict）
- GitHub Pages 仓库设置中 Custom domain 设为 `haibarai.dpdns.org`，Enforce HTTPS 开启

### Waline 服务端部署（Vercel + MongoDB Atlas）

- **平台**: Vercel（Hobby 免费版），项目名 `waline-comment`
- **数据库**: MongoDB Atlas（M0 Sandbox 免费版），数据库名 `waline`
- **服务端地址**: `https://waline-comment-smoky.vercel.app`
- **管理后台**: `https://waline-comment-smoky.vercel.app/ui/`
- **环境变量**:

  | 变量 | 值 |
  |------|-----|
  | `MONGO_DB` | `waline` |
  | `MONGO_USER` | `chenhui2422xu_db_user` |
  | `MONGO_PASSWORD` | （MongoDB Atlas 用户密码） |
  | `MONGO_HOST` | `cluster0.ruazaa0.mongodb.net` |
  | `MONGO_OPT_SSL` | `true` |
  | `SECURE_DOMAINS` | `localhost:4322, localhost, garden-jade-eight.vercel.app, xuchenhui.cc, eosphor.dpdns.org, xuchenhui.dpdns.org, haibarai.dpdns.org` |

  **注意**: Waline 不支持 Vercel KV / Upstash Redis，必须使用 MongoDB 或 LeanCloud。

### Waline 管理后台

- **地址**: `https://waline-comment-smoky.vercel.app/ui/`
- **首次使用**: 注册账号 → 第一个注册的用户自动成为管理员
- **管理功能**:
  - 查看/删除评论
  - 设置精选评论
  - 评论统计概览
  - 敏感词管理
  - 站点配置（登录方式等）
- **转发到技术博客**: 技术博客 `xuchenhui.cc` 使用同一套 Waline 服务端，只需在前端配置相同的 `serverURL` 即可

---

## 开发

### 常用命令

```bash
# 启动开发服务器（日常博客，默认 localhost:4322）
cd playground && pnpm dev

# 构建博客（输出到 playground/dist/）
pnpm run playground:build

# 预览构建结果
cd playground && pnpm preview

# monorepo 根命令
pnpm run playground:dev    # 同上 dev
pnpm run package:check     # 检查主题包
pnpm run format            # Prettier 格式化
```

### 自定义组件注册流程

1. 在 `playground/src/components/` 下创建 `.astro` 组件
2. 在 `playground/charm.theme.ts` 的 `overrides.custom` 中注册
3. 可选插槽位置：
   - `CustomScriptComponent` — `<head>` 末尾
   - `CustomPostHeaderBottom` — 文章标题下方
   - `CustomPostFooterBottom` — 文章底部（License 之后）

注：如果组件含 `<script>` 且有外部依赖（如 Waline），使用 `<script is:inline>` + CDN 动态导入，避免 Astro 打包问题。
