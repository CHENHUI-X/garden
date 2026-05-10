# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

日常博客（IUHNEHC），基于 Astro Charm 主题。Monorepo 结构，`playground/` 是博客站点，`package/` 是主题源码。

## Commands

```bash
# 启动开发服务器（日常博客）
cd playground && pnpm dev

# 构建博客
pnpm run playground:build

# 构建输出在 playground/dist/

# 预览构建结果
cd playground && pnpm preview
```

## Key Architecture

- **`playground/charm.theme.ts`** — 主题配置中心：站点信息、侧边栏、自定义组件注册
- **`playground/src/content/specials/`** — 侧边栏页面（about, murmur, friends），每个 .md 文件自动生成侧边栏入口
- **`playground/src/content/posts/`** — 博客文章目录
- **`playground/src/components/CustomScriptComponent.astro`** — 全局 CSS + 背景图 + About 统计，注入在 `<head>` 末尾
- **`playground/public/scripts/anime-bg.js`** — 二次元背景图切换脚本（静态文件，30s 切换）
- **`playground/src/components/WalineComment.astro`** — 文章底部评论组件（CDN 加载 Waline）
- **`playground/.env`** — `PUBLIC_WALINE_SERVER_URL` 环境变量
- **`package/`** — Astro Charm 主题源码，一般不改

## Custom Components Registry

在 `charm.theme.ts` 的 `overrides.custom` 注册：
- `CustomScriptComponent` — `<head>` 末尾注入
- `CustomPostHeaderBottom` — 文章标题下方
- `CustomPostFooterBottom` — 文章底部（License 之后）

## Waline 评论系统

- 服务端：`https://waline-comment-smoky.vercel.app`（Vercel + MongoDB Atlas）
- 客户端：CDN 加载 `@waline/client@3`，不走 node_modules 打包（绕过 Astro 脚本限制）
- 博客文章：`CustomPostFooterBottom` 注入
- 碎碎念：每条说说的折叠评论用 `murmur.md` 内的 inline script 实现

## Background Image

- 夜轻 API 主用（横竖屏自适应），赫萝 API 备用
- 30s 切换，双 img 淡入淡出
- CSS 在 CustomScriptComponent.astro，JS 在 public/scripts/anime-bg.js
