// 二次元背景图自动切换脚本（带缓存）
// 夜轻 API 主用（302 直接重定向到图片，无 CORS），赫萝 API 备用
(function () {
  const CACHE_KEY = "anime-bg-cache";
  const CACHE_MAX = 10; // 最多缓存 10 张图片 URL
  const CACHE_EXPIRE = 60 * 60 * 1000; // 缓存过期时间 1 小时

  // 缓存管理
  const cache = {
    get: function () {
      try {
        const data = localStorage.getItem(CACHE_KEY);
        if (!data) return [];
        const parsed = JSON.parse(data);
        // 过滤过期的缓存
        const now = Date.now();
        return parsed.filter((item) => now - item.time < CACHE_EXPIRE);
      } catch (e) {
        return [];
      }
    },
    add: function (url) {
      if (!url) return;
      const items = cache.get();
      // 避免重复
      const exists = items.find((item) => item.url === url);
      if (exists) {
        exists.time = Date.now(); // 更新时间
      } else {
        items.push({ url: url, time: Date.now() });
      }
      // 保留最新的 N 张
      const trimmed = items.slice(-CACHE_MAX);
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    },
    random: function () {
      const items = cache.get();
      if (items.length === 0) return null;
      const randomItem = items[Math.floor(Math.random() * items.length)];
      return randomItem.url;
    },
  };

  const isPortrait = () => window.innerHeight > window.innerWidth;

  function ypppUrl() {
    return (
      (isPortrait() ? "https://api.yppp.net/pe.php" : "https://api.yppp.net/pc.php") +
      "?_t=" +
      Date.now()
    );
  }

  async function horoUrl() {
    const type = isPortrait() ? "mobile" : "pc";
    const res = await fetch(
      `https://api.horosama.com/random.php?type=${type}&format=json&_t=${Date.now()}`
    );
    const data = await res.json();
    return data.url;
  }

  const imgA = document.getElementById("anime-bg-a");
  const imgB = document.getElementById("anime-bg-b");
  if (!imgA || !imgB) return;

  let current = "a";

  function loadNext(imgEl, onReady) {
    let loaded = false;

    const onSuccess = (url) => {
      if (loaded) return;
      loaded = true;
      cache.add(url);
      onReady();
    };

    const onError = async () => {
      if (loaded) return;
      imgEl.onerror = null;
      try {
        // 先尝试从缓存加载
        const cachedUrl = cache.random();
        if (cachedUrl) {
          imgEl.onload = () => onSuccess(cachedUrl);
          imgEl.src = cachedUrl;
          return;
        }
        // 缓存也没有，用赫萝 API
        const url = await horoUrl();
        imgEl.onload = () => onSuccess(url);
        imgEl.src = url;
      } catch (e) {
        // 全部失败，静默
      }
    };

    imgEl.onerror = onError;
    imgEl.onload = () => onSuccess(imgEl.src);
    
    // 先检查缓存是否有可用图片
    const cachedUrl = cache.random();
    if (cachedUrl && Math.random() > 0.3) {
      // 70% 概率使用缓存图片（减少 API 调用）
      imgEl.onload = () => onSuccess(cachedUrl);
      imgEl.onerror = () => {
        // 缓存图片加载失败，从 API 获取
        imgEl.onerror = onError;
        imgEl.src = ypppUrl();
      };
      imgEl.src = cachedUrl;
    } else {
      // 直接从 API 获取新图片
      imgEl.src = ypppUrl();
    }
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

  // 30s 切换一次
  setInterval(next, 30000);

  // 屏幕旋转时切换
  window.addEventListener("orientationchange", () => setTimeout(next, 300));
})();
