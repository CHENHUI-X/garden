# 博客问题扫描与修复计划

**扫描时间**: 2026-05-13
**扫描范围**: 全站实现（组件、样式、脚本、响应式）
**重点关注**: 移动端显示异常

---

## 问题清单（按优先级排序）

### P0 - 严重问题（影响功能/用户体验）

#### 1. 移动端侧边栏完全消失
- **文件**: `RightHomeSidebar.astro`, `RightMurmurSidebar.astro`, `RightFriendsSidebar.astro`
- **问题**: 在 `@media (width <= 64rem)` 时，所有侧边栏设置 `display: none`
- **影响**: 移动端用户看不到博客统计、标签云、分类、一言等核心功能
- **修复方案**: 
  - 移动端改为底部折叠面板或抽屉式侧边栏
  - 或在页面底部添加简化版 widget 区域

#### 2. 响应式断点混乱
- **文件**: 多个 CSS 文件
- **问题**: 断点写法不一致，值不统一
  - `@media (width <= 64rem)` - Astro 新语法
  - `@media (max-width: 64rem)` - 标准 CSS
  - `@media (max-width: 768px)` - 固定像素值
  - 混用 `64rem`、`52rem`、`42rem`、`80rem`、`768px`
- **影响**: 不同屏幕宽度下布局跳跃，某些断点间存在渲染空白
- **修复方案**: 
  - 统一使用 `max-width` 语法（兼容性更好）
  - 定义标准断点变量：`mobile: 42rem`, `tablet: 64rem`, `desktop: 90rem`

#### 3. QuoteCard 事件绑定不稳定
- **文件**: `widgets/QuoteCard.astro` 第 42-44 行
- **问题**: 使用 `setTimeout(..., 100)` 延迟绑定 click 事件
- **影响**: View Transitions 导航后按钮可能无法点击
- **修复方案**: 使用事件委托或 `astro:page-load` 时重新绑定

---

### P1 - 中等问题（影响体验）

#### 4. 移动端返回顶部按钮位置不当
- **文件**: `CustomScriptComponent.astro` 第 135-143 行
- **问题**: 移动端 `bottom: 1rem; right: 1rem` 可能在某些布局中被遮挡
- **影响**: 按钮可能不可见或难以点击
- **修复方案**: 
  - 增大触控区域（至少 44x44px）
  - 考虑 `safe-area-inset-bottom` 适配刘海屏

#### 5. Waline CSS 重复加载
- **文件**: `CustomScriptComponent.astro` 第 280-282 行, `murmur.md` 第 51-54 行
- **问题**: 两处都加载了 `@waline/client@3/dist/waline.css`
- **影响**: 重复请求，浪费带宽
- **修复方案**: 只在 `CustomScriptComponent.astro` 中全局加载一次

#### 6. TagCloud 词云 CDN 动态加载
- **文件**: `widgets/TagCloud.astro` 第 61-68 行
- **问题**: 每次页面加载都动态创建 `<script>` 加载 wordcloud2.js
- **影响**: 首屏渲染延迟，用户看到 fallback 闪烁
- **修复方案**: 
  - 将 wordcloud2.js 添加到 `modulepreload`
  - 或改用纯 CSS 标签云（无外部依赖）

#### 7. 背景图无缓存机制
- **文件**: `anime-bg.js`
- **问题**: 每 30s 发起新请求，URL 带 `_t=Date.now()` 强制刷新
- **影响**: 持续消耗流量，弱网环境切换卡顿
- **修复方案**: 
  - 使用 `localStorage` 缓存最近 N 张图片 URL
  - 或预加载下一张图片

---

### P2 - 轻微问题（代码质量/维护性）

#### 8. CSS 布局宽度重复定义
- **文件**: `CustomScriptComponent.astro` 和 `custom-charm.css`
- **问题**: 两处都定义了 `.content-wrapper` 宽度，存在覆盖关系
- **影响**: 维护困难，修改时容易遗漏
- **修复方案**: 统一到 `custom-charm.css`

#### 9. murmur.md 硬编码服务器地址
- **文件**: `murmur.md` 第 45 行
- **问题**: 直接写了 `https://waline-comment-smoky.vercel.app`
- **影响**: 环境变量 `PUBLIC_WALINE_SERVER_URL` 不生效
- **修复方案**: 使用 `import.meta.env.PUBLIC_WALINE_SERVER_URL`

#### 10. 颜色值格式不一致
- **文件**: 多个组件
- **问题**: 混用 CSS 变量和 `rgba()` 硬编码
- **影响**: 主题切换时部分颜色不变
- **修复方案**: 统一使用 CSS 变量

