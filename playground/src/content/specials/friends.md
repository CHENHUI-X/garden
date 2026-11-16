---
title: "朋友们"
icon:
  {
    default: "solar:users-group-rounded-broken",
    hover: "solar:users-group-rounded-outline",
    active: "solar:users-group-rounded-bold-duotone",
  }
published: 2026-05-10
index: 2
---

这里是我认识的、关注的、觉得有意思的人们。

<div class="friends-grid">

<a class="friend-card" href="https://xuchenhui.cc/" target="_blank" rel="noopener noreferrer">
  <img src="https://xuchenhui.cc/favicon.ico" alt="CHENHUI" onerror="this.onerror=null;this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=chenhui'" />
  <div class="friend-info">
    <span class="friend-name">CHENHUI · 技术博客</span>
    <span class="friend-desc">算法、工程、折腾记录</span>
  </div>
</a>

</div>

<div class="friends-apply">

想交换友链？发邮件给我：<a href="mailto:chenhui2422.xu@gmail.com">chenhui2422.xu@gmail.com</a>

</div>

<style>
.friends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.875rem;
  margin: 1.5rem 0;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.875rem 1.1rem;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  text-decoration: none;
  color: inherit;
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

html.charm.dark .friend-card {
  background: rgba(30, 32, 40, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.friend-card:hover {
  border-color: var(--charm-highlight-color);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(224, 100, 88, 0.15);
}

.friend-card img {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.friend-card:hover img {
  transform: rotate(8deg) scale(1.08);
}

.friend-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.friend-name {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-desc {
  font-size: 0.75rem;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friends-apply {
  margin-top: 2rem;
  font-size: 0.875rem;
  opacity: 0.6;
}
</style>
