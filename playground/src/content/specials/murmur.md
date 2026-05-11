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
<span class="murmur-date">2026-05-01</span>

今天是上班的第666天。

<button class="murmur-toggle" onclick="toggleComment('murmur-2026-05-01')">💬 评论</button>
<div id="murmur-2026-05-01" class="murmur-comment-box"></div>
</div>

</div>

<script is:inline>
(function () {
  var serverURL = "https://waline-comment-smoky.vercel.app";
  var cssLoaded = false;

  function loadCSS() {
    if (cssLoaded) return;
    cssLoaded = true;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/@waline/client@3/dist/waline.css";
    document.head.appendChild(link);
  }

  window.toggleComment = function (id) {
    var container = document.getElementById(id);
    if (!container) return;

    if (container.dataset.loaded) {
      container.style.display =
        container.style.display === "none" ? "block" : "none";
      return;
    }

    loadCSS();
    container.style.display = "block";
    container.dataset.loaded = "1";

    import("https://unpkg.com/@waline/client@3/dist/waline.js").then(
      function (mod) {
        mod.init({
          el: "#" + id,
          serverURL: serverURL,
          path: "/murmur/" + id.replace("murmur-", ""),
          lang: "zh-CN",
          reaction: true,
          dark: "html.charm.dark",
          requiredMeta: ["nick", "mail"], // 昵称和邮箱必填，关闭匿名
        });
      }
    );
  };
})();
</script>

<style>
.murmur-feed {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.murmur-item {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--charm-border, rgba(128,128,128,0.15));
  line-height: 1.75;
}

.murmur-item:last-child {
  border-bottom: none;
}

.murmur-date {
  display: block;
  font-size: 0.78rem;
  opacity: 0.45;
  margin-bottom: 0.4rem;
  font-variant-numeric: tabular-nums;
}

.murmur-toggle {
  display: inline-block;
  margin-top: 0.6rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.78rem;
  border: 1px solid var(--charm-border, rgba(128,128,128,0.25));
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.2s;
}

.murmur-toggle:hover {
  opacity: 1;
}

.murmur-comment-box {
  display: none;
  margin-top: 1rem;
}
</style>