#### 11. 友链图片 onerror 无限循环风险
- **文件**: `friends.md` 第 18 行
- **问题**: `onerror` 设置 DiceBear 头像，但 DiceBear 也可能失败
- **影响**: 理论上可能触发无限重载
- **修复方案**: 添加 `onerror="this.onerror=null;this.src=..."`

---

### P3 - 移动端专项问题

#### 12. 玻璃态效果性能损耗
- **文件**: 侧边栏组件
- **问题**: `backdrop-filter: blur(16px)` 在低端设备上耗性能
- **影响**: 滚动卡顿
- **修复方案**: 添加 `@media (prefers-reduced-motion: reduce)` 降级

#### 13. 移动端内容区 max-width 未适配
- **文件**: `index.astro`, `[...special].astro`
- **问题**: `.main-content { max-width: 56rem }` 在移动端未重置
- **影响**: 内容区过窄，两侧留白过大
- **修复方案**: 移动端设置 `max-width: 100%` 或 `max-width: calc(100vw - 2rem)`

#### 14. 移动端目录完全隐藏
- **文件**: `RightToc.astro` 第 116-120 行
- **问题**: `@media (width <= 64rem) { display: none }`
- **影响**: 移动端无法查看文章目录
- **修复方案**: 
  - 添加浮动目录按钮
  - 或在文章顶部显示简化目录

#### 15. 触控目标尺寸不足
- **文件**: 多个组件的按钮/链接
- **问题**: 部分按钮尺寸小于 44x44px 推荐值
- **影响**: 移动端难以准确点击
- **修复方案**: 增大触控区域或添加 `padding`

---

## 修复计划

### Phase 1: 移动端核心问题修复（建议优先）

**目标**: 确保移动端基本功能可用

**任务**:
1. 统一响应式断点
   - 定义断点变量
   - 批量替换所有 `@media` 断点
   - 验证各断点下的布局

2. 移动端侧边栏改造
   - 选择方案：底部折叠面板 / 抽屉式 / 底部 widget 区
   - 实现移动端专属组件
   - 添加展开/收起动画

3. 移动端目录功能
   - 添加浮动目录按钮
   - 实现弹出式目录面板

**预计文件修改**:
- `custom-charm.css` - 断点统一
- `RightHomeSidebar.astro` - 移动端适配
- `RightMurmurSidebar.astro` - 移动端适配
- `RightFriendsSidebar.astro` - 移动端适配
- `RightToc.astro` - 移动端目录
- 新增 `MobileWidgets.astro` - 移动端底部组件

---

### Phase 2: 性能优化

**目标**: 减少网络请求，提升加载速度

**任务**:
1. 移除 Waline CSS 重复加载
2. 优化 TagCloud 加载方式
3. 背景图缓存机制
4. QuoteCard 事件绑定修复

**预计文件修改**:
- `CustomScriptComponent.astro` - 移除重复 CSS
- `murmur.md` - 移除 CSS 加载
- `widgets/TagCloud.astro` - 预加载或 CSS 方案
- `anime-bg.js` - 添加缓存
- `widgets/QuoteCard.astro` - 事件绑定

---

### Phase 3: 代码质量提升

**目标**: 提高可维护性，减少潜在 bug

**任务**:
1. CSS 布局统一到 `custom-charm.css`
2. murmur.md 使用环境变量
3. 颜色值统一使用 CSS 变量
4. 友链图片 onerror 修复
5. 移动端性能降级

**预计文件修改**:
- `CustomScriptComponent.astro` - 移除布局 CSS
- `custom-charm.css` - 整合布局样式
- `murmur.md` - 环境变量
- `friends.md` - onerror 修复
- 所有侧边栏组件 - 性能降级

---

## 验证清单

修复完成后需验证：

- [ ] iPhone SE (375px) 布局正常
- [ ] iPhone 14 Pro Max (430px) 布局正常
- [ ] iPad Mini (768px) 布局正常
- [ ] iPad Pro (1024px) 布局正常
- [ ] 桌面端 1440px+ 布局正常
- [ ] 横屏模式正常
- [ ] 暗色模式切换正常
- [ ] View Transitions 导航后功能正常
- [ ] 弱网环境加载正常
- [ ] 触控目标尺寸足够

---

## 风险与权衡

1. **移动端侧边栏方案选择**
   - 折叠面板：简单，但占用底部空间
   - 抽屉式：体验好，但实现复杂
   - 底部 widget：折中方案

2. **词云方案选择**
   - 保留 Canvas 词云：视觉效果好，但有依赖
   - 改用 CSS 标签云：无依赖，但视觉效果差

3. **背景图缓存**
   - 需考虑缓存失效策略
   - API 返回相同图片时的处理

---

## 后续建议

1. 添加移动端真机测试流程
2. 使用 Chrome DevTools 模拟弱网测试
3. 考虑添加 PWA 支持（离线访问）
4. 使用 Lighthouse 定期检测性能
