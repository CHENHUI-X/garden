# 碎碎念表情反应功能计划

## Goal

将说说评论区替换为表情反应功能，用户可直接点击表情表达态度。

## Current Context

- 每个说说下方有"💬 评论"按钮，点击后加载 Waline 评论区
- 评论区功能完整但交互较重（需要点击展开、加载外部脚本）
- Waline 已支持 `reaction: true` 参数

## Proposed Approach

使用 Waline 的 Reaction 功能，但只显示表情反应部分，不显示评论输入框。

### 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| Waline Reaction | 已有服务端、数据持久化 | 需要自定义样式隐藏评论区 |
| 第三方服务 (reaction.dev) | 简单集成 | 依赖外部服务、可能不稳定 |
| 纯前端 localStorage | 无需后端 | 数据不共享、无意义 |

**推荐**：继续使用 Waline，但通过 CSS 隐藏评论输入区域，只保留 Reaction 表情区域。

## Step-by-Step Plan

### 1. 移除评论区按钮和相关代码

**文件**: `playground/src/content/specials/murmur.md`

- 删除每个说说的 `<button class="murmur-toggle">` 按钮
- 删除 `<div class="murmur-comment-box">` 容器
- 简化 `toggleComment` 脚本，改为直接初始化 Reaction

### 2. 添加表情反应组件

每个说说下方添加表情反应容器：

```html
<div class="murmur-reactions" data-path="/murmur/2026-05-12"></div>
```

### 3. 修改初始化脚本

页面加载时自动初始化所有 Reaction 区域，只显示表情部分：

```js
// 初始化所有 reaction
document.querySelectorAll('.murmur-reactions').forEach(el => {
  Waline.init({
    el: el,
    serverURL: serverURL,
    path: el.dataset.path,
    reaction: true,
    // 通过配置或 CSS 隐藏评论输入
  });
});
```

### 4. 添加 CSS 隐藏评论输入

```css
/* 隐藏 Waline 评论输入区域，只保留 Reaction */
.murmur-reactions .wl-header,
.murmur-reactions .wl-editor,
.murmur-reactions .wl-preview,
.murmur-reactions .wl-comment-actions,
.murmur-reactions .wl-info,
.murmur-reactions .wl-quote {
  display: none !important;
}
```

### 5. 自定义表情反应样式

为 Reaction 区域添加符合博客风格的样式。

## Files to Change

- `playground/src/content/specials/murmur.md` — 主要修改

## Verification

1. 访问碎碎念页面，确认每个说说下方显示表情反应
2. 点击表情，确认计数增加
3. 确认没有评论输入框显示
4. 暗色模式下样式正常

## Open Questions

1. **表情类型**：使用 Waline 默认表情（👍, 👎, 😄, 😮, 😢, 😡）还是自定义？
2. **显示数量**：显示几个表情选项？建议 4-6 个
3. **计数显示**：是否显示每个表情的具体数量？

## Risks

- Waline CSS 选择器可能更新，导致隐藏失效
- Reaction 功能依赖 Waline 服务端正常工作
