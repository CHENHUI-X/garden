# 日常博客 · 特性与技术栈

## 项目概览

基于 Astro Charm 主题的日常博客，记录碎碎念、读书感悟和胡思乱想。

- **域名**: 待部署
- **开发**: `http://localhost:4322`
- **技术博客**: `https://xuchenhui.cc`（使用同一套 Waline 评论服务）

---

## 技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| Astro | 静态站点框架 | v5.18.1 |
| Astro Charm | 博客主题 | workspace（monorepo） |
| pnpm | 包管理器 | v11+ |
| TypeScript | 开发语言 | - |
| Waline | 评论系统 | 服务端 @waline/vercel + 客户端 @waline/client v3 |
| MongoDB Atlas | Waline 数据库 | M0 Sandbox 免费版 |
| Vercel | Waline 服务端托管 | Hobby 免费版 |

---

## 项目结构

```
Garden/
├── package/           # Astro Charm 主题源码（monorepo 子包）
├── playground/        # 博客站点（日常博客）
│   ├── src/
│   │   ├── components/
│   │   │   ├── CustomScriptComponent.astro   # 全局 CSS + 背景图 + About 统计
│   │   │   ├── CustomPostHeaderBottom.astro  # 文章头部提示（多语言版本）
│   │   │   └── WalineComment.astro           # 文章底部评论组件
│   │   ├── content/
│   │   │   ├── posts/                        # 博客文章目录
│   │   │   └── specials/                     # 侧边栏页面
│   │   │       ├── about.md                  # 关于页
│   │   │       ├── murmur.md                 # 碎碎念页
│   │   │       └── friends.md                # 友链页
│   │   └── content.config.ts                 # 内容集配置（继承主题）
│   ├── public/
│   │   └── scripts/
│   │       └── anime-bg.js                   # 二次元背景图切换脚本
│   ├── charm.theme.ts                        # 主题配置
│   ├── astro.config.ts                       # Astro 配置
│   └── .env                                  # Waline 服务端 URL
├── package.json       # monorepo 根配置
└── pnpm-workspace.yaml# monorepo 工作区配置
```

---

## 已实现特性

### 1. 动态二次元背景图
- **脚本**: `playground/public/scripts/anime-bg.js`（静态文件，实时生效）
- **注入**: 通过 `CustomScriptComponent.astro` 的 `<script is:inline src="/scripts/anime-bg.js">`
- **API**: 夜轻 API 主用（`api.yppp.net/pc.php` 横屏 / `pe.php` 竖屏），赫萝 API 备用（`api.horosama.com`）
- **切换**: 每 30 秒自动切换，两张 `<img>` 交替 CSS 淡入淡出
- **自适应**: 横屏图片靠右显示、竖屏居中覆盖
- **透明度**: 亮色模式 `0.18` / 暗色模式 `0.22`
- **要点**: 容器由 JS 动态创建并插入 `<body>`；`z-index: -1`；同时监听 `DOMContentLoaded` 和 `astro:page-load`

### 2. Waline 评论系统
- **服务端**: Vercel 托管（`https://waline-comment-smoky.vercel.app`）
- **数据库**: MongoDB Atlas（免费 M0 集群）
- **博客文章评论**: 通过 `CustomPostFooterBottom` 注册 WalineComment.astro
- **碎碎念每条独立评论**: 在 `murmur.md` 中为每条说说添加折叠评论按钮，点击加载 Waline
- **配置**: `playground/.env` 存 `PUBLIC_WALINE_SERVER_URL`
- **初始化**: 通过 CDN（`https://unpkg.com/@waline/client@3/`）加载 Waline JS + CSS
  - CDN 动态加载绕过 Astro 的脚本打包限制，避免 `define:vars` + `import` 的兼容问题
- **初始化参数**: `reaction: true`（表情反应）、`pageview: true`（阅读量）、`dark: "html.charm.dark"`

### 3. About 页面统计
- **实现**: 构建时在 `CustomScriptComponent.astro` 中通过 `getCollection` 统计
- **数据**: 文章数、标签数、全站字数、建站时间、运行天数
- **展示**: `about.md` 中的 `#site-stats-dynamic` 列表，由 JS 动态填充

### 4. 侧边栏导航
| 入口 | 文件 | URL | 说明 |
|------|------|-----|------|
| 首页 | - | `/` | 博客文章列表 |
| 碎碎念 | `specials/murmur.md` | `/murmur` | 短文流，时间戳 + 内容 |
| 朋友们 | `specials/friends.md` | `/friends` | 友链卡片 |
| 关于 | `specials/about.md` | `/about` | 个人介绍 + 统计 |
| 归档 | 主题内置 | `/archive` | 自动生成 |
| 搜索 | 主题内置 | `/search` | 自动生成 |

---

## 主题配置（charm.theme.ts）

```typescript
config: {
  lang: "zh-CN",
  title: "IUHNEHC",
  titleSuffix: " · 随想",
  description: "记录日常的碎碎念、读书感悟和胡思乱想",
  licenseId: "CC-BY-NC-SA-4.0",
  shootingStar: true,     // 流星效果
  font: "auto",
  side: {
    bio: "这里是一些日常的碎碎念和想法。",
    sub: "吾生也有涯，而知也无涯",
  },
  markdown: { headingAnchor: "#" },
}
overrides: {
  components: { ShootingStar: undefined },  // 禁用内置流星
  custom: {
    CustomScriptComponent: "./src/components/CustomScriptComponent.astro",
    CustomPostHeaderBottom: "./src/components/CustomPostHeaderBottom.astro",
    CustomPostFooterBottom: "./src/components/WalineComment.astro",
  },
}
```

---

## Waline 服务端（共用）

- 地址：`https://waline-comment-smoky.vercel.app`
- 已授权域名：`localhost:4322, localhost, garden-jade-eight.vercel.app, xuchenhui.cc, eosphor.dpdns.org, xuchenhui.dpdns.org, haibarai.dpdns.org`
- 技术博客复用指南见下方

---

## 部署

### 博客部署
- **平台**: 待定
- **构建命令**: `pnpm run playground:build`
- **输出目录**: `dist/`

### Waline 服务端（已部署）
- **平台**: Vercel
- **项目名**: `waline-comment`
- **数据**: MongoDB Atlas
  - `MONGO_DB=waline`, `MONGO_USER=chenhui2422xu_db_user`
  - `MONGO_PASSWORD=...`, `MONGO_HOST=cluster0.ruazaa0.mongodb.net`
  - `MONGO_OPT_SSL=true`
- **安全域名**: `SECURE_DOMAINS=localhost:4322,...`（见上）
