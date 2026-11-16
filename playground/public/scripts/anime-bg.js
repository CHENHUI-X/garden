// 二次元背景图自动切换脚本 (带后台隐式预加载机制，无缝淡入淡出防白屏)
// 夜轻 API 主用（302 直接重定向到图片，无 CORS），赫萝 API 备用
(function () {
  const isPortrait = () => window.innerHeight > window.innerWidth;

  function ypppUrl() {
    return (isPortrait() ? "https://api.yppp.net/pe.php" : "https://api.yppp.net/pc.php")
      + "?_t=" + Date.now();
  }

  async function horoUrl() {
    const type = isPortrait() ? "mobile" : "pc";
    const res = await fetch(`https://api.horosama.com/random.php?type=${type}&format=json&_t=${Date.now()}`);
    const data = await res.json();
    return data.url;
  }

  function loadNext(imgEl, onReady) {
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      if (onReady) onReady();
    };

    imgEl.onerror = async () => {
      imgEl.onerror = null;
      try {
        const url = await horoUrl();
        imgEl.onload = () => { done(); imgEl.onload = null; };
        imgEl.onerror = null;
        imgEl.src = url;
      } catch (_) {
        done();
      }
    };
    imgEl.onload = () => { done(); imgEl.onload = null; imgEl.onerror = null; };
    imgEl.src = ypppUrl();
  }

  // 全局只初始化一次定时器
  let initialized = false;

  function init() {
    let container = document.getElementById("anime-bg");
    if (!container) {
      container = document.createElement("div");
      container.id = "anime-bg";
      container.setAttribute("aria-hidden", "true");
      container.innerHTML = '<img id="anime-bg-a" alt=""><img id="anime-bg-b" alt="">';
      document.body.insertBefore(container, document.body.firstChild);
    }

    const imgA = document.getElementById("anime-bg-a");
    const imgB = document.getElementById("anime-bg-b");
    if (!imgA || !imgB) return;

    // 首次进入：加载第一张图
    if (!imgA.classList.contains("visible") && !imgB.classList.contains("visible")) {
      loadNext(imgA, () => {
        imgA.classList.add("visible");
        // 当前展示 A，后台立即预先拉取 B
        loadNext(imgB, null);
      });
    }

    if (!initialized) {
      initialized = true;
      let current = "a";

      function next() {
        if (current === "a") {
          // B 已在后台预加载完毕，瞬间切换
          imgB.classList.add("visible");
          imgA.classList.remove("visible");
          current = "b";
          // 切换后立即预加载下一张到 A
          setTimeout(() => loadNext(imgA, null), 1500);
        } else {
          // A 已在后台预加载完毕，瞬间切换
          imgA.classList.add("visible");
          imgB.classList.remove("visible");
          current = "a";
          // 切换后立即预加载下一张到 B
          setTimeout(() => loadNext(imgB, null), 1500);
        }
      }

      setInterval(next, 30000);
      window.addEventListener("orientationchange", () => setTimeout(next, 300));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();
