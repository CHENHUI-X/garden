# 生产环境报错修复计划

**报错时间**: 2026-05-13
**报错页面**: test-long-post

---

## 问题 1: 字体 CDN 连接失败

### 错误信息
```
GET https://static.zeoseven.com/zsft/2/main/result.css net::ERR_CONNECTION_CLOSED
```

### 原因分析
- `static.zeoseven.com` 是第三方字体 CDN，在国内可能被墙或不稳定
- 当前配置 `font: "auto"`，中文站点会使用 `full` 模式加载完整字体
- 该 CDN 无国内镜像

### 解决方案

**方案 A: 禁用自定义字体（推荐）**
- 修改 `charm.theme.ts` 中 `font: "disabled"`
- 使用系统默认字体，加载更快，无外部依赖

**方案 B: 使用国内字体 CDN**
- 在 `CustomScriptComponent.astro` 中手动引入更稳定的字体源
- 如：Google Fonts（需代理）、字节跳动 CDN 等

### 修复步骤（方案 A）
1. 编辑 `playground/charm.theme.ts`
2. 将 `font: "auto"` 改为 `font: "disabled"`
3. 重新构建部署

---

## 问题 2: 评论加载失败

### 错误信息
```
评论区显示: 评论加载失败，请刷新重试
```

### 原因分析
- Waline 服务端部署在 Vercel：`https://waline-comment-smoky.vercel.app`
- Vercel 在中国大陆访问不稳定，可能超时
- 可能原因：
  1. 网络问题（GFW 干扰）
  2. `SECURE_DOMAINS` 未配置博客域名
  3. Vercel 免费额度用尽

### 诊断步骤

1. **检查 Vercel 部署状态**
   - 登录 Vercel Dashboard 查看 Waline 项目状态
   - 检查是否有错误日志

2. **检查 SECURE_DOMAINS 环境变量**
   - 在 Vercel 项目设置中查看
   - 应包含：`haibarai.dpdns.org`, `xuchenhui.cc`

3. **测试 Waline API**
   - 直接访问：`https://waline-comment-smoky.vercel.app`
   - 应返回 JSON 响应

### 解决方案

**方案 A: 添加超时和重试机制**
- 修改 `WalineComment.astro`，增加网络超时处理
- 添加手动重载按钮

**方案 B: 迁移 Waline 到国内平台**
- 使用 Deta Cloud、Railway 或自有服务器
- 提高国内访问稳定性

**方案 C: 使用 Twikoo 替代**
- Twikoo 有更好的国内支持
- 可部署在 Vercel + MongoDB 或私有部署

### 修复步骤（方案 A - 快速修复）

1. 添加更详细的错误信息
2. 添加手动重载按钮
3. 增加网络超时时间

---

## 推荐执行顺序

### 立即修复（低风险）
1. ✅ 禁用字体加载（改一行配置）

### 需要诊断后修复
2. 检查 Vercel Waline 状态
3. 确认 `SECURE_DOMAINS` 配置
4. 根据诊断结果选择修复方案

---

## 预计文件修改

| 文件 | 修改内容 |
|------|----------|
| `charm.theme.ts` | `font: "disabled"` |
| `WalineComment.astro` | 添加重载按钮、超时处理 |

---

## 验证清单

- [ ] 字体 CDN 不再报错
- [ ] 评论区正常加载
- [ ] 手机端测试正常
- [ ] 暗色模式正常
