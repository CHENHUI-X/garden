# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

日常博客（IUHNEHC），基于 Astro Charm 主题。Monorepo 结构，`playground/` 是博客站点，`package/` 是主题源码（一般不改）。

- **域名**: `https://haibarai.dpdns.org`（GitHub Pages + Cloudflare）
- **技术博客**: `https://xuchenhui.cc`（共用 Waline 评论服务）
- **作者**: CHENHUI
- **建站时间**: 2026-04-01

## Commands

```bash
# 启动开发服务器（默认 localhost:4321）
cd playground && pnpm dev

# 构建博客（输出到 playground/dist/）
pnpm run playground:build

# 预览构建结果
cd playground && pnpm preview
```

## Key Architecture

- **`playground/charm.theme.ts`** — 主题配置中心：站点信息、侧边栏、自定义组件注册（`config`、`overrides.custom`）
- **`playground/astro.config.ts`** — Astro 配置（`site` URL、`output: static`、`integrations`）
- **`playground/src/content/posts/`** — 博客文章目录，.md 文件，YAML frontmatter 定义标题/日期/标签/分类
- **`playground/src/content/specials/`** — 侧边栏页面，每个 .md 自动生成侧边栏入口（about, murmur, friends）
- **`playground/src/components/CustomScriptComponent.astro`** — 全局 CSS（背景图样式、body 透明化）+ 二次元背景图注入（`anime-bg.js`）+ About 页面统计（构建时 `getCollection`）
- **`playground/src/components/WalineComment.astro`** — 文章底部评论组件（CDN 加载 Waline，`requiredMeta: ["nick","mail"]` 关闭匿名）
- **`playground/src/content/specials/murmur.md`** — 碎碎念页，含每条说说独立折叠评论区（inline script + `toggleComment` 全局函数）
- **`playground/src/content/specials/friends.md`** — 友链页，CSS Grid 卡片网格，DiceBear pixel-art 风格头像
- **`playground/src/content/specials/about.md`** — 关于页，含动态博客统计数据
- **`playground/public/scripts/anime-bg.js`** — 二次元背景图切换脚本（30s 切换，夜轻 API + 赫萝 API 备用）
- **`playground/src/styles/custom-charm.css`** — 自定义 CSS（目前为空，可添加自定义样式）
- **`playground/.env`** — `PUBLIC_WALINE_SERVER_URL` 环境变量（gitignored，需在 CI 中单独配置）
- **`.github/workflows/deploy.yml`** — GitHub Actions 部署：checkout → pnpm setup → Node 22 → install → build → peaceiris/gh-pages（`cname: haibarai.dpdns.org`）

## Custom Components Registry

在 `charm.theme.ts` 的 `overrides.custom` 注册，路径基于 `playground/`：

| 键名 | 用途 | 注入位置 |
|------|------|----------|
| `CustomScriptComponent` | 全局 CSS + 背景图 + 统计 | `<head>` 末尾 |
| `CustomPostHeaderBottom` | 多语言切换提示 | 文章标题下方 |
| `CustomPostFooterBottom` | 评论区（WalineComment.astro） | 文章底部 License 之后 |

## Waline 评论系统

- **服务端**: `https://waline-comment-smoky.vercel.app`（Vercel + MongoDB Atlas）
- **管理后台**: `https://waline-comment-smoky.vercel.app/ui/`
- **客户端**: CDN 加载 `@waline/client@3`（unpkg），不走 node_modules 打包（绕过 Astro `is:inline` 限制）
- **关键参数**: `reaction: true`、`pageview: true`、`dark: "html.charm.dark"`、`requiredMeta: ["nick", "mail"]`
- **博客文章**: `CustomPostFooterBottom` → `WalineComment.astro`（path: `/slug`）
- **碎碎念**: `murmur.md` inline script → `toggleComment(id)` → `mod.init()`（path: `/murmur/日期`）
- **环境变量**: `PUBLIC_WALINE_SERVER_URL`（在 `.env` 中，需在部署时可用）
- **SECURE_DOMAINS**: 所有使用该评论服务的前端域名列表（Vercel 环境变量）

## Background Image

- 夜轻 API 主用（`api.yppp.net/pc.php` 横屏 / `pe.php` 竖屏），赫萝 API 备用（`api.horosama.com`）
- 30s 切换，双 img 淡入淡出（CSS transition 1.2s）
- 透明度：亮色 `0.18` / 暗色 `0.22`
- CSS 在 `CustomScriptComponent.astro`，JS 在 `public/scripts/anime-bg.js`
- 兼容 Astro View Transitions：同时监听 `DOMContentLoaded` 和 `astro:page-load`

## Known Issues

- **空文章列表导致 ResponseSentError**: Astro dev server 在 posts 集合为空时会抛出 ResponseSentError。解决方案是确保 `playground/src/content/posts/zh-cn/` 目录下至少有一篇文章。

## Deployment

- **平台**: GitHub Pages（gh-pages 分支）+ Cloudflare DNS 代理（orange cloud）
- **构建命令**: `pnpm run playground:build` → 输出 `playground/dist/`
- **CI**: GitHub Actions（`.github/workflows/deploy.yml`），`peaceiris/actions-gh-pages@v4` 带 `cname` 参数
- **DNS**: Cloudflare proxied A 记录指向 GitHub Pages IP（185.199.108.153 等）
- **SSL**: Cloudflare Full（strict）+ GitHub Pages Enforce HTTPS
