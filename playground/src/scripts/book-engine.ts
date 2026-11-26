/**
 * Interactive 3D Hardcover Book & Auto-Pagination Engine for CHENHUI · 随想.
 * - Dynamically measures actual rendered book page box & splits arbitrarily long
 *   Astro Markdown posts into balanced print-style pages (zero inner scrollbars).
 * - Desktop: 2-page hardcover spread with centered closed-cover transition.
 * - Mobile (<= 767px): single-page paperback mode with touch swipe-to-turn.
 * - Real 3D rotateY turning leaf + dynamic crease lighting + SVG ink-blot frontispiece
 *   reveal + live Waline comments on the back spread.
 */
import type { StudioSound } from "./studio-sound";

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  published: string;
  category: string;
  tags: string[];
  charCount: number;
  html: string;
}

export interface MurmurBrief {
  date: string;
  excerpt: string;
}

interface BookPage {
  kind: "cover" | "frontispiece" | "toc" | "chapter" | "appendix" | "comments" | "endpaper";
  chapterIdx?: number;
  chapterTitle?: string;
  slug?: string;
  html: string;
  folio?: number;
}

const CN_NUMS = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class BookEngine {
  private modal: HTMLElement;
  private shell: HTMLElement;
  private stage: HTMLElement;
  private leftSlot: HTMLElement;
  private rightSlot: HTMLElement;
  private leftEdge: HTMLElement;
  private rightEdge: HTMLElement;
  private ribbon: HTMLElement | null;
  private castLeft: HTMLElement;
  private castRight: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private pageIndicator: HTMLElement;
  private progressFill: HTMLElement;
  private activeSlug = "";
  private measureBox: HTMLElement;
  private sound: StudioSound;

  private posts: PostMeta[] = [];
  private murmurs: MurmurBrief[] = [];
  private pages: BookPage[] = [];
  private chapterStartPage: number[] = [];
  private appendixPageIdx = -1;
  private walineServerUrl = "";
  private totalChars = 0;

  private spreadIndex = 0;
  private isTurning = false;
  private isMobile = false;
  private fontSize = 15.8;
  private reducedMotion = false;
  private inkRevealed = false;
  private walineMountedFor = "";
  private walineModPromise: Promise<{ init: (opts: Record<string, unknown>) => void }> | null = null;

  private static readonly EDITORIAL_REACTIONS = [
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23f7ece8' stroke='%23c84b31' stroke-width='1.1'/%3E%3Cpath d='M12 16.8s-4.7-2.9-4.7-6.3a2.7 2.7 0 0 1 4.7-1.8 2.7 2.7 0 0 1 4.7 1.8c0 3.4-4.7 6.3-4.7 6.3z' fill='%23c84b31'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23f6f1e4' stroke='%23b58134' stroke-width='1.1'/%3E%3Cpath d='M12 6.2l1.4 4.4 4.4 1.4-4.4 1.4L12 17.8l-1.4-4.4-4.4-1.4 4.4-1.4L12 6.2z' fill='%23b58134'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23edf1f7' stroke='%2323418f' stroke-width='1.1'/%3E%3Cpath d='M7 8.5c1.7 0 3.4.5 5 1.6 1.6-1.1 3.3-1.6 5-1.6v7.5c-1.7 0-3.4.5-5 1.5-1.6-1-3.3-1.5-5-1.5V8.5z' stroke='%2323418f' stroke-width='1.4' stroke-linejoin='round'/%3E%3Cpath d='M12 10.1v7.4' stroke='%2323418f' stroke-width='1.2'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23f3efe7' stroke='%23785d40' stroke-width='1.1'/%3E%3Cpath d='M7.5 11.2h7.6v3.2a3.3 3.3 0 0 1-3.3 3.3h-1a3.3 3.3 0 0 1-3.3-3.3v-3.2z' stroke='%23785d40' stroke-width='1.4' stroke-linejoin='round'/%3E%3Cpath d='M15.1 12h1.2a1.6 1.6 0 0 1 0 3.2h-1.2M9.8 8.7c0-.9.8-1 .8-1.9M12.4 8.7c0-.9.8-1 .8-1.9' stroke='%23785d40' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23efede9' stroke='%233d3a35' stroke-width='1.1'/%3E%3Cpath d='M14.7 14.8A4.8 4.8 0 0 1 9.4 7.7a5.1 5.1 0 1 0 6.9 6.8 4.6 4.6 0 0 1-1.6.3z' fill='%233d3a35'/%3E%3C/svg%3E",
  ];

  // Interactive drag state
  private dragActive = false;
  private dragDir: 1 | -1 | 0 = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragProgress = 0;
  private dragBiasY = 0;
  private dragLeaf: HTMLElement | null = null;
  private dragCurl: {
    root: HTMLElement;
    frontClip: HTMLElement;
    frontSheen: HTMLElement;
    underShadow: HTMLElement;
    flapShadow: HTMLElement;
    flapShadowSide: HTMLElement;
    flapShadowBot: HTMLElement;
    backSheet: HTMLElement;
    backSheen: HTMLElement;
    mirror: boolean;
    reversePlay: boolean;
    pageW: number;
    pageH: number;
    diagLen: number;
  } | null = null;
  private justDraggedUntil = 0;
  private wheelLock = 0;

  constructor(modal: HTMLElement, sound: StudioSound) {
    this.modal = modal;
    this.sound = sound;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.walineServerUrl = modal.dataset.walineServer || "";

    this.shell = modal.querySelector<HTMLElement>(".book-shell")!;
    this.stage = modal.querySelector<HTMLElement>(".book-stage")!;
    this.leftSlot = modal.querySelector<HTMLElement>(".book-slot-left")!;
    this.rightSlot = modal.querySelector<HTMLElement>(".book-slot-right")!;
    this.leftEdge = modal.querySelector<HTMLElement>(".book-edge-left")!;
    this.rightEdge = modal.querySelector<HTMLElement>(".book-edge-right")!;
    this.ribbon = modal.querySelector<HTMLElement>(".book-ribbon");
    this.castLeft = modal.querySelector<HTMLElement>(".flip-cast-left")!;
    this.castRight = modal.querySelector<HTMLElement>(".flip-cast-right")!;
    this.prevBtn = modal.querySelector<HTMLButtonElement>(".book-nav-prev")!;
    this.nextBtn = modal.querySelector<HTMLButtonElement>(".book-nav-next")!;
    this.pageIndicator = modal.querySelector<HTMLElement>("[data-book-indicator]")!;
    this.progressFill = modal.querySelector<HTMLElement>(".book-progress-fill")!;
    this.measureBox = document.getElementById("book-measure-sandbox")!;

    this.loadSourceData();
    this.bindControls();
  }

  private loadSourceData(): void {
    const templates = Array.from(document.querySelectorAll<HTMLTemplateElement>("template.book-source-post"));
    this.posts = templates.map((tpl) => {
      const container = document.createElement("div");
      container.appendChild(tpl.content.cloneNode(true));
      const paragraphs = container.querySelectorAll("p");
      const lastParagraph = paragraphs[paragraphs.length - 1];
      if (lastParagraph && /^(——|---|\-\-)\s*/.test((lastParagraph.textContent || "").trim())) {
        lastParagraph.classList.add("article-signoff");
      }
      const charCount = Number(tpl.dataset.chars || "0");
      this.totalChars += charCount;
      return {
        slug: tpl.dataset.slug || "",
        title: tpl.dataset.title || "无题",
        description: tpl.dataset.description || "",
        published: tpl.dataset.published || "",
        category: tpl.dataset.category || "随笔",
        tags: (tpl.dataset.tags || "").split(",").map((s) => s.trim()).filter(Boolean),
        charCount,
        html: container.innerHTML,
      };
    });

    const murmurScript = document.getElementById("studio-murmur-data");
    if (murmurScript?.textContent) {
      try {
        this.murmurs = JSON.parse(murmurScript.textContent);
      } catch {
        this.murmurs = [];
      }
    }
  }

  /** Build / rebuild pages whenever book opens or viewport/font size changes */
  public rebuild(preserveRatio = false): void {
    const prevTotal = Math.max(1, this.totalSpreads() - 1);
    const ratio = preserveRatio ? this.spreadIndex / prevTotal : 0;

    this.isMobile = window.innerWidth <= 767;
    this.shell.style.setProperty("--book-font-size", `${this.fontSize}px`);

    // Measure actual book page body box dimensions
    const shellRect = this.shell.getBoundingClientRect();
    const bookW = shellRect.width > 80 ? shellRect.width : (this.isMobile ? window.innerWidth - 28 : Math.min(window.innerWidth * 0.86, 1080));
    const bookH = shellRect.height > 80 ? shellRect.height : (this.isMobile ? Math.min(window.innerHeight * 0.74, 620) : Math.min(window.innerHeight * 0.74, 690));

    const padX = this.isMobile ? 40 : (window.innerWidth <= 960 ? 52 : 80);
    const padY = this.isMobile ? 40 : (window.innerWidth <= 960 ? 44 : 60);
    const headerFootReserve = 76; // running head + folio + margins
    const pageW = (this.isMobile ? bookW : bookW / 2) - padX;
    const pageH = Math.max(220, bookH - padY - headerFootReserve);

    this.pages = [];
    this.chapterStartPage = [];

    // Page 0: Cover
    this.pages.push({
      kind: "cover",
      html: this.renderCoverHtml(),
    });

    // Page 1: Frontispiece (扉页)
    this.pages.push({
      kind: "frontispiece",
      html: this.renderFrontispieceHtml(),
      folio: 1,
    });

    // Placeholder Page 2: TOC (filled after chapter page numbers are known!)
    const tocPageIndex = this.pages.length;
    this.pages.push({
      kind: "toc",
      html: "",
      folio: 2,
    });

    // Paginate every real blog post into discrete print pages
    this.posts.forEach((post, chIdx) => {
      const startFolio = this.pages.length;
      this.chapterStartPage.push(startFolio);
      const chunks = this.paginatePost(post, chIdx, pageW, pageH);
      chunks.forEach((chunkHtml, partIdx) => {
        const folio = this.pages.length;
        const isLastPart = partIdx === chunks.length - 1;
        this.pages.push({
          kind: "chapter",
          chapterIdx: chIdx,
          chapterTitle: post.title,
          slug: post.slug,
          folio,
          html: this.wrapBookPage(
            partIdx === 0 ? "CHENHUI · 随想录" : post.title,
            post.published,
            chunkHtml + (isLastPart ? `<div class="end-divider" style="margin-top:16px">— 本篇终 —</div>` : ""),
            folio,
            `${partIdx + 1} / ${chunks.length}`
          ),
        });
      });
    });

    // Ensure Appendix starts on a clean Left page on desktop (odd index in pages array)
    if (!this.isMobile && this.pages.length % 2 === 0) {
      const folio = this.pages.length;
      this.pages.push({
        kind: "endpaper",
        folio,
        html: this.wrapBookPage(
          "CHENHUI · 留白",
          "MARGINALIA",
          `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0.55;gap:10px">
            <span style="font-size:18px;color:var(--accent)">✦</span>
            <p class="no-indent" style="font-size:13px;letter-spacing:0.12em">此页留白，待下一篇故事落笔。</p>
          </div>`,
          folio,
          ""
        ),
      });
    }

    // Appendix Page: Murmur Excerpts & Colophon
    this.appendixPageIdx = this.pages.length;
    this.pages.push({
      kind: "appendix",
      folio: this.appendixPageIdx,
      html: this.renderAppendixHtml(this.appendixPageIdx),
    });

    // Final Page: Reader Notes & Live Waline Comments
    const firstPost = this.posts[0];
    const commentFolio = this.pages.length;
    this.pages.push({
      kind: "comments",
      slug: firstPost?.slug || "",
      chapterTitle: firstPost?.title || "随想录",
      folio: commentFolio,
      html: this.renderCommentsPageHtml(firstPost, commentFolio),
    });

    // Fill TOC now that we have exact folio numbers for every chapter!
    this.pages[tocPageIndex].html = this.renderTocHtml();

    if (preserveRatio) {
      this.spreadIndex = Math.min(this.totalSpreads() - 1, Math.round(ratio * (this.totalSpreads() - 1)));
    } else {
      this.spreadIndex = Math.min(this.spreadIndex, this.totalSpreads() - 1);
    }

    this.renderCurrentSpread();
  }

  /** Split rendered HTML of a post into exact-height page chunks */
  private paginatePost(post: PostMeta, chIdx: number, pageW: number, pageH: number): string[] {
    const sandbox = document.createElement("div");
    sandbox.className = "page-body";
    sandbox.style.width = `${Math.floor(pageW)}px`;
    sandbox.style.fontSize = `${this.fontSize}px`;
    sandbox.style.lineHeight = "1.9";
    sandbox.style.overflow = "visible";
    sandbox.style.height = "auto";
    this.measureBox.innerHTML = "";
    this.measureBox.appendChild(sandbox);

    const src = document.createElement("div");
    src.innerHTML = post.html;

    const queue: Node[] = [];
    // Insert Chapter Opener header block first
    const opener = document.createElement("div");
    opener.className = "chapter-opener";
    const cnNum = CN_NUMS[chIdx] || String(chIdx + 1).padStart(2, "0");
    opener.innerHTML = `
      <span class="chapter-badge">CHAPTER ${String(chIdx + 1).padStart(2, "0")} · 卷${cnNum}</span>
      <h1 class="chapter-h1">${escapeHtml(post.title)}</h1>
      ${post.description ? `<p class="chapter-subtitle no-indent">${escapeHtml(post.description)}</p>` : ""}
      <div class="chapter-meta">
        <span>${escapeHtml(post.published)}</span>
        <span>·</span>
        <span>${escapeHtml(post.category)}</span>
        ${post.tags.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")}
        <span>· ${post.charCount} 字</span>
      </div>
    `;
    queue.push(opener);

    Array.from(src.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) return;
      queue.push(node);
    });

    const chunks: string[] = [];
    const safeH = pageH - 10;

    const flushPage = () => {
      if (sandbox.innerHTML.trim()) {
        chunks.push(sandbox.innerHTML);
      }
      sandbox.innerHTML = "";
    };

    let i = 0;
    while (i < queue.length) {
      const node = queue[i].cloneNode(true);
      sandbox.appendChild(node);

      if (sandbox.scrollHeight <= safeH) {
        i++;
        continue;
      }

      // Overflowed! Remove last added node
      sandbox.removeChild(node);

      // If sandbox already has content, flush current page & retry this node on next page
      if (sandbox.childNodes.length > 0) {
        // Avoid trailing orphan <hr> at bottom of page
        if (sandbox.lastElementChild?.tagName === "HR") {
          sandbox.removeChild(sandbox.lastElementChild);
        }
        flushPage();
        // Skip leading <hr> at top of a brand-new page
        if (node instanceof HTMLElement && node.tagName === "HR") {
          i++;
        }
        continue;
      }

      // Single paragraph is taller than a whole page -> split cleanly by character binary search
      if (node instanceof HTMLElement && node.tagName === "P") {
        const fullText = node.textContent || "";
        let lo = 20;
        let hi = fullText.length;
        let fit = Math.min(40, fullText.length);
        const testP = document.createElement("p");
        if (node.classList.contains("no-indent")) testP.classList.add("no-indent");
        sandbox.appendChild(testP);

        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          testP.textContent = fullText.slice(0, mid);
          if (sandbox.scrollHeight <= safeH) {
            fit = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        // Prefer breaking on Chinese/English punctuation if close
        const slice = fullText.slice(0, fit);
        const punct = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("，"), slice.lastIndexOf("！"), slice.lastIndexOf("？"));
        const cut = punct > fit * 0.55 ? punct + 1 : fit;
        testP.textContent = fullText.slice(0, cut);
        flushPage();

        const rest = fullText.slice(cut).trim();
        if (rest.length > 0) {
          const nextP = document.createElement("p");
          nextP.classList.add("no-indent");
          nextP.textContent = rest;
          queue[i] = nextP;
        } else {
          i++;
        }
      } else {
        // Non-splittable tall block (e.g., code/image): place it on its own page
        sandbox.appendChild(node);
        flushPage();
        i++;
      }
    }

    if (sandbox.childNodes.length > 0) {
      if (sandbox.lastElementChild?.tagName === "HR") {
        sandbox.removeChild(sandbox.lastElementChild);
      }
      flushPage();
    }

    this.measureBox.innerHTML = "";
    return chunks.length ? chunks : ["<p class='no-indent'>暂无内容。</p>"];
  }

  private wrapBookPage(headLeft: string, headRight: string, bodyHtml: string, folio: number, footRight: string): string {
    return `
      <div class="page-sheet">
        <div class="page-running-head">
          <span>${escapeHtml(headLeft)}</span>
          <span>${escapeHtml(headRight)}</span>
        </div>
        <div class="page-body">${bodyHtml}</div>
        <div class="page-folio">
          <span>P.${String(folio).padStart(2, "0")}</span>
          <span>${escapeHtml(footRight)}</span>
        </div>
      </div>
    `;
  }

  private renderCoverHtml(): string {
    const count = this.posts.length;
    return `
      <div class="page-cover" data-book-open-cover>
        <div class="cover-head">
          <span class="cover-edition">ARCHIVAL EDITION · VOL.01</span>
          <span class="cover-seal-lg" aria-hidden="true">记</span>
        </div>
        <div class="cover-middle">
          <h2 class="cover-title">随想录</h2>
          <p class="cover-sub">CHENHUI — Everyday Essays &amp; Memories</p>
          <div class="cover-rule"></div>
          <p class="cover-motto">人无法同时拥有青春和对青春的感受。</p>
        </div>
        <div class="cover-bottom">
          <div class="cover-author">CHENHUI · ${count} 篇收录</div>
          <span class="cover-open-cta">
            <span>翻开此书</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
    `;
  }

  private renderFrontispieceHtml(): string {
    return `
      <div class="page-sheet">
        <div class="page-running-head">
          <span>FRONTISPIECE</span>
          <span>扉页</span>
        </div>
        <div class="frontispiece">
          <div class="front-art-wrap" aria-hidden="true">
            <svg viewBox="0 0 240 210" width="210" height="190">
              <defs>
                <filter id="book-ink-filter" x="-30%" y="-30%" width="160%" height="160%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="11" result="noise"/>
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G"/>
                </filter>
                <mask id="book-ink-mask" maskUnits="userSpaceOnUse" x="-40" y="-40" width="320" height="290">
                  <g filter="url(#book-ink-filter)">
                    <circle class="ink-blob" cx="85" cy="95" r="0" fill="#fff"/>
                    <circle class="ink-blob" cx="155" cy="115" r="0" fill="#fff"/>
                    <circle class="ink-blob" cx="120" cy="65" r="0" fill="#fff"/>
                    <circle class="ink-blob" cx="120" cy="150" r="0" fill="#fff"/>
                  </g>
                </mask>
              </defs>
              <g mask="url(#book-ink-mask)">
                <!-- Minimalist northern plain horizon, sun & bicycle silhouette -->
                <circle cx="156" cy="58" r="24" fill="var(--accent)" opacity="0.18"/>
                <circle cx="156" cy="58" r="14" fill="var(--accent)" opacity="0.82"/>
                <path d="M18 148 Q75 132 126 144 T224 140" fill="none" stroke="var(--ink)" stroke-width="1.2" opacity="0.45"/>
                <path d="M26 158 L214 158" stroke="var(--ink)" stroke-width="0.9" stroke-dasharray="3 5" opacity="0.35"/>
                <!-- Minimalist bicycle -->
                <g stroke="var(--ink)" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(66, 94)">
                  <circle cx="22" cy="48" r="17"/>
                  <circle cx="86" cy="48" r="17"/>
                  <path d="M22 48 L48 48 L68 22 L38 22 Z"/>
                  <path d="M68 22 L86 48"/>
                  <path d="M38 22 L34 14 M28 14 L42 14"/>
                  <path d="M68 22 L73 12 L82 12"/>
                </g>
                <!-- Distant village rooftop lines -->
                <path d="M158 134 L172 122 L186 134 M162 134 L162 146 M182 134 L182 146" fill="none" stroke="var(--ink)" stroke-width="1.2" opacity="0.55"/>
                <rect x="192" y="24" width="22" height="22" rx="2" fill="none" stroke="var(--accent)" stroke-width="1.2"/>
                <text x="203" y="39" text-anchor="middle" fill="var(--accent)" font-size="11" font-family="serif">序</text>
              </g>
            </svg>
          </div>
          <div>
            <h2 class="front-title">随想录</h2>
            <div class="front-en">CHENHUI · Personal Monograph</div>
            <blockquote class="front-quote">
              「人无法同时拥有青春和对青春的感受」
            </blockquote>
          </div>
          <div class="front-colophon">
            <div>2026.05.01</div>
            <div>收录文章 ${this.posts.length} 篇 · 共计 ${this.totalChars.toLocaleString()} 字 · 著 / CHENHUI</div>
          </div>
        </div>
        <div class="page-folio">
          <span>P.01</span>
          <span>CHENHUI</span>
        </div>
      </div>
    `;
  }

  private renderTocHtml(): string {
    const itemsHtml = this.posts
      .map((post, idx) => {
        const startPage = this.chapterStartPage[idx] ?? 3;
        const nextStart = this.chapterStartPage[idx + 1] ?? this.appendixPageIdx;
        const pageSpan = Math.max(1, nextStart - startPage);
        return `
          <li>
            <button type="button" class="toc-entry" data-goto-page="${startPage}">
              <div class="toc-row">
                <span class="toc-ch-num">${String(idx + 1).padStart(2, "0")}</span>
                <span class="toc-ch-name">${escapeHtml(post.title)}</span>
                <span class="toc-dots" aria-hidden="true"></span>
                <span class="toc-pg-num">P.${String(startPage).padStart(2, "0")}</span>
              </div>
              ${post.description ? `<div class="toc-desc">${escapeHtml(post.description)}</div>` : ""}
              <div class="toc-meta-row">
                <span>${escapeHtml(post.published)}</span>
                <span>·</span>
                <span>${escapeHtml(post.category)}</span>
                <span>·</span>
                <span>共 ${pageSpan} 页</span>
              </div>
            </button>
          </li>
        `;
      })
      .join("");

    const appendixRow =
      this.appendixPageIdx > 0
        ? `
          <li>
            <button type="button" class="toc-entry" data-goto-page="${this.appendixPageIdx}">
              <div class="toc-row">
                <span class="toc-ch-num">附</span>
                <span class="toc-ch-name">卷末拾遗 · 碎碎念与读后留痕</span>
                <span class="toc-dots" aria-hidden="true"></span>
                <span class="toc-pg-num">P.${String(this.appendixPageIdx).padStart(2, "0")}</span>
              </div>
              <div class="toc-desc">几条日常片语，以及给路过读者的留言簿</div>
            </button>
          </li>
        `
        : "";

    return `
      <div class="page-sheet">
        <div class="page-running-head">
          <span>CONTENTS</span>
          <span>目录</span>
        </div>
        <div class="page-body" style="overflow-y:auto">
          <div class="toc-header">
            <span class="lbl toc-eyebrow">INDEX OF CHAPTERS</span>
            <h2 class="toc-title">目 录</h2>
          </div>
          <ul class="toc-list">
            ${itemsHtml}
            ${appendixRow}
          </ul>
        </div>
        <div class="page-folio">
          <span>P.02</span>
          <span>点击章节直达 →</span>
        </div>
      </div>
    `;
  }

  private renderAppendixHtml(folio: number): string {
    const snippets = this.murmurs
      .slice(0, 3)
      .map(
        (m) => `
        <div class="appendix-item">
          <time>${escapeHtml(m.date)}</time>
          <p>${escapeHtml(m.excerpt)}</p>
        </div>
      `
      )
      .join("");

    return this.wrapBookPage(
      "APPENDIX · 拾遗",
      "MARGINALIA",
      `
        <div style="display:flex;flex-direction:column;height:100%;justify-content:space-between;gap:16px">
          <div>
            <span class="chapter-badge">APPENDIX · 卷末摘记</span>
            <h2 style="margin:0 0 12px;font-size:22px">碎碎念节选</h2>
            <div class="appendix-murmurs">${snippets || "<p class='no-indent'>暂无摘记。</p>"}</div>
          </div>
          <div style="border-top:1px dashed var(--rule);padding-top:12px;font-size:12px;color:var(--muted);line-height:1.7">
            本书内容与博客 Markdown 文件实时同步。每当新文章落笔，目录与页码会自动重新装订成册。
          </div>
        </div>
      `,
      folio,
      "卷末"
    );
  }

  private renderCommentsPageHtml(post: PostMeta | undefined, folio: number): string {
    const slug = post?.slug || "";
    const title = post?.title || "随想录";
    return `
      <div class="page-sheet page-comments">
        <div class="page-running-head">
          <span>READER NOTES</span>
          <span>读后留痕</span>
        </div>
        <div class="book-guestbook-head">
          <div>
            <span class="chapter-badge">GUESTBOOK · 留言簿</span>
            <h2 class="guestbook-title">《${escapeHtml(title)}》· 读后留痕</h2>
          </div>
          <button type="button" class="end-btn" data-goto-page="2">返回目录 ↺</button>
        </div>
        <div class="book-end-card">
          <div id="book-waline-mount" class="book-waline-wrap" data-slug="${escapeHtml(slug)}">
            <div class="waline-loading-note">正在铺开留言笺…</div>
          </div>
        </div>
        <div class="page-folio">
          <span>P.${String(folio).padStart(2, "0")}</span>
          <span>终页</span>
        </div>
      </div>
    `;
  }

  private totalSpreads(): number {
    if (this.isMobile) return this.pages.length;
    return 1 + Math.ceil(Math.max(0, this.pages.length - 1) / 2);
  }

  private getSpreadPages(spread: number): { left: BookPage | null; right: BookPage | null } {
    if (this.isMobile) {
      return { left: null, right: this.pages[spread] || null };
    }
    if (spread === 0) {
      return { left: null, right: this.pages[0] || null };
    }
    const leftIdx = spread * 2 - 1;
    const rightIdx = spread * 2;
    return {
      left: this.pages[leftIdx] || null,
      right: this.pages[rightIdx] || null,
    };
  }

  private pageIndexToSpread(pageIdx: number): number {
    if (this.isMobile) return Math.max(0, Math.min(this.pages.length - 1, pageIdx));
    if (pageIdx <= 0) return 0;
    return Math.ceil(pageIdx / 2);
  }

  private renderCurrentSpread(): void {
    const { left, right } = this.getSpreadPages(this.spreadIndex);
    const isClosed = !this.isMobile && this.spreadIndex === 0;
    this.shell.classList.toggle("is-closed", isClosed);

    const canPrev = this.spreadIndex > 0;
    const canNext = this.spreadIndex < this.totalSpreads() - 1;

    this.leftSlot.innerHTML =
      (left?.html || "") +
      `<div class="corner-peel corner-peel-left ${canPrev ? "enabled" : ""}" aria-hidden="true"></div>`;
    this.rightSlot.innerHTML =
      (right?.html || "") +
      `<div class="corner-peel corner-peel-right ${canNext && !isClosed ? "enabled" : ""}" aria-hidden="true"></div>`;

    this.prevBtn.disabled = !canPrev;
    this.nextBtn.disabled = !canNext;
    const mPrev = this.modal.querySelector<HTMLButtonElement>("[data-mobile-prev]");
    const mNext = this.modal.querySelector<HTMLButtonElement>("[data-mobile-next]");
    if (mPrev) mPrev.disabled = !canPrev;
    if (mNext) mNext.disabled = !canNext;

    // Update page counter & progress bar
    const total = this.totalSpreads();
    const pct = total > 1 ? this.spreadIndex / (total - 1) : 1;
    this.progressFill.style.transform = `scaleX(${pct.toFixed(3)})`;

    if (this.spreadIndex === 0) {
      this.pageIndicator.textContent = `封面 · 共 ${this.pages.length - 1} 页`;
    } else if (this.isMobile) {
      this.pageIndicator.textContent = `P.${String(this.spreadIndex).padStart(2, "0")} / ${String(this.pages.length - 1).padStart(2, "0")}`;
    } else {
      const lFolio = left?.folio ?? 0;
      const rFolio = right?.folio ?? lFolio;
      this.pageIndicator.textContent = `P.${String(lFolio).padStart(2, "0")}–${String(rFolio).padStart(2, "0")} / ${String(this.pages.length - 1).padStart(2, "0")}`;
    }

    // Dynamic stacked paper fore-edge thickness
    const leftThickness = Math.round(3 + pct * 9);
    const rightThickness = Math.round(3 + (1 - pct) * 9);
    this.leftEdge.style.width = `${leftThickness}px`;
    this.rightEdge.style.width = `${rightThickness}px`;

    // Track active slug for share button
    this.activeSlug = right?.slug || left?.slug || this.posts[0]?.slug || "";

    const tabs = this.modal.querySelectorAll<HTMLButtonElement>("[data-book-jump]");
    tabs.forEach((btn) => {
      const target = btn.dataset.bookJump;
      const active =
        (target === "cover" && this.spreadIndex === 0) ||
        (target === "toc" && (this.isMobile ? this.spreadIndex === 1 || this.spreadIndex === 2 : this.spreadIndex === 1)) ||
        (target === "read" && this.spreadIndex >= (this.isMobile ? 3 : 2));
      btn.classList.toggle("active", active);
    });

    // Trigger SVG ink-blot reveal when landing on Frontispiece
    if ((left?.kind === "frontispiece" || right?.kind === "frontispiece") && !this.inkRevealed) {
      this.triggerInkReveal();
    } else if (left?.kind === "frontispiece" || right?.kind === "frontispiece") {
      // Remove SVG ink mask on revisit for instant zero-filter rendering
      this.modal.querySelector<SVGGElement>('[mask="url(#book-ink-mask)"]')?.removeAttribute("mask");
    }

    // Re-bind inside-page interactive buttons (TOC jumps, Cover open)
    this.bindDynamicPageButtons();

    // Seamlessly auto-mount editorial Waline guestbook when landing on the back comments page
    if (left?.kind === "comments" || right?.kind === "comments") {
      const mount = this.modal.querySelector<HTMLElement>("#book-waline-mount");
      const slug = mount?.dataset.slug || "";
      if (mount && slug) {
        void this.mountWalineInBook(slug);
      }
    }
  }

  private triggerInkReveal(): void {
    this.inkRevealed = true;
    const blobs = Array.from(this.modal.querySelectorAll<SVGCircleElement>(".ink-blob"));
    if (!blobs.length) return;
    if (this.reducedMotion) {
      blobs.forEach((b) => b.setAttribute("r", "140"));
      return;
    }
    const delays = [0, 120, 210, 300];
    const start = performance.now();
    const duration = 1100;
    const step = (now: number) => {
      let done = true;
      blobs.forEach((b, idx) => {
        const elapsed = now - start - (delays[idx] || 0);
        if (elapsed <= 0) {
          done = false;
          return;
        }
        const p = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        b.setAttribute("r", (eased * 145).toFixed(1));
        if (p < 1) done = false;
      });
      if (!done) {
        requestAnimationFrame(step);
      } else {
        // Release SVG displacement mask once reveal finishes so zero ongoing filter cost
        const artGroup = this.modal.querySelector<SVGGElement>('[mask="url(#book-ink-mask)"]');
        artGroup?.removeAttribute("mask");
      }
    };
    requestAnimationFrame(step);
  }

  private bindDynamicPageButtons(): void {
    this.modal.querySelector("[data-book-open-cover]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.goToSpread(1);
    });

    this.modal.querySelectorAll<HTMLElement>("[data-goto-page]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pageIdx = Number(btn.dataset.gotoPage || "0");
        this.goToSpread(this.pageIndexToSpread(pageIdx));
      });
    });

    this.modal.querySelector<HTMLButtonElement>("[data-load-book-waline]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = e.currentTarget as HTMLButtonElement;
      const slug = btn.dataset.slug || "";
      void this.mountWalineInBook(slug);
    });
  }

  private async mountWalineInBook(slug: string): Promise<void> {
    const mount = this.modal.querySelector<HTMLElement>("#book-waline-mount");
    if (!mount || !this.walineServerUrl) {
      if (mount) mount.innerHTML = `<div class="waline-loading-note">未配置 Waline 服务地址。</div>`;
      return;
    }
    if (mount.dataset.loaded === "true" || mount.dataset.loading === "true") return;

    mount.dataset.loading = "true";
    mount.innerHTML = `<div class="waline-loading-note">正在铺开留言笺…</div>`;
    try {
      if (!this.walineModPromise) {
        this.walineModPromise = Promise.race([
          import(/* @vite-ignore */ "https://unpkg.com/@waline/client@3/dist/waline.js"),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000)),
        ]);
      }
      const mod = await this.walineModPromise;
      if (!mount.isConnected) return;
      mount.innerHTML = "";
      mod.init({
        el: "#book-waline-mount",
        serverURL: this.walineServerUrl,
        path: "/" + slug,
        lang: "zh-CN",
        reaction: BookEngine.EDITORIAL_REACTIONS,
        pageview: true,
        dark: "html.dark",
        requiredMeta: ["nick", "mail"],
        locale: {
          reactionTitle: "— 读罢留个小印记 —",
          reaction0: "喜欢",
          reaction1: "共鸣",
          reaction2: "好文",
          reaction3: "暖心",
          reaction4: "掩卷",
          placeholder: "写下此刻的想法、共鸣，或留一句路过的话…",
          nick: "称呼",
          mail: "邮箱",
          link: "站点",
          submit: "落笔留言",
          sofa: "书页尚留白，来写下第一行注脚吧。",
        },
      });
      mount.dataset.loaded = "true";
      delete mount.dataset.loading;
      this.walineMountedFor = slug;
    } catch {
      this.walineModPromise = null;
      delete mount.dataset.loading;
      mount.innerHTML = `
        <div class="waline-loading-note">
          <p style="margin:0 0 10px;color:var(--accent)">留言笺连接超时，请稍后再试。</p>
          <button type="button" class="end-btn accent" data-load-book-waline data-slug="${escapeHtml(slug)}">重新加载</button>
        </div>
      `;
      this.bindDynamicPageButtons();
    }
  }

  /** Jump directly to a post chapter by its Astro slug (used by Search & /posts/* deep links) */
  public openChapterBySlug(slug: string): void {
    const idx = this.posts.findIndex((p) => p.slug === slug);
    const pageIdx = idx >= 0 ? (this.chapterStartPage[idx] ?? 3) : 2;
    this.spreadIndex = this.pageIndexToSpread(pageIdx);
    this.renderCurrentSpread();
  }

  /** Jump to any spread with smooth 3D page flip animation */
  public goToSpread(targetSpread: number): void {
    const clamped = Math.max(0, Math.min(this.totalSpreads() - 1, targetSpread));
    if (clamped === this.spreadIndex || this.isTurning) return;

    if (this.reducedMotion) {
      this.spreadIndex = clamped;
      this.renderCurrentSpread();
      return;
    }

    const dir: 1 | -1 = clamped > this.spreadIndex ? 1 : -1;
    this.animateFlip(this.spreadIndex, clamped, dir, 0);
  }

  public step(delta: 1 | -1): void {
    this.goToSpread(this.spreadIndex + delta);
  }

  /** Smooth velvety S-curve: effortless lift -> natural glide -> feather-soft landing */
  private softPaperEase(t: number): number {
    const sine = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const outCubic = 1 - Math.pow(1 - t, 3);
    return sine * 0.8 + outCubic * 0.2;
  }

  private createFlipLeaf(frontHtml: string, backHtml: string, startAngle: number, isHardcover = false): HTMLElement {
    const leaf = document.createElement("div");
    leaf.className = isHardcover ? "flip-leaf is-hardcover" : "flip-leaf";
    leaf.style.transform = `translate3d(0, 0, 0.5px) rotateY(${startAngle}deg)`;
    leaf.innerHTML = `
      <div class="flip-face flip-face-front">
        ${frontHtml}
        <div class="flip-curl-sheen"></div>
        <div class="flip-shade"></div>
      </div>
      <div class="flip-face flip-face-back">
        ${backHtml}
        <div class="flip-curl-sheen"></div>
        <div class="flip-shade"></div>
      </div>
    `;
    this.shell.appendChild(leaf);
    return leaf;
  }

  /** Apply spine-locked 3D turn pose, cylindrical paper light sweep, and expanding cast shadows */
  private applyLeafPose(
    leaf: HTMLElement,
    frontShade: HTMLElement | null,
    backShade: HTMLElement | null,
    frontSheen: HTMLElement | null,
    backSheen: HTMLElement | null,
    dir: 1 | -1,
    p: number,
    isHardcover: boolean
  ): void {
    const lift = Math.sin(p * Math.PI); // 0 -> 1 -> 0
    const softLift = Math.pow(lift, 0.88);

    if (this.isMobile) {
      // Flush single-page turn on mobile (zero vertical drift or tilt misalignment)
      const angle = dir === 1 ? -124 * p : -124 * (1 - p);
      const slideX = dir === 1 ? -p * 12 : -(1 - p) * 12;
      leaf.style.transform = `translate3d(${slideX.toFixed(2)}%, 0, 0.5px) rotateY(${angle.toFixed(2)}deg)`;
      const fadeOut = dir === 1 ? (p > 0.65 ? 1 - (p - 0.65) / 0.35 : 1) : (p < 0.35 ? p / 0.35 : 1);
      leaf.style.opacity = Math.max(0, Math.min(1, fadeOut)).toFixed(3);
      if (frontShade) frontShade.style.setProperty("--shade", (softLift * 0.38).toFixed(3));
      if (frontSheen) {
        frontSheen.style.setProperty("--sheen-pos", `${(88 - p * 76).toFixed(1)}%`);
        frontSheen.style.opacity = (softLift * 0.72).toFixed(3);
      }
      this.castRight.style.opacity = (softLift * 0.42).toFixed(3);
      this.castRight.style.transform = `scaleX(${(0.35 + softLift * 0.65).toFixed(3)})`;
      this.castLeft.style.opacity = "0";
      return;
    }

    // Desktop 2-page spread: mathematically spine-locked pure rotateY (zero step/gap at center crease)
    const angle = dir === 1 ? -180 * p : -180 * (1 - p);
    const flexFactor = isHardcover ? 0.35 : 1;
    leaf.style.transform = `translate3d(0, 0, 0.5px) rotateY(${angle.toFixed(2)}deg)`;

    // Cylindrical paper light crest sweeps smoothly across the turning leaf
    const phase = dir === 1 ? p : 1 - p; // 0 = resting right, 0.5 = vertical, 1 = resting left
    if (frontSheen) {
      const frontPhase = Math.min(1, phase * 2);
      const crestX = 88 - frontPhase * 76;
      frontSheen.style.setProperty("--sheen-pos", `${crestX.toFixed(1)}%`);
      frontSheen.style.opacity = (Math.sin(frontPhase * Math.PI) * 0.88 * flexFactor).toFixed(3);
    }
    if (backSheen) {
      const backPhase = Math.max(0, (phase - 0.5) * 2);
      const crestX = 12 + backPhase * 76;
      backSheen.style.setProperty("--sheen-pos", `${crestX.toFixed(1)}%`);
      backSheen.style.opacity = (Math.sin(backPhase * Math.PI) * 0.88 * flexFactor).toFixed(3);
    }

    // Smooth progressive paper shading as the page turns away from overhead light
    if (frontShade) {
      const s = phase < 0.5 ? Math.sin(phase * Math.PI) * 0.48 : 0.48;
      frontShade.style.setProperty("--shade", s.toFixed(3));
    }
    if (backShade) {
      const s = phase > 0.5 ? Math.sin((1 - phase) * Math.PI) * 0.44 : 0.44;
      backShade.style.setProperty("--shade", s.toFixed(3));
    }

    // Dynamic angle-coupled cast shadows fanning outward & tapering inward from the spine
    const rightArc = phase < 0.72 ? Math.sin(Math.min(1, phase / 0.72) * Math.PI) : 0;
    const leftArc = phase > 0.28 ? Math.sin(Math.min(1, (phase - 0.28) / 0.72) * Math.PI) : 0;
    this.castRight.style.opacity = (rightArc * 0.58).toFixed(3);
    this.castRight.style.transform = `scaleX(${(0.28 + rightArc * 0.72).toFixed(3)})`;
    this.castLeft.style.opacity = (leftArc * 0.54).toFixed(3);
    this.castLeft.style.transform = `scaleX(${(0.28 + leftArc * 0.72).toFixed(3)})`;
  }

  /** Create a diagonal corner-peel flexible paper curl rig over the book spread */
  private createCurlRig(
    frontHtml: string,
    backHtml: string,
    mirror: boolean,
    reversePlay = false
  ): NonNullable<BookEngine["dragCurl"]> {
    const pageW = this.isMobile ? this.shell.clientWidth : this.shell.clientWidth * 0.5;
    const pageH = this.shell.clientHeight;
    const diagLen = Math.ceil(Math.hypot(pageW, pageH) + 80);

    const root = document.createElement("div");
    root.className = mirror ? "curl-stage is-mirror" : "curl-stage";
    root.innerHTML = `
      <div class="curl-half curl-under-shadow">
        <div class="curl-under-shadow-band" style="height:${diagLen}px"></div>
      </div>
      <div class="curl-half curl-front-clip">
        ${frontHtml}
        <div class="curl-front-sheen" style="height:${diagLen}px"></div>
      </div>
      <div class="curl-half curl-back-wrap">
        <div class="curl-flap-shadow" aria-hidden="true">
          <div class="curl-flap-shadow-side"></div>
          <div class="curl-flap-shadow-bot"></div>
        </div>
        <div class="curl-back-sheet">
          ${backHtml}
          <div class="curl-back-sheen" style="height:${diagLen}px"></div>
        </div>
      </div>
    `;
    this.shell.appendChild(root);

    return {
      root,
      frontClip: root.querySelector<HTMLElement>(".curl-front-clip")!,
      frontSheen: root.querySelector<HTMLElement>(".curl-front-sheen")!,
      underShadow: root.querySelector<HTMLElement>(".curl-under-shadow-band")!,
      flapShadow: root.querySelector<HTMLElement>(".curl-flap-shadow")!,
      flapShadowSide: root.querySelector<HTMLElement>(".curl-flap-shadow-side")!,
      flapShadowBot: root.querySelector<HTMLElement>(".curl-flap-shadow-bot")!,
      backSheet: root.querySelector<HTMLElement>(".curl-back-sheet")!,
      backSheen: root.querySelector<HTMLElement>(".curl-back-sheen")!,
      mirror,
      reversePlay,
      pageW,
      pageH,
      diagLen,
    };
  }

  /**
   * Compute exact analytical perpendicular-bisector paper fold geometry:
   * - Grabs bottom outer corner and curls diagonally across the spread without ever tearing the spine.
   * - 100% GPU compositor transforms (zero per-frame left/width layout thrashing or offscreen Gaussian blur).
   */
  private updateCurlRig(
    rig: NonNullable<BookEngine["dragCurl"]>,
    progress: number,
    verticalBias = 0
  ): void {
    const W = rig.pageW;
    const H = rig.pageH;
    const s = Math.max(0, Math.min(1, progress));

    if (s <= 0.001) {
      rig.frontClip.style.clipPath = "none";
      rig.backSheet.style.opacity = "0";
      rig.frontSheen.style.opacity = "0";
      rig.underShadow.style.opacity = "0";
      rig.flapShadow.style.opacity = "0";
      return;
    }

    if (s >= 0.999) {
      rig.frontClip.style.clipPath = "polygon(0px 0px, 0px 0px, 0px 0px)";
      rig.frontSheen.style.opacity = "0";
      rig.underShadow.style.opacity = "0";
      rig.flapShadow.style.opacity = "0";
      rig.backSheet.style.opacity = "1";
      rig.backSheet.style.clipPath = "none";
      rig.backSheet.style.transform = rig.mirror
        ? `translate3d(${W.toFixed(2)}px, 0px, 0) rotate(0rad)`
        : `translate3d(${(-W).toFixed(2)}px, 0px, 0) rotate(0rad)`;
      rig.backSheen.style.opacity = "0";
      return;
    }

    // Grabbed corner P = (px, py) sweeps smoothly from (+W, H) -> (-W, H) in canonical right-page space
    const px = W * (1 - 2 * s);
    const mainArc = Math.sin(s * Math.PI);
    const earlyPeel = Math.sin(Math.min(1, s * 2.35) * Math.PI);
    const rawLift = H * (0.085 * mainArc + 0.055 * earlyPeel) * (1 - 0.24 * s) + verticalBias * mainArc;
    // Physical non-tearing spine constraint: dist((0, H), P) <= W
    const maxSpineLift = Math.sqrt(Math.max(0, W * W - px * px)) * 0.94;
    const lift = Math.max(0, Math.min(rawLift, maxSpineLift, H * 0.24));
    const py = H - lift;

    // Perpendicular bisector L of segment from C=(W, H) to P=(px, py): x*vx + y*vy = D
    const vx = Math.max(0.001, W - px);
    const vy = Math.max(0, H - py);
    const D = (W * W - px * px + H * H - py * py) * 0.5;
    const theta = Math.atan2(vy, vx); // angle of fold line from vertical (0..pi/2)

    const xBot = Math.max(0, Math.min(W, (D - H * vy) / vx));
    const xTopRaw = D / vx;
    const hitsRightEdge = xTopRaw > W;
    const xTop = Math.max(0, Math.min(W, xTopRaw));
    const yRight = hitsRightEdge && vy > 0.001
      ? Math.max(0, Math.min(H, (D - W * vx) / vy))
      : 0;

    let backTransform: string;
    // Clip polygons for unpeeled front page and reflected curled back page
    if (!rig.mirror) {
      rig.frontClip.style.clipPath = hitsRightEdge
        ? `polygon(0px 0px, ${W.toFixed(1)}px 0px, ${W.toFixed(1)}px ${yRight.toFixed(1)}px, ${xBot.toFixed(1)}px ${H.toFixed(1)}px, 0px ${H.toFixed(1)}px)`
        : `polygon(0px 0px, ${xTop.toFixed(1)}px 0px, ${xBot.toFixed(1)}px ${H.toFixed(1)}px, 0px ${H.toFixed(1)}px)`;

      rig.backSheet.style.clipPath = hitsRightEdge
        ? `polygon(0px ${H.toFixed(1)}px, ${(W - xBot).toFixed(1)}px ${H.toFixed(1)}px, 0px ${yRight.toFixed(1)}px)`
        : `polygon(0px ${H.toFixed(1)}px, ${(W - xBot).toFixed(1)}px ${H.toFixed(1)}px, ${(W - xTop).toFixed(1)}px 0px, 0px 0px)`;

      backTransform = `translate3d(${px.toFixed(2)}px, ${(py - H).toFixed(2)}px, 0) rotate(${(2 * theta).toFixed(5)}rad)`;
    } else {
      const mxBot = W - xBot;
      const mxTop = W - xTop;
      rig.frontClip.style.clipPath = hitsRightEdge
        ? `polygon(${W.toFixed(1)}px 0px, 0px 0px, 0px ${yRight.toFixed(1)}px, ${mxBot.toFixed(1)}px ${H.toFixed(1)}px, ${W.toFixed(1)}px ${H.toFixed(1)}px)`
        : `polygon(${W.toFixed(1)}px 0px, ${mxTop.toFixed(1)}px 0px, ${mxBot.toFixed(1)}px ${H.toFixed(1)}px, ${W.toFixed(1)}px ${H.toFixed(1)}px)`;

      rig.backSheet.style.clipPath = hitsRightEdge
        ? `polygon(${W.toFixed(1)}px ${H.toFixed(1)}px, ${xBot.toFixed(1)}px ${H.toFixed(1)}px, ${W.toFixed(1)}px ${yRight.toFixed(1)}px)`
        : `polygon(${W.toFixed(1)}px ${H.toFixed(1)}px, ${xBot.toFixed(1)}px ${H.toFixed(1)}px, ${xTop.toFixed(1)}px 0px, ${W.toFixed(1)}px 0px)`;

      backTransform = `translate3d(${(-px).toFixed(2)}px, ${(py - H).toFixed(2)}px, 0) rotate(${(-2 * theta).toFixed(5)}rad)`;
    }

    rig.backSheet.style.transform = backTransform;
    rig.backSheet.style.opacity = "1";

    // Pure GPU transform-driven cylindrical highlight, inner fold shade, and cast shadows (zero layout!)
    const intensity = Math.pow(mainArc, 0.72);
    const sheenScale = (34 + intensity * 62) / 96;
    const shadowScale = (24 + intensity * 80) / 104;

    if (!rig.mirror) {
      rig.underShadow.style.transform = `translate3d(${xBot.toFixed(1)}px, 0px, 0) rotate(${theta.toFixed(5)}rad) scaleX(${shadowScale.toFixed(3)})`;
      rig.frontSheen.style.transform = `translate3d(${(-(W - xBot)).toFixed(1)}px, 0px, 0) rotate(${theta.toFixed(5)}rad)`;
      rig.backSheen.style.transform = `translate3d(${(-xBot).toFixed(1)}px, 0px, 0) rotate(${(-theta).toFixed(5)}rad) scaleX(${sheenScale.toFixed(3)})`;
    } else {
      rig.underShadow.style.transform = `translate3d(${(-xBot).toFixed(1)}px, 0px, 0) rotate(${(-theta).toFixed(5)}rad) scaleX(${shadowScale.toFixed(3)})`;
      rig.frontSheen.style.transform = `translate3d(${(W - xBot).toFixed(1)}px, 0px, 0) rotate(${(-theta).toFixed(5)}rad)`;
      rig.backSheen.style.transform = `translate3d(${xBot.toFixed(1)}px, 0px, 0) rotate(${theta.toFixed(5)}rad) scaleX(${sheenScale.toFixed(3)})`;
    }

    rig.underShadow.style.opacity = (intensity * 0.92).toFixed(3);
    rig.frontSheen.style.opacity = (intensity * 0.85).toFixed(3);
    rig.backSheen.style.opacity = (0.18 + intensity * 0.82).toFixed(3);

    // Pure GPU contour-matched feathered shadow behind the floating curled flap (replaces heavy drop-shadow blur)
    const sideFrac = hitsRightEdge ? Math.max(0.01, (H - yRight) / H) : 1;
    const botFrac = Math.max(0.01, (W - xBot) / W);
    rig.flapShadow.style.transform = backTransform;
    rig.flapShadow.style.opacity = (intensity * 0.96).toFixed(3);
    rig.flapShadowSide.style.transform = `scaleY(${sideFrac.toFixed(4)})`;
    rig.flapShadowBot.style.transform = `scaleX(${botFrac.toFixed(4)})`;
  }

  private animateFlip(
    fromSpread: number,
    toSpread: number,
    dir: 1 | -1,
    initialProgress: number,
    existingLeaf?: HTMLElement,
    existingCurl?: NonNullable<BookEngine["dragCurl"]>,
    initialBiasY = 0
  ): void {
    this.isTurning = true;
    this.sound.pageFlip();

    const cur = this.getSpreadPages(fromSpread);
    const nxt = this.getSpreadPages(toSpread);
    const openingFromCover = !this.isMobile && fromSpread === 0 && toSpread > 0;
    const closingToCover = !this.isMobile && fromSpread > 0 && toSpread === 0;
    const isHardcover = openingFromCover || closingToCover;

    if (openingFromCover) this.shell.classList.remove("is-closed");
    if (closingToCover) this.shell.classList.add("is-closed");

    // Interior paper sheets use the realistic diagonal corner-peel curl engine!
    // Hardcover front cover retains stiff linen-board 3D hinge physics.
    if (!isHardcover && !existingLeaf) {
      let rig = existingCurl;
      if (!rig) {
        if (this.isMobile) {
          if (dir === 1) {
            const front = cur.right?.html || "";
            rig = this.createCurlRig(
              front,
              `<div class="curl-paper-back-wrap"><div class="curl-paper-bleed">${front}</div></div>`,
              false,
              false
            );
            this.rightSlot.innerHTML = nxt.right?.html || "";
          } else {
            const front = nxt.right?.html || "";
            rig = this.createCurlRig(
              front,
              `<div class="curl-paper-back-wrap"><div class="curl-paper-bleed">${front}</div></div>`,
              false,
              true
            );
          }
        } else if (dir === 1) {
          rig = this.createCurlRig(cur.right?.html || "", nxt.left?.html || "", false, false);
          this.rightSlot.innerHTML = nxt.right?.html || "";
        } else {
          rig = this.createCurlRig(cur.left?.html || "", nxt.right?.html || "", true, false);
          this.leftSlot.innerHTML = nxt.left?.html || "";
        }
      }

      const baseDuration = this.isMobile ? 640 : 760;
      const duration = Math.max(260, Math.round(baseDuration * (1 - initialProgress)));
      const startTs = performance.now();

      const frame = (now: number) => {
        const raw = Math.min(1, (now - startTs) / duration);
        const eased = this.softPaperEase(raw);
        const p = initialProgress + (1 - initialProgress) * eased;
        const curlS = rig!.reversePlay ? 1 - p : p;
        const bias = initialBiasY * (1 - eased);

        this.updateCurlRig(rig!, curlS, bias);

        if (this.ribbon) {
          const liftSine = Math.sin(p * Math.PI);
          this.ribbon.style.transform = `rotate(${(dir * liftSine * 5.2).toFixed(2)}deg)`;
        }

        if (raw < 1) {
          requestAnimationFrame(frame);
        } else {
          rig!.root.remove();
          if (this.ribbon) this.ribbon.style.transform = "";
          this.spreadIndex = toSpread;
          this.isTurning = false;
          this.renderCurrentSpread();
        }
      };

      requestAnimationFrame(frame);
      return;
    }

    // Stiff Hardcover Front-Board 3D Hinge Animation
    let leaf = existingLeaf;
    if (!leaf) {
      if (dir === 1) {
        const frontHtml = cur.right?.html || "";
        const backHtml = nxt.left?.html || "";
        leaf = this.createFlipLeaf(frontHtml, backHtml, 0, true);
        this.rightSlot.innerHTML = nxt.right?.html || "";
      } else {
        const frontHtml = nxt.right?.html || "";
        const backHtml = cur.left?.html || "";
        leaf = this.createFlipLeaf(frontHtml, backHtml, -180, true);
        this.leftSlot.innerHTML = nxt.left?.html || "";
      }
    }

    const frontShade = leaf.querySelector<HTMLElement>(".flip-face-front .flip-shade");
    const backShade = leaf.querySelector<HTMLElement>(".flip-face-back .flip-shade");
    const frontSheen = leaf.querySelector<HTMLElement>(".flip-face-front .flip-curl-sheen");
    const backSheen = leaf.querySelector<HTMLElement>(".flip-face-back .flip-curl-sheen");

    const duration = Math.max(280, Math.round(820 * (1 - initialProgress)));
    const startTs = performance.now();

    const frame = (now: number) => {
      const raw = Math.min(1, (now - startTs) / duration);
      const eased = this.softPaperEase(raw);
      const p = initialProgress + (1 - initialProgress) * eased;

      this.applyLeafPose(leaf!, frontShade, backShade, frontSheen, backSheen, dir, p, true);

      if (this.ribbon) {
        const liftSine = Math.sin(p * Math.PI);
        this.ribbon.style.transform = `rotate(${(dir * liftSine * 5.5).toFixed(2)}deg)`;
      }

      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        leaf!.remove();
        this.castLeft.style.opacity = "0";
        this.castLeft.style.transform = "";
        this.castRight.style.opacity = "0";
        this.castRight.style.transform = "";
        if (this.ribbon) this.ribbon.style.transform = "";
        this.spreadIndex = toSpread;
        this.isTurning = false;
        this.renderCurrentSpread();
      }
    };

    requestAnimationFrame(frame);
  }

  /** Smooth elastic lay-back when user releases a partial paper drag before threshold */
  private settleCancelledCurl(rig: NonNullable<BookEngine["dragCurl"]>, fromProgress: number, biasY: number): void {
    this.isTurning = true;
    const duration = Math.max(160, Math.round(280 * Math.max(0.25, fromProgress)));
    const startTs = performance.now();
    const frame = (now: number) => {
      const raw = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - raw, 3);
      const p = fromProgress * (1 - eased);
      const curlS = rig.reversePlay ? 1 - p : p;
      this.updateCurlRig(rig, curlS, biasY * (1 - eased));
      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        rig.root.remove();
        this.isTurning = false;
        this.renderCurrentSpread();
      }
    };
    requestAnimationFrame(frame);
  }

  private bindControls(): void {
    this.prevBtn.addEventListener("click", () => this.step(-1));
    this.nextBtn.addEventListener("click", () => this.step(1));
    this.modal.querySelector("[data-mobile-prev]")?.addEventListener("click", () => this.step(-1));
    this.modal.querySelector("[data-mobile-next]")?.addEventListener("click", () => this.step(1));

    // Top bar jump tabs (封面 / 目录 / 正文)
    this.modal.querySelectorAll<HTMLButtonElement>("[data-book-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.bookJump;
        if (target === "cover") this.goToSpread(0);
        else if (target === "toc") this.goToSpread(this.isMobile ? 2 : 1);
        else if (target === "read") {
          const ch0 = this.chapterStartPage[0] ?? 3;
          this.goToSpread(this.pageIndexToSpread(ch0));
        }
      });
    });

    // Font size A- / A+ controls -> dynamically re-paginates!
    this.modal.querySelector("[data-font-dec]")?.addEventListener("click", () => {
      this.fontSize = Math.max(13.5, +(this.fontSize - 1).toFixed(1));
      this.sound.clipClick();
      this.rebuild(true);
    });
    this.modal.querySelector("[data-font-inc]")?.addEventListener("click", () => {
      this.fontSize = Math.min(19.5, +(this.fontSize + 1).toFixed(1));
      this.sound.clipClick();
      this.rebuild(true);
    });

    // Share current chapter deep-link
    this.modal.querySelector("[data-copy-book-link]")?.addEventListener("click", async () => {
      this.sound.clipClick();
      const shareUrl = this.activeSlug
        ? `${window.location.origin}/posts/${this.activeSlug}`
        : `${window.location.origin}/?open=book`;
      const lbl = this.modal.querySelector<HTMLElement>("[data-copy-book-label]");
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (lbl) {
          lbl.textContent = "已复制";
          setTimeout(() => {
            lbl.textContent = "分享";
          }, 1800);
        }
      } catch {
        // ignore clipboard failure
      }
    });

    // Click right/left half of book to flip (ignoring buttons, links, drags & text selection)
    this.rightSlot.addEventListener("click", (e) => {
      if (performance.now() < this.justDraggedUntil) return;
      if ((e.target as HTMLElement).closest("button, a, #book-waline-mount")) return;
      if (window.getSelection()?.toString()) return;
      if (this.spreadIndex < this.totalSpreads() - 1) this.step(1);
    });

    this.leftSlot.addEventListener("click", (e) => {
      if (performance.now() < this.justDraggedUntil) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      if (window.getSelection()?.toString()) return;
      if (this.spreadIndex > 0) this.step(-1);
    });

    // Real-time Drag / Touch Swipe to peel flexible paper corner live under pointer!
    this.stage.addEventListener("pointerdown", (e) => {
      if (this.isTurning || this.reducedMotion) return;
      if ((e.target as HTMLElement).closest("button, a, #book-waline-mount, .toc-entry")) return;
      this.dragActive = true;
      this.dragDir = 0;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragProgress = 0;
      this.dragBiasY = 0;
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.dragActive || this.isTurning) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (this.dragDir === 0) {
        if (Math.abs(dx) < 14 || Math.abs(dy) > Math.abs(dx) * 1.35) return;
        const wantedDir: 1 | -1 = dx < 0 ? 1 : -1;
        const target = this.spreadIndex + wantedDir;
        if (target < 0 || target >= this.totalSpreads()) {
          this.dragActive = false;
          return;
        }
        this.dragDir = wantedDir;
        this.stage.classList.add("is-dragging-page");
        window.getSelection()?.removeAllRanges();
        const cur = this.getSpreadPages(this.spreadIndex);
        const nxt = this.getSpreadPages(target);
        const isHardcover = !this.isMobile && (this.spreadIndex === 0 || target === 0);

        if (isHardcover) {
          if (this.dragDir === 1) {
            this.dragLeaf = this.createFlipLeaf(cur.right?.html || "", nxt.left?.html || "", 0, true);
            this.rightSlot.innerHTML = nxt.right?.html || "";
          } else {
            this.dragLeaf = this.createFlipLeaf(nxt.right?.html || "", cur.left?.html || "", -180, true);
            this.leftSlot.innerHTML = nxt.left?.html || "";
          }
        } else if (this.isMobile) {
          if (this.dragDir === 1) {
            const front = cur.right?.html || "";
            this.dragCurl = this.createCurlRig(
              front,
              `<div class="curl-paper-back-wrap"><div class="curl-paper-bleed">${front}</div></div>`,
              false,
              false
            );
            this.rightSlot.innerHTML = nxt.right?.html || "";
          } else {
            const front = nxt.right?.html || "";
            this.dragCurl = this.createCurlRig(
              front,
              `<div class="curl-paper-back-wrap"><div class="curl-paper-bleed">${front}</div></div>`,
              false,
              true
            );
          }
        } else if (this.dragDir === 1) {
          this.dragCurl = this.createCurlRig(cur.right?.html || "", nxt.left?.html || "", false, false);
          this.rightSlot.innerHTML = nxt.right?.html || "";
        } else {
          this.dragCurl = this.createCurlRig(cur.left?.html || "", nxt.right?.html || "", true, false);
          this.leftSlot.innerHTML = nxt.left?.html || "";
        }
      }

      if (this.dragCurl && this.dragDir !== 0) {
        const span = Math.max(220, this.dragCurl.pageW * 1.48);
        this.dragProgress = Math.max(0.02, Math.min(0.96, Math.abs(dx) / span));
        this.dragBiasY = Math.max(-28, Math.min(48, -dy * 0.36));
        const curlS = this.dragCurl.reversePlay ? 1 - this.dragProgress : this.dragProgress;
        this.updateCurlRig(this.dragCurl, curlS, this.dragBiasY);
      } else if (this.dragLeaf && this.dragDir !== 0) {
        const span = Math.max(180, this.shell.clientWidth * 0.45);
        this.dragProgress = Math.max(0.02, Math.min(0.95, Math.abs(dx) / span));
        const frontShade = this.dragLeaf.querySelector<HTMLElement>(".flip-face-front .flip-shade");
        const backShade = this.dragLeaf.querySelector<HTMLElement>(".flip-face-back .flip-shade");
        const frontSheen = this.dragLeaf.querySelector<HTMLElement>(".flip-face-front .flip-curl-sheen");
        const backSheen = this.dragLeaf.querySelector<HTMLElement>(".flip-face-back .flip-curl-sheen");
        this.applyLeafPose(
          this.dragLeaf,
          frontShade,
          backShade,
          frontSheen,
          backSheen,
          this.dragDir,
          this.dragProgress,
          true
        );
      }
    });

    window.addEventListener("pointerup", () => {
      if (!this.dragActive) return;
      this.dragActive = false;
      this.stage.classList.remove("is-dragging-page");
      if ((!this.dragLeaf && !this.dragCurl) || this.dragDir === 0) return;

      const leaf = this.dragLeaf;
      const curl = this.dragCurl;
      const dir = this.dragDir;
      const p = this.dragProgress;
      const biasY = this.dragBiasY;
      this.dragLeaf = null;
      this.dragCurl = null;
      this.dragDir = 0;
      this.justDraggedUntil = performance.now() + 220;

      if (curl) {
        if (p > 0.16) {
          this.animateFlip(this.spreadIndex, this.spreadIndex + dir, dir, p, undefined, curl, biasY);
        } else {
          this.settleCancelledCurl(curl, p, biasY);
        }
      } else if (leaf) {
        if (p > 0.22) {
          this.animateFlip(this.spreadIndex, this.spreadIndex + dir, dir, p, leaf);
        } else {
          leaf.remove();
          this.castLeft.style.opacity = "0";
          this.castLeft.style.transform = "";
          this.castRight.style.opacity = "0";
          this.castRight.style.transform = "";
          this.renderCurrentSpread();
        }
      }
    });

    // Wheel page turning when book is open (avoid hijacking inner scroll containers)
    this.stage.addEventListener(
      "wheel",
      (e) => {
        if (!this.modal.classList.contains("is-open")) return;
        if ((e.target as HTMLElement).closest("#book-waline-mount, .book-end-card")) return;
        const now = performance.now();
        if (now - this.wheelLock < 420) return;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(d) > 22) {
          this.wheelLock = now;
          this.step(d > 0 ? 1 : -1);
        }
      },
      { passive: true }
    );

    // Resize re-pagination
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      if (!this.modal.classList.contains("is-open")) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => this.rebuild(true), 160);
    });
  }
}
