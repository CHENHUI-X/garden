/**
 * IUHNEHC Studio Homepage Main Orchestrator (Performance-tuned Single-rAF Build).
 * - Single unified requestAnimationFrame loop driving Canvas clothesline + dust + magnetic cursor.
 * - Pre-baked static 128x128 paper grain PNG tile (eliminates 60fps SVG feTurbulence + mix-blend-mode).
 * - Pure GPU-composited FLIP transform modal open/close (eliminates software clip-path repaints).
 * - Pointer target caching (avoids redundant closest() DOM walks on 120Hz+ pointermove).
 */
import { StudioSound } from "./studio-sound";
import { ClotheslineEngine } from "./clothesline-physics";
import { BookEngine } from "./book-engine";
import { VinylPlayerEngine } from "./vinyl-player";

/** Generate a tiny static noise PNG once so paper grain costs ~0ms/frame on GPU */
function installFastPaperGrain(): void {
  const el = document.querySelector<HTMLElement>(".paper-grain");
  if (!el) return;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = v > 128 ? 115 : 85;
    data[i + 1] = v > 128 ? 105 : 78;
    data[i + 2] = v > 128 ? 92 : 68;
    data[i + 3] = (Math.random() * 18) | 0;
  }
  ctx.putImageData(img, 0, 0);
  el.style.backgroundImage = `url(${c.toDataURL("image/png")})`;
}

