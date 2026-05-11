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
  <img src="https://xuchenhui.cc/favicon.ico" alt="CHENHUI" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=chenhui'" />
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
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--charm-border, rgba(128,128,128,0.15));
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, transform 0.2s;
}

.friend-card:hover {
  border-color: var(--charm-accent, rgba(128,128,128,0.4));
  transform: translateY(-2px);
}

.friend-card img {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
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
