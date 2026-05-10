// 二次元背景图自动切换脚本
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
    imgEl.onerror = async () => {
      imgEl.onerror = null;
      try {
        const url = await horoUrl();
        imgEl.onload = () => { onReady(); imgEl.onload = null; };
        imgEl.onerror = null;
        imgEl.src = url;
      } catch (_) {}
    };
    imgEl.onload = () => { onReady(); imgEl.onload = null; imgEl.onerror = null; };
    imgEl.src = ypppUrl();
  }

  // setInterval 只注册一次，避免 SPA 导航后重复叠加
  let initialized = false;

  function init() {
    // 动态创建容器，插入 body 最前面
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

    // 加载第一张图
    loadNext(imgA, () => imgA.classList.add("visible"));

    if (!initialized) {
      initialized = true;
      let current = "a";

      function next() {
        if (current === "a") {
          loadNext(imgB, () => { imgB.classList.add("visible"); imgA.classList.remove("visible"); current = "b"; });
        } else {
          loadNext(imgA, () => { imgA.classList.add("visible"); imgB.classList.remove("visible"); current = "a"; });
        }
      }

      setInterval(next, 30000);
      window.addEventListener("orientationchange", () => setTimeout(next, 300));
    }
  }

  // 首次加载 + Astro SPA 导航后都执行
  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("astro:page-load", init);
})();