function initStudio(): void {
  const stage = document.getElementById("clothesline-stage");
  const ropeCanvas = document.getElementById("rope-canvas") as HTMLCanvasElement | null;
  const bookModal = document.getElementById("modal-book");
  if (!stage || !ropeCanvas || !bookModal) return;

  installFastPaperGrain();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const sound = new StudioSound();

  // ==========================================================================
  // 1. Custom Magnetic Cursor (interpolated inside unified rAF loop!)
  // ==========================================================================
  const cursorEl = document.getElementById("studio-cursor");
  const cursorTop = cursorEl?.querySelector<HTMLElement>("[data-cursor-top]");
  const cursorSub = cursorEl?.querySelector<HTMLElement>("[data-cursor-sub]");

  let mx = window.innerWidth * 0.5;
  let my = window.innerHeight * 0.5;
  let cx = mx;
  let cy = my;
  let cursorVisible = false;
  let cursorActive = false;
  let cursorMode = "default";
  let lastPointerTarget: EventTarget | null = null;

  const setCursorState = (
    mode: "default" | "rope" | "open" | "book" | "btn",
    topText = "OPEN",
    subText = "展开"
  ) => {
    if (!cursorEl) return;
    if (mode !== cursorMode) {
      cursorEl.classList.remove("is-rope", "is-open", "is-book", "is-btn");
      if (mode !== "default") cursorEl.classList.add(`is-${mode}`);
      cursorMode = mode;
    }
    if (mode === "open" || mode === "book") {
      if (cursorTop && cursorTop.textContent !== topText) cursorTop.textContent = topText;
      if (cursorSub && cursorSub.textContent !== subText) cursorSub.textContent = subText;
    }
  };

  if (finePointer && !reducedMotion && cursorEl) {
    cursorActive = true;
    document.documentElement.classList.add("has-custom-cursor");
    cursorEl.classList.add("is-hidden");

    window.addEventListener(
      "pointermove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (!cursorVisible) {
          cx = mx;
          cy = my;
          cursorVisible = true;
          cursorEl.classList.remove("is-hidden");
        }
        wakeMainLoop();
        // Only walk DOM when target element actually changes!
        if (e.target !== lastPointerTarget) {
          lastPointerTarget = e.target;
          const target = e.target as HTMLElement | null;
          const overEditable = Boolean(target?.closest("input, textarea, [contenteditable='true']"));
          cursorEl.classList.toggle("is-hidden", overEditable);
          if (overEditable) return;
          if (
            target?.closest(
              "button, a, .toc-entry"
            ) &&
            !target.closest(".hanger")
          ) {
            setCursorState("btn");
          } else if (activeModal && !target?.closest(".hanger")) {
            setCursorState("default");
          }
        }
      },
      { passive: true }
    );

    document.addEventListener("pointerleave", () => {
      cursorVisible = false;
      cursorEl.classList.add("is-hidden");
    });
  }

  // ==========================================================================
  // 2. Engines: Book Reader + Verlet Canvas Clothesline
  // ==========================================================================
  const book = new BookEngine(bookModal, sound);
  const vinylModal = document.getElementById("modal-vinyl");
  const vinyl = vinylModal ? new VinylPlayerEngine(vinylModal, sound) : null;
  let activeModal: HTMLElement | null = null;
  let returnToModalKey: string | null = null;
  let lastTriggerEl: HTMLElement | null = null;
  let modalAnimating = false;

  const hintEl = document.getElementById("gesture-hint");

  const clothesline = new ClotheslineEngine(stage, ropeCanvas, sound, {
    onOpenArtifact: (action, sourceEl) => openModal(action, sourceEl),
    onCursorState: (mode, top, sub) => {
      if (!activeModal) setCursorState(mode, top, sub);
    },
    onFirstInteract: () => {
      hintEl?.classList.add("quiet");
    },
  });

  // ==========================================================================
  // 3. Demand-Driven Unified 60/120fps Loop (0% CPU/GPU when reading or hidden)
  // ==========================================================================
  let lastFrameTs = performance.now();
  let loopRafId = 0;

  function wakeMainLoop(): void {
    if (loopRafId || document.hidden) return;
    lastFrameTs = performance.now();
    loopRafId = requestAnimationFrame(mainLoop);
  }

  function mainLoop(now: number): void {
    loopRafId = 0;
    if (document.hidden) return;

    const dt = Math.min(0.032, (now - lastFrameTs) / 1000 || 0.016);
    lastFrameTs = now;

    // 1) Clothesline physics + dust + canvas (automatically pauses when modal open)
    if (!activeModal) {
      clothesline.tick(dt, now);
    }

    // 2) Magnetic cursor (only writes style when delta > 0.2px)
    let cursorMoving = false;
    if (cursorActive && cursorVisible && cursorEl) {
      const dx = mx - cx;
      const dy = my - cy;
      if (dx * dx + dy * dy > 0.04) {
        const factor = 1 - Math.exp(-18 * dt);
        cx += dx * factor;
        cy += dy * factor;
        cursorEl.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
        cursorMoving = true;
      }
    }

    // Keep looping while clothesline is active OR magnetic cursor is gliding; sleep at 0% idle otherwise!
    if (!activeModal || cursorMoving) {
      loopRafId = requestAnimationFrame(mainLoop);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (loopRafId) {
        cancelAnimationFrame(loopRafId);
        loopRafId = 0;
      }
    } else {
      wakeMainLoop();
    }
  });

  window.addEventListener("resize", () => wakeMainLoop(), { passive: true });

  wakeMainLoop();

  // ==========================================================================
  // 4. GPU-Composited FLIP Modal Open / Close (zero software clip-path jank!)
  // ==========================================================================
  const modalMap: Record<string, HTMLElement | null> = {
    about: document.getElementById("modal-about"),
    book: bookModal,
    murmur: document.getElementById("modal-murmur"),
    friends: document.getElementById("modal-friends"),
    search: document.getElementById("modal-search"),
    vinyl: vinylModal,
  };

  function runCountUp(container: HTMLElement): void {
    const nums = container.querySelectorAll<HTMLElement>("[data-count-target]");
    nums.forEach((el) => {
      const target = Number(el.dataset.countTarget || "0");
      if (reducedMotion || target <= 0) {
        el.textContent = target.toLocaleString();
        return;
      }
      const start = performance.now();
      const dur = 820;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function openModal(key: string, sourceEl?: HTMLElement | null, slug?: string): void {
    const modal = modalMap[key];
    if (!modal || modalAnimating) return;
    if (activeModal && activeModal !== modal) {
      // Remember if vinyl turntable was opened from inside the Book so closing returns to the Book!
      if (key === "vinyl" && activeModal === bookModal) {
        returnToModalKey = "book";
      } else {
        returnToModalKey = null;
      }
      activeModal.classList.remove("is-open");
      activeModal.setAttribute("aria-hidden", "true");
    } else if (key !== "vinyl") {
      returnToModalKey = null;
    }

    modalAnimating = true;
    activeModal = modal;
    lastTriggerEl = sourceEl || null;
    clothesline.setPaused(true);
    setCursorState("default");
    sound.sheetSlide(true);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    if (key === "book") {
      book.rebuild(false);
      if (slug) book.openChapterBySlug(slug);
    } else if (key === "about") {
      runCountUp(modal);
    } else if (key === "search") {
      const input = document.getElementById("studio-search-input") as HTMLInputElement | null;
      setTimeout(() => input?.focus(), 60);
    } else if (key === "vinyl") {
      vinyl?.ensureLoaded();
    }
    vinyl?.syncMiniDockVisibility();

    if (reducedMotion) {
      modalAnimating = false;
      return;
    }

    // Pure GPU transform FLIP from clicked artifact center -> full screen
    let fromTx = 0;
    let fromTy = 28;
    let fromScale = 0.94;
    if (sourceEl) {
      const r = sourceEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      fromTx = (r.left + r.width * 0.5 - vw * 0.5) * 0.42;
      fromTy = (r.top + r.height * 0.5 - vh * 0.5) * 0.42;
      fromScale = Math.max(0.28, Math.min(0.62, r.width / vw));
    }

    const anim = modal.animate(
      [
        {
          opacity: 0,
          transform: `translate3d(${fromTx.toFixed(1)}px, ${fromTy.toFixed(1)}px, 0) scale(${fromScale.toFixed(3)})`,
        },
        {
          opacity: 1,
          transform: "translate3d(0, 0, 0) scale(1)",
        },
      ],
      {
        duration: 460,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both",
      }
    );

    anim.onfinish = () => {
      anim.cancel();
      modalAnimating = false;
      if (key === "book") {
        book.rebuild(true);
        if (slug) book.openChapterBySlug(slug);
      }
    };
  }

  function closeActiveModal(): void {
    if (!activeModal || modalAnimating) return;
    const modal = activeModal;
    modalAnimating = true;
    sound.sheetSlide(false);

    const finish = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      activeModal = null;
      modalAnimating = false;

      if (modal === vinylModal && returnToModalKey === "book") {
        returnToModalKey = null;
        bookModal.classList.add("is-open");
        bookModal.setAttribute("aria-hidden", "false");
        activeModal = bookModal;
        vinyl?.syncMiniDockVisibility();
        return;
      }

      clothesline.setPaused(false);
      clothesline.sendBreezeWave(0.5);
      wakeMainLoop();
      vinyl?.syncMiniDockVisibility();
      if (window.location.search) {
        try {
          window.history.replaceState(null, "", "/");
        } catch {
          // ignore
        }
      }
    };

    if (reducedMotion) {
      finish();
      return;
    }

    let toTx = 0;
    let toTy = 24;
    let toScale = 0.94;
    if (lastTriggerEl) {
      const r = lastTriggerEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      toTx = (r.left + r.width * 0.5 - vw * 0.5) * 0.42;
      toTy = (r.top + r.height * 0.5 - vh * 0.5) * 0.42;
      toScale = Math.max(0.28, Math.min(0.62, r.width / vw));
    }

    const anim = modal.animate(
      [
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        {
          opacity: 0,
          transform: `translate3d(${toTx.toFixed(1)}px, ${toTy.toFixed(1)}px, 0) scale(${toScale.toFixed(3)})`,
        },
      ],
      {
        duration: 340,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "both",
      }
    );

    anim.onfinish = () => {
      anim.cancel();
      finish();
    };
  }

  document.querySelectorAll<HTMLElement>("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeActiveModal());
  });

  document.querySelectorAll<HTMLElement>("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.openModal;
      if (!target) return;
      sound.clipClick();
      const hanger = stage.querySelector<HTMLElement>(`.hanger[data-action="${target}"]`);
      openModal(target, hanger || btn);
    });
  });

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (activeModal === modalMap.search) closeActiveModal();
      else openModal("search", null);
      return;
    }
    if (e.key === "Escape" && activeModal) {
      e.preventDefault();
      closeActiveModal();
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (activeModal === bookModal) {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        book.step(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        book.step(-1);
      }
      return;
    }
    if (!activeModal) {
      if (e.key === "/") {
        e.preventDefault();
        openModal("search", null);
      } else if (e.key.toLowerCase() === "m" || e.key === "5") {
        e.preventDefault();
        openModal("vinyl", stage.querySelector('.hanger[data-action="vinyl"]'));
      } else if (e.key === "1") openModal("about", stage.querySelector('.hanger[data-action="about"]'));
      else if (e.key === "2" || e.key.toLowerCase() === "b") openModal("book", stage.querySelector('.hanger[data-action="book"]'));
      else if (e.key === "3") openModal("murmur", stage.querySelector('.hanger[data-action="murmur"]'));
      else if (e.key === "4") openModal("friends", stage.querySelector('.hanger[data-action="friends"]'));
    }
  });

  // ==========================================================================
  // 5. Top Bar Controls: Theme, Sound, Optional Anime BG, Live Clock
  // ==========================================================================
  const themeBtn = document.getElementById("btn-theme");
  const syncThemeBtn = () => {
    const isDark = document.documentElement.classList.contains("dark");
    themeBtn?.setAttribute("aria-pressed", String(isDark));
    const lbl = themeBtn?.querySelector<HTMLElement>(".ctrl-label");
    if (lbl) lbl.textContent = isDark ? "台灯" : "晴日";
    clothesline.syncTheme();
  };
  syncThemeBtn();

  themeBtn?.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      // ignore
    }
    syncThemeBtn();
    sound.clipClick();
    clothesline.sendBreezeWave(0.45);
  });

  const soundBtn = document.getElementById("btn-sound");
  const syncSoundBtn = () => {
    soundBtn?.setAttribute("aria-pressed", String(sound.enabled));
    const lbl = soundBtn?.querySelector<HTMLElement>(".ctrl-label");
    if (lbl) lbl.textContent = sound.enabled ? "声效开" : "静音";
  };
  syncSoundBtn();

  soundBtn?.addEventListener("click", () => {
    sound.toggle();
    syncSoundBtn();
  });

  const bgBtn = document.getElementById("btn-anime-bg");
  let animeBooted = false;
  const enableAnimeLayer = () => {
    if (animeBooted) return;
    animeBooted = true;
    const imgA = document.getElementById("studio-bg-a") as HTMLImageElement | null;
    const imgB = document.getElementById("studio-bg-b") as HTMLImageElement | null;
    if (!imgA || !imgB) return;
    const pickUrl = () => {
      const portrait = window.innerHeight > window.innerWidth;
      return (portrait ? "https://api.yppp.net/pe.php" : "https://api.yppp.net/pc.php") + "?_t=" + Date.now();
    };
    const load = (el: HTMLImageElement, cb?: () => void) => {
      el.onload = () => {
        cb?.();
        el.onload = null;
      };
      el.src = pickUrl();
    };
    load(imgA, () => {
      imgA.classList.add("visible");
      load(imgB);
    });
    let cur = "a";
    window.setInterval(() => {
      if (!document.documentElement.classList.contains("anime-on")) return;
      if (cur === "a") {
        imgB.classList.add("visible");
        imgA.classList.remove("visible");
        cur = "b";
        setTimeout(() => load(imgA), 1600);
      } else {
        imgA.classList.add("visible");
        imgB.classList.remove("visible");
        cur = "a";
        setTimeout(() => load(imgB), 1600);
      }
    }, 30000);
  };

  bgBtn?.addEventListener("click", () => {
    const on = document.documentElement.classList.toggle("anime-on");
    bgBtn.setAttribute("aria-pressed", String(on));
    sound.clipClick();
    if (on) enableAnimeLayer();
  });

  const clockEl = document.getElementById("live-clock");
  const daysEl = document.getElementById("live-days");
  const updateTime = () => {
    if (clockEl) {
      try {
        const fmt = new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        clockEl.textContent = fmt.format(new Date());
      } catch {
        const d = new Date();
        clockEl.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    }
    if (daysEl) {
      const founded = new Date("2026-05-01T00:00:00+08:00").getTime();
      const diff = Math.max(1, Math.floor((Date.now() - founded) / 86400000) + 1);
      daysEl.textContent = String(diff);
      const statDays = document.getElementById("stat-days-num");
      if (statDays) statDays.dataset.countTarget = String(diff);
    }
  };
  updateTime();
  window.setInterval(updateTime, 15000);

  // ==========================================================================
  // 6. Murmur Inline Waline Comments & Friends Email Copy
  // ==========================================================================
  const murmurModal = document.getElementById("modal-murmur");
  const walineUrl = bookModal.dataset.walineServer || "";
  let walineModPromise: Promise<{ init: (opts: Record<string, unknown>) => void }> | null = null;

  murmurModal?.querySelectorAll<HTMLButtonElement>("[data-murmur-cmt]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const date = btn.dataset.murmurCmt || "";
      const slot = document.getElementById(`murmur-wl-${date}`);
      if (!slot) return;
      const opening = !slot.classList.contains("open");
      slot.classList.toggle("open", opening);
      btn.setAttribute("aria-expanded", String(opening));
      sound.clipClick();

      if (opening && !slot.dataset.loaded && walineUrl) {
        slot.innerHTML = `<p style="font-size:12px;color:var(--muted)">评论加载中...</p>`;
        try {
          if (!walineModPromise) {
            walineModPromise = import(/* @vite-ignore */ "https://unpkg.com/@waline/client@3/dist/waline.js");
          }
          const mod = await walineModPromise;
          slot.innerHTML = "";
          mod.init({
            el: `#murmur-wl-${date}`,
            serverURL: walineUrl,
            path: `/murmur/${date}`,
            lang: "zh-CN",
            dark: "html.dark",
            requiredMeta: ["nick", "mail"],
            locale: {
              placeholder: "留一句回声给这条碎碎念…",
              nick: "称呼",
              mail: "邮箱",
              link: "站点",
              submit: "落笔留言",
              sofa: "还没有回声，来写第一句吧。",
            },
          });
          slot.dataset.loaded = "true";
        } catch {
          slot.innerHTML = `<p style="font-size:12px;color:var(--accent)">评论服务连接超时，请稍后再试。</p>`;
        }
      }
    });
  });

  // ==========================================================================
  // 6b. Built-in Paper Archive Search (Posts + Murmurs)
  // ==========================================================================
  const searchInput = document.getElementById("studio-search-input") as HTMLInputElement | null;
  const searchResults = document.getElementById("studio-search-results");
  const searchMeta = document.getElementById("studio-search-meta");
  const searchDataEl = document.getElementById("studio-search-data");

  interface SearchPost {
    slug: string;
    title: string;
    description: string;
    published: string;
    category: string;
    tags: string[];
    text: string;
  }
  interface SearchMurmur {
    date: string;
    text: string;
  }

  let searchData: { posts: SearchPost[]; murmurs: SearchMurmur[] } = { posts: [], murmurs: [] };
  if (searchDataEl?.textContent) {
    try {
      searchData = JSON.parse(searchDataEl.textContent);
    } catch {
      // ignore
    }
  }

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const renderSearch = (rawQuery: string) => {
    if (!searchResults || !searchMeta) return;
    const q = rawQuery.trim().toLowerCase();

    const matchedPosts = searchData.posts.filter((p) => {
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.text.toLowerCase().includes(q)
      );
    });

    const matchedMurmurs = searchData.murmurs.filter((m) => {
      if (!q) return true;
      return m.date.includes(q) || m.text.toLowerCase().includes(q);
    });

    const total = matchedPosts.length + matchedMurmurs.length;
    searchMeta.textContent = q
      ? `找到 ${total} 条结果 · 随笔 ${matchedPosts.length} 篇 / 碎碎念 ${matchedMurmurs.length} 条`
      : `全站档案索引 · 随笔 ${searchData.posts.length} 篇 / 碎碎念 ${searchData.murmurs.length} 条`;

    if (total === 0) {
      searchResults.innerHTML = `<div class="search-empty">没有找到与「${esc(rawQuery.trim())}」相关的内容。</div>`;
      return;
    }

    const postCards = matchedPosts
      .map((p) => {
        let excerpt = p.description || p.text.slice(0, 86);
        if (q) {
          const idx = p.text.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 24);
            excerpt = (start > 0 ? "…" : "") + p.text.slice(start, start + 96) + "…";
          }
        }
        return `
          <button type="button" class="search-card" data-search-post="${esc(p.slug)}">
            <div class="search-card-top">
              <span class="search-badge">随笔 · 书册</span>
              <span class="lbl" style="color:var(--muted)">${esc(p.published)}</span>
            </div>
            <h3 class="search-card-title">${esc(p.title)}</h3>
            <p class="search-card-excerpt">${esc(excerpt)}</p>
          </button>
        `;
      })
      .join("");

    const murmurCards = matchedMurmurs
      .map(
        (m) => `
        <button type="button" class="search-card" data-search-murmur="1">
          <div class="search-card-top">
            <span class="search-badge cobalt">碎碎念</span>
            <span class="lbl" style="color:var(--muted)">${esc(m.date)}</span>
          </div>
          <p class="search-card-excerpt">${esc(m.text)}</p>
        </button>
      `
      )
      .join("");

    searchResults.innerHTML = postCards + murmurCards;

    searchResults.querySelectorAll<HTMLButtonElement>("[data-search-post]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.searchPost || "";
        modalAnimating = false;
        openModal("book", null, slug);
      });
    });

    searchResults.querySelectorAll<HTMLButtonElement>("[data-search-murmur]").forEach((btn) => {
      btn.addEventListener("click", () => {
        modalAnimating = false;
        openModal("murmur", null);
      });
    });
  };

  renderSearch("");
  searchInput?.addEventListener("input", () => renderSearch(searchInput.value));

  // Auto-open modal when arriving via deep link (/?open=murmur, /posts/..., /about, etc.)
  const params = new URLSearchParams(window.location.search);
  const openParam = params.get("open");
  const slugParam = params.get("slug") || undefined;
  if (openParam && modalMap[openParam]) {
    requestAnimationFrame(() => openModal(openParam, null, slugParam));
  }

  const copyBtn = document.getElementById("btn-copy-email");
  const copyToast = document.getElementById("copy-email-toast");
  copyBtn?.addEventListener("click", async () => {
    sound.clipClick();
    try {
      await navigator.clipboard.writeText("chenhui2422.xu@gmail.com");
      copyToast?.classList.add("show");
      setTimeout(() => copyToast?.classList.remove("show"), 2000);
    } catch {
      window.location.href = "mailto:chenhui2422.xu@gmail.com";
    }
  });

  // ==========================================================================
  // 7. Fail-Safe Entrance Choreography
  // ==========================================================================
  if (!reducedMotion) {
    const ghostWord = document.querySelector<HTMLElement>(".ghost-word");
    ghostWord?.animate(
      [
        { opacity: 0, transform: "translate3d(0, 22px, 0) scale(0.98)" },
        { opacity: document.documentElement.classList.contains("dark") ? 0.065 : 0.055, transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      { duration: 950, delay: 60, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" }
    );

    const topBar = document.querySelector<HTMLElement>(".top-bar");
    topBar?.animate(
      [
        { opacity: 0, transform: "translate3d(0, -12px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration: 680, delay: 110, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" }
    );

    const bottomStrip = document.querySelector<HTMLElement>(".bottom-strip");
    bottomStrip?.animate(
      [
        { opacity: 0, transform: "translate3d(0, 14px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { duration: 740, delay: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" }
    );

    setTimeout(() => clothesline.sendBreezeWave(0.7), 280);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStudio);
} else {
  initStudio();
}
