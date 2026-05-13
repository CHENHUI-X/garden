---
title: "碎碎念"
icon:
  {
    default: "solar:chat-round-dots-broken",
    hover: "solar:chat-round-dots-outline",
    active: "solar:chat-round-dots-bold-duotone",
  }
published: 2026-05-10
index: 1
---

<div class="murmur-feed">

<div class="murmur-item">
<span class="murmur-date">2026-05-12</span>

TMD,用了AI之后干的活越来越多了! 不过指挥AI干活真爽,这就是当老板的感觉吗?

(对了,今天是上班的第678天😐)

<div class="murmur-reactions" data-path="/murmur/2026-05-12"></div>
</div>

<div class="murmur-item">
<span class="murmur-date">2026-05-01</span>

今天是上班的第666天。

<div class="murmur-reactions" data-path="/murmur/2026-05-01"></div>
</div>

</div>

<!-- 图片预览灯箱 -->
<div id="image-lightbox" class="lightbox" onclick="closeLightbox()">
  <img id="lightbox-img" src="" alt="">
  <span class="lightbox-close">×</span>
</div>

<script is:inline>
(function () {
  var serverURL = window.__walineServerURL || "https://waline-comment-smoky.vercel.app";

  // 初始化所有表情反应
  function initReactions() {
    document.querySelectorAll('.murmur-reactions').forEach(function(el) {
      if (el.dataset.initialized) return;
      el.dataset.initialized = "1";
      
      // 显示 loading
      el.innerHTML = '<span style="opacity:0.5;font-size:0.85rem">加载中...</span>';
      
      import("https://unpkg.com/@waline/client@3/dist/waline.js").then(function(mod) {
        el.innerHTML = "";
        mod.init({
          el: el,
          serverURL: serverURL,
          path: el.dataset.path,
          reaction: true,
          dark: "html.charm.dark",
        });
      }).catch(function() {
        el.innerHTML = '<span style="opacity:0.5;font-size:0.85rem">加载失败</span>';
      });
    });
  }

  // 页面加载时初始化
  initReactions();
  
  // View Transitions 支持
  document.addEventListener('astro:page-load', initReactions);

  // 图片预览灯箱
  window.previewImage = function(img) {
    var lightbox = document.getElementById('image-lightbox');
    var lightboxImg = document.getElementById('lightbox-img');
    lightboxImg.src = img.src;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeLightbox = function() {
    var lightbox = document.getElementById('image-lightbox');
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  };

  // ESC 关闭灯箱
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
  });
})();
</script>

<style>
/* 时间轴容器 */
.murmur-feed {
  position: relative;
  padding-left: 2rem;
}

/* 左侧垂直时间线 */
.murmur-feed::before {
  content: "";
  position: absolute;
  left: 0.5rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--charm-border, rgba(128,128,128,0.2));
}

.murmur-item {
  position: relative;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--charm-border, rgba(128,128,128,0.1));
  line-height: 1.75;
}

.murmur-item:last-child {
  border-bottom: none;
}

/* 每条说说的节点 */
.murmur-item::before {
  content: "";
  position: absolute;
  left: -1.5rem;
  top: 1.5rem;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--charm-highlight-color, #e06458);
  border: 2px solid var(--charm-background-color, #fcfaf2);
  box-shadow: 0 0 0 2px var(--charm-border, rgba(128,128,128,0.2));
}

/* 日期样式 */
.murmur-date {
  display: inline-block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--charm-highlight-color, #e06458);
  opacity: 1;
  margin-bottom: 0.5rem;
}

.murmur-reactions {
  margin-top: 0.75rem;
  min-height: 2rem;
}

/* 隐藏 Waline 评论输入区域，只保留 Reaction */
.murmur-reactions .wl-header,
.murmur-reactions .wl-editor,
.murmur-reactions .wl-preview,
.murmur-reactions .wl-comment-actions,
.murmur-reactions .wl-info,
.murmur-reactions .wl-quote,
.murmur-reactions .wl-cards,
.murmur-reactions .wl-recent {
  display: none !important;
}

/* Reaction 区域样式调整 */
.murmur-reactions .wl-reaction {
  margin: 0;
}

/* 图片布局 */
.murmur-images {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.murmur-images[data-count="1"] {
  grid-template-columns: 1fr;
  max-width: 300px;
}

.murmur-images[data-count="2"] {
  grid-template-columns: repeat(2, 1fr);
  max-width: 400px;
}

.murmur-images[data-count="3"] {
  grid-template-columns: repeat(3, 1fr);
  max-width: 450px;
}

.murmur-images[data-count="4"],
.murmur-images[data-count="5"],
.murmur-images[data-count="6"] {
  grid-template-columns: repeat(3, 1fr);
  max-width: 450px;
}

.murmur-images img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.murmur-images img:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* 图片预览灯箱 */
.lightbox {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  justify-content: center;
  align-items: center;
  cursor: zoom-out;
}

.lightbox.active {
  display: flex;
}

.lightbox img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  border-radius: 0.5rem;
}

.lightbox-close {
  position: absolute;
  top: 1rem;
  right: 1.5rem;
  font-size: 2rem;
  color: white;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.lightbox-close:hover {
  opacity: 1;
}
</style>
