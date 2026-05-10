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

  const imgA = document.getElementById("anime-bg-a");
  const imgB = document.getElementById("anime-bg-b");
  if (!imgA || !imgB) return;

  let current = "a";

  function loadNext(imgEl, onReady) {
    imgEl.onerror = async () => {
      imgEl.onerror = null;
      try {
        const url = await horoUrl();
        imgEl.onload = () => { onReady(); imgEl.onload = null; };
        imgEl.onerror = null;
        imgEl.src = url;
      } catch (_) { /* 两个都失败，静默 */ }
    };
    imgEl.onload = () => { onReady(); imgEl.onload = null; imgEl.onerror = null; };
    imgEl.src = ypppUrl();
  }

  function next() {
    if (current === "a") {
      loadNext(imgB, () => {
        imgB.classList.add("visible");
        imgA.classList.remove("visible");
        current = "b";
      });
    } else {
      loadNext(imgA, () => {
        imgA.classList.add("visible");
        imgB.classList.remove("visible");
        current = "a";
      });
    }
  }

  // 初始加载第一张
  loadNext(imgA, () => imgA.classList.add("visible"));

  setInterval(next, 30000);

  window.addEventListener("orientationchange", () => setTimeout(next, 300));
})();
