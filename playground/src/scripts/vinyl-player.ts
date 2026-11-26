/**
 * Hi-Fi Collector's Edition Analog Vinyl Turntable & NetEase Playlist Engine.
 * - Cardboard LP sleeve slide-out vinyl + progressive tonearm groove tracking.
 * - Living Apple-Music-style ambient album-cover backdrop aura.
 * - Dual warm-amber Analog VU Meter needles + 28-bar Harmonic Canvas Spectrum
 *   (zero-CORS multi-harmonic physics oscillator, automatically pauses when modal closed).
 * - Mechanical Hi-Fi switches: 33⅓ / 45 RPM speed + cozy analog vinyl crackle ambience.
 * - Immersive Apple-Music-style multi-line clickable synced lyrics + throttled lazy cover queue.
 */
import type { StudioSound } from "./studio-sound";

export interface VinylTrack {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
}

interface LyricLine {
  time: number;
  text: string;
}

interface MusicBootConfig {
  playlistId: string;
  playlistTitle: string;
  playlistSubtitle: string;
  neteaseProfileUrl: string;
  neteaseNickname: string;
  apiMirrors: string[];
}

type PlayMode = "list" | "shuffle" | "single";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parsePlaylistInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{5,15}$/.test(trimmed)) return trimmed;
  const match = /[?&]id=(\d{5,15})/.exec(trimmed) || /playlist\/(\d{5,15})/.exec(trimmed);
  return match ? match[1] : null;
}

function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const row of raw.split(/\r?\n/)) {
    const matches = [...row.matchAll(regex)];
    if (!matches.length) continue;
    const text = row.replace(regex, "").trim();
    if (!text) continue;
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) / 1000 : 0;
      lines.push({ time: min * 60 + sec + frac, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export class VinylPlayerEngine {
  private modal: HTMLElement;
  private sound: StudioSound;
  private config: MusicBootConfig;
  private audio: HTMLAudioElement;

  private playlistId = "";
  private tracks: VinylTrack[] = [];
  private currentIdx = 0;
  private isPlaying = false;
  private playMode: PlayMode = "list";
  private rpm45 = false;
  private crackleOn = false;
  private consecutiveErrors = 0;
  private lyrics: LyricLine[] = [];
  private activeLyricIdx = -1;
  private usingIframeFallback = false;
  private loadingPromise: Promise<void> | null = null;
  private thumbObserver: IntersectionObserver | null = null;
  private thumbQueue: HTMLImageElement[] = [];
  private thumbActiveCount = 0;

  // Hi-Fi VU meter + Harmonic spectrum canvas loop (runs ONLY while modal is open!)
  private meterRaf = 0;
  private vuLeft = -42;
  private vuRight = -42;
  private specBars = new Float32Array(28);
  private eqCanvas: HTMLCanvasElement | null = null;
  private eqCtx: CanvasRenderingContext2D | null = null;
  private vuNeedleL: HTMLElement | null = null;
  private vuNeedleR: HTMLElement | null = null;
  private tonearmEl: HTMLElement | null = null;

  private static readonly FALLBACK_COVER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23201d1a'/%3E%3Ccircle cx='40' cy='40' r='30' fill='%23141312' stroke='%23332e29' stroke-width='2'/%3E%3Ccircle cx='40' cy='40' r='12' fill='%23c84b31'/%3E%3Ccircle cx='40' cy='40' r='3' fill='%23f5f3ee'/%3E%3C/svg%3E";

  // Cached DOM refs
  private topBtn: HTMLElement | null;
  private topLabel: HTMLElement | null;
  private hangCard: HTMLElement | null;
  private miniCovers: HTMLImageElement[] = [];
  private miniTitle: HTMLElement | null;
  private miniSub: HTMLElement | null;
  private miniPlayBtn: HTMLButtonElement | null;

  private platter: HTMLElement | null;
  private coverImgs: HTMLImageElement[] = [];
  private auraImg: HTMLImageElement | null;
  private trackTitleEl: HTMLElement | null;
  private trackArtistEl: HTMLElement | null;
  private lyricCurEl: HTMLElement | null;
  private lyricNextEl: HTMLElement | null;
  private lyricFullListEl: HTMLElement | null;
  private statusNoteEl: HTMLElement | null;
  private playBtn: HTMLButtonElement | null;
  private modeBtn: HTMLButtonElement | null;
  private rpmBtn: HTMLButtonElement | null;
  private crackleBtn: HTMLButtonElement | null;
  private rpmTextEl: HTMLElement | null;
  private curTimeEl: HTMLElement | null;
  private durTimeEl: HTMLElement | null;
  private progressBar: HTMLInputElement | null;
  private volumeBar: HTMLInputElement | null;
  private trackListEl: HTMLElement | null;
  private trackCountEl: HTMLElement | null;
  private playlistLinkEl: HTMLAnchorElement | null;
  private iframeBoxEl: HTMLElement | null;
  private switchBoxEl: HTMLElement | null;
  private switchInputEl: HTMLInputElement | null;

  constructor(modal: HTMLElement, sound: StudioSound) {
    this.modal = modal;
    this.sound = sound;
    this.audio = new Audio();
    this.audio.preload = "none";

    const dataEl = document.getElementById("studio-music-config");
    this.config = dataEl?.textContent
      ? JSON.parse(dataEl.textContent)
      : {
          playlistId: "2362187252",
          playlistTitle: "CHENHUI · 日常留声",
          playlistSubtitle: "骑车吹风、深夜读书、发呆时循环的歌",
          neteaseProfileUrl: "https://music.163.com/#/user/home?id=530882324",
          neteaseNickname: "CHENHUI",
          apiMirrors: [
            "https://api.injahow.cn/meting/?server=netease&type=playlist&id={id}",
            "https://api.qijieya.cn/meting/?server=netease&type=playlist&id={id}",
          ],
        };

    this.playlistId = this.config.playlistId;
    try {
      const savedId = localStorage.getItem("studio-netease-playlist-id");
      if (savedId && /^\d{5,15}$/.test(savedId) && savedId !== "2829883282") {
        this.playlistId = savedId;
      }
      const savedVol = localStorage.getItem("studio-bgm-vol");
      if (savedVol && Number.isFinite(Number(savedVol))) {
        this.audio.volume = Math.max(0, Math.min(1, Number(savedVol)));
      } else {
        this.audio.volume = 0.65;
      }
    } catch {
      this.audio.volume = 0.65;
    }

    // Grab DOM elements (hanging LP sleeve artifact + modal)
    this.topBtn = document.getElementById("btn-vinyl");
    this.topLabel = this.topBtn?.querySelector<HTMLElement>(".ctrl-label") || null;
    this.hangCard = document.getElementById("hang-vinyl-card");
    this.miniCovers = Array.from(document.querySelectorAll<HTMLImageElement>("[data-mini-cover]"));
    this.miniTitle = document.querySelector<HTMLElement>("[data-mini-title]");
    this.miniSub = document.querySelector<HTMLElement>("[data-mini-sub]");
    this.miniPlayBtn = document.querySelector<HTMLButtonElement>("[data-mini-toggle]");

    this.platter = modal.querySelector<HTMLElement>("[data-vinyl-deck]");
    this.coverImgs = Array.from(modal.querySelectorAll<HTMLImageElement>("[data-vinyl-cover]"));
    this.auraImg = modal.querySelector<HTMLImageElement>("[data-vinyl-aura]");
    this.tonearmEl = modal.querySelector<HTMLElement>(".vinyl-tonearm");
    this.vuNeedleL = modal.querySelector<HTMLElement>("[data-vu-left]");
    this.vuNeedleR = modal.querySelector<HTMLElement>("[data-vu-right]");
    this.eqCanvas = modal.querySelector<HTMLCanvasElement>("#vinyl-eq-canvas");
    this.eqCtx = this.eqCanvas?.getContext("2d") || null;

    this.trackTitleEl = modal.querySelector<HTMLElement>("[data-vinyl-title]");
    this.trackArtistEl = modal.querySelector<HTMLElement>("[data-vinyl-artist]");
    this.lyricCurEl = modal.querySelector<HTMLElement>("[data-lyric-cur]");
    this.lyricNextEl = modal.querySelector<HTMLElement>("[data-lyric-next]");
    this.lyricFullListEl = modal.querySelector<HTMLElement>("[data-lyrics-stage]");
    this.statusNoteEl = modal.querySelector<HTMLElement>("[data-vinyl-status]");
    this.playBtn = modal.querySelector<HTMLButtonElement>("[data-vinyl-play]");
    this.modeBtn = modal.querySelector<HTMLButtonElement>("[data-vinyl-mode]");
    this.rpmBtn = modal.querySelector<HTMLButtonElement>("[data-vinyl-rpm]");
    this.crackleBtn = modal.querySelector<HTMLButtonElement>("[data-vinyl-crackle]");
    this.rpmTextEl = modal.querySelector<HTMLElement>("[data-rpm-readout]");
    this.curTimeEl = modal.querySelector<HTMLElement>("[data-vinyl-cur]");
    this.durTimeEl = modal.querySelector<HTMLElement>("[data-vinyl-dur]");
    this.progressBar = modal.querySelector<HTMLInputElement>("[data-vinyl-progress]");
    this.volumeBar = modal.querySelector<HTMLInputElement>("[data-vinyl-volume]");
    this.trackListEl = modal.querySelector<HTMLElement>("[data-vinyl-list]");
    this.trackCountEl = modal.querySelector<HTMLElement>("[data-vinyl-count]");
    this.playlistLinkEl = modal.querySelector<HTMLAnchorElement>("[data-netease-playlist-link]");
    this.iframeBoxEl = modal.querySelector<HTMLElement>("[data-vinyl-iframe-box]");
    this.switchBoxEl = modal.querySelector<HTMLElement>("[data-playlist-switch-box]");
    this.switchInputEl = modal.querySelector<HTMLInputElement>("[data-playlist-switch-input]");

    if (this.volumeBar) {
      this.volumeBar.value = String(Math.round(this.audio.volume * 100));
    }

    this.bindAudioEvents();
    this.bindUiEvents();
    this.syncMiniDockVisibility();

    // Idle warm-load playlist so Corner Vintage Mini Turntable displays real cover & title immediately
    window.setTimeout(() => {
      if (this.tracks.length === 0 && !this.loadingPromise) {
        this.loadPlaylist(this.playlistId);
      }
    }, 900);
  }

  public ensureLoaded(): void {
    if (this.tracks.length === 0 && !this.usingIframeFallback && !this.loadingPromise) {
      this.loadPlaylist(this.playlistId);
    }
    this.syncMiniDockVisibility();
    this.startMeterLoop();
  }

  public syncMiniDockVisibility(): void {
    if (!this.modal.classList.contains("is-open")) {
      this.stopMeterLoop();
    } else {
      this.startMeterLoop();
    }
  }

  private startMeterLoop(): void {
    if (this.meterRaf) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const draw = (now: number) => {
      if (!this.modal.classList.contains("is-open")) {
        this.meterRaf = 0;
        return;
      }
      this.meterRaf = requestAnimationFrame(draw);

      const t = now * 0.001;
      const volScale = 0.35 + this.audio.volume * 0.65;

      // 1. Dual Warm-Amber Analog VU Needles (smooth analog ballistic inertia)
      let targetL = -42;
      let targetR = -42;
      if (this.isPlaying) {
        const beat = Math.pow(0.5 + 0.5 * Math.sin(t * 6.4), 1.8);
        const swell = 0.5 + 0.5 * Math.sin(t * 1.9 + 0.6);
        const flutterL = Math.sin(t * 17.3) * 6 + Math.cos(t * 11.1) * 4;
        const flutterR = Math.cos(t * 15.7) * 6 + Math.sin(t * 12.9) * 4;
        targetL = -34 + (beat * 34 + swell * 24 + flutterL) * volScale;
        targetR = -34 + (beat * 31 + swell * 26 + flutterR) * volScale;
        targetL = Math.max(-42, Math.min(34, targetL));
        targetR = Math.max(-42, Math.min(34, targetR));
      }

      this.vuLeft += (targetL - this.vuLeft) * (this.isPlaying ? 0.24 : 0.12);
      this.vuRight += (targetR - this.vuRight) * (this.isPlaying ? 0.24 : 0.12);

      if (this.vuNeedleL) this.vuNeedleL.style.transform = `rotate(${this.vuLeft.toFixed(1)}deg)`;
      if (this.vuNeedleR) this.vuNeedleR.style.transform = `rotate(${this.vuRight.toFixed(1)}deg)`;

      // 2. 28-Bar Harmonic Spectrum Canvas
      if (this.eqCanvas && this.eqCtx) {
        const w = this.eqCanvas.width;
        const h = this.eqCanvas.height;
        const ctx = this.eqCtx;
        ctx.clearRect(0, 0, w, h);

        const count = this.specBars.length;
        const gap = 3;
        const barW = (w - gap * (count - 1)) / count;
        const isDark = document.documentElement.classList.contains("dark");
        const accentColor = isDark ? "#e56a52" : "#c84b31";
        const goldColor = isDark ? "rgba(235, 217, 189, 0.55)" : "rgba(140, 114, 78, 0.48)";

        for (let i = 0; i < count; i++) {
          const u = i / (count - 1);
          const bell = Math.sin(u * Math.PI);
          let target = 0.08;
          if (this.isPlaying) {
            const wave1 = 0.5 + 0.5 * Math.sin(t * 5.2 + i * 0.45);
            const wave2 = 0.5 + 0.5 * Math.cos(t * 9.6 - i * 0.62);
            const pulse = 0.5 + 0.5 * Math.sin(t * 3.1 + u * 4.2);
            target = (0.16 + (wave1 * 0.42 + wave2 * 0.28 + pulse * 0.22) * (0.45 + bell * 0.72)) * volScale;
          }
          this.specBars[i] += (target - this.specBars[i]) * (this.isPlaying ? 0.22 : 0.12);
          const bh = Math.max(3, this.specBars[i] * (h - 4));
          const x = i * (barW + gap);
          const y = h - bh;
          ctx.fillStyle = this.specBars[i] > 0.56 ? accentColor : goldColor;
          ctx.beginPath();
          ctx.roundRect(x, y, barW, bh, 2);
          ctx.fill();
        }
      }
    };

    this.meterRaf = requestAnimationFrame(draw);
  }

  private stopMeterLoop(): void {
    if (this.meterRaf) {
      cancelAnimationFrame(this.meterRaf);
      this.meterRaf = 0;
    }
  }

  private setStatus(msg: string, isWarn = false): void {
    if (!this.statusNoteEl) return;
    this.statusNoteEl.textContent = msg;
    this.statusNoteEl.classList.toggle("is-warn", isWarn);
    this.statusNoteEl.classList.toggle("is-shown", Boolean(msg));
  }

  private async fetchWithTimeout(url: string, ms = 5500): Promise<Response> {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { signal: ctrl.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  public async loadPlaylist(id: string): Promise<void> {
    this.playlistId = id;
    const run = async () => {
      if (this.playlistLinkEl) {
        this.playlistLinkEl.href = `https://music.163.com/#/playlist?id=${encodeURIComponent(id)}`;
      }
      if (this.trackListEl) {
        this.trackListEl.innerHTML = `
          <div class="vinyl-loading">
            <span class="vinyl-spinner" aria-hidden="true"></span>
            <span>正在载入歌单…</span>
          </div>
        `;
      }
      this.setStatus("");
      this.hideIframeFallback();

      for (const tpl of this.config.apiMirrors) {
        const apiUrl = tpl.replace("{id}", encodeURIComponent(id));
        try {
          const res = await this.fetchWithTimeout(apiUrl, 5500);
          if (!res.ok) continue;
          const json = await res.json();
          if (!Array.isArray(json) || json.length === 0) continue;

          const parsed: VinylTrack[] = json
            .map((item: Record<string, string>) => ({
              name: (item.name || item.title || "未知曲目").trim(),
              artist: (item.artist || item.author || "未知歌手").trim(),
              url: item.url || "",
              pic: item.pic || "",
              lrc: item.lrc || "",
            }))
            .filter((t) => Boolean(t.url));

          if (parsed.length === 0) continue;

          this.tracks = parsed;
          this.currentIdx = 0;
          this.consecutiveErrors = 0;
          if (this.trackCountEl) {
            this.trackCountEl.textContent = `共 ${parsed.length} 首`;
          }
          this.renderTrackList();
          this.selectTrack(0, false);
          return;
        } catch {
          // try next mirror
        }
      }

      if (this.trackListEl) {
        this.trackListEl.innerHTML = `
          <div class="vinyl-empty">
            <p>歌单暂时加载缓慢，可以稍后重试或切换网易云原版收听。</p>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
              <button type="button" class="box lbl" data-retry-playlist>重试加载</button>
              <button type="button" class="box lbl" data-open-iframe>网易云原版</button>
            </div>
          </div>
        `;
        this.trackListEl.querySelector("[data-retry-playlist]")?.addEventListener("click", () => this.loadPlaylist(id));
        this.trackListEl.querySelector("[data-open-iframe]")?.addEventListener("click", () => this.showIframeFallback());
      }
    };

    this.loadingPromise = run().finally(() => {
      this.loadingPromise = null;
    });
    return this.loadingPromise;
  }

  private pumpThumbQueue(): void {
    const MAX_CONCURRENT = 2;
    while (this.thumbActiveCount < MAX_CONCURRENT && this.thumbQueue.length > 0) {
      const img = this.thumbQueue.shift()!;
      const realSrc = img.dataset.pic;
      if (!realSrc) continue;
      delete img.dataset.pic;
      this.thumbActiveCount++;
      const done = () => {
        this.thumbActiveCount = Math.max(0, this.thumbActiveCount - 1);
        window.setTimeout(() => this.pumpThumbQueue(), 90);
      };
      img.onload = done;
      img.onerror = () => {
        img.src = VinylPlayerEngine.FALLBACK_COVER;
        done();
      };
      img.src = realSrc;
    }
  }

  private renderTrackList(): void {
    if (!this.trackListEl) return;
    this.thumbObserver?.disconnect();
    this.thumbQueue = [];
    this.thumbActiveCount = 0;

    this.trackListEl.innerHTML = this.tracks
      .map(
        (t, idx) => `
        <button type="button" class="track-row ${idx === this.currentIdx ? "is-active" : ""}" data-track-idx="${idx}">
          <span class="track-num lbl">${String(idx + 1).padStart(2, "0")}</span>
          <img class="track-thumb" src="${VinylPlayerEngine.FALLBACK_COVER}" data-pic="${escapeHtml(t.pic)}" alt="" width="38" height="38" />
          <div class="track-meta">
            <span class="track-name">${escapeHtml(t.name)}</span>
            <span class="track-artist">${escapeHtml(t.artist)}</span>
          </div>
          <span class="track-eq" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
      `
      )
      .join("");

    const imgs = Array.from(this.trackListEl.querySelectorAll<HTMLImageElement>("img[data-pic]"));
    if ("IntersectionObserver" in window) {
      this.thumbObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              this.thumbObserver?.unobserve(img);
              this.thumbQueue.push(img);
            }
          }
          this.pumpThumbQueue();
        },
        { root: this.trackListEl, rootMargin: "120px" }
      );
      imgs.forEach((img) => this.thumbObserver!.observe(img));
    } else {
      imgs.slice(0, 12).forEach((img) => this.thumbQueue.push(img));
      this.pumpThumbQueue();
    }

    this.trackListEl.querySelectorAll<HTMLButtonElement>("[data-track-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.trackIdx || "0");
        if (idx === this.currentIdx && this.audio.src) {
          this.togglePlay();
        } else {
          this.selectTrack(idx, true);
        }
      });
    });
  }

  private renderImmersiveLyrics(): void {
    if (!this.lyricFullListEl) return;
    if (!this.lyrics.length) {
      this.lyricFullListEl.innerHTML = `<div class="lyrics-empty">暂无同步歌词，安心听旋律就好。</div>`;
      return;
    }
    this.lyricFullListEl.innerHTML = this.lyrics
      .map(
        (line, idx) => `
        <button type="button" class="lrc-line ${idx === this.activeLyricIdx ? "is-current" : ""}" data-lrc-idx="${idx}" data-lrc-time="${line.time.toFixed(2)}">
          ${escapeHtml(line.text)}
        </button>
      `
      )
      .join("");

    this.lyricFullListEl.querySelectorAll<HTMLButtonElement>("[data-lrc-time]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = Number(btn.dataset.lrcTime || "0");
        if (Number.isFinite(sec)) {
          this.audio.currentTime = sec;
          if (!this.isPlaying) this.play();
        }
      });
    });
  }

  private highlightActiveRow(): void {
    if (!this.trackListEl) return;
    const rows = this.trackListEl.querySelectorAll<HTMLElement>(".track-row");
    rows.forEach((row, i) => {
      const active = i === this.currentIdx;
      row.classList.toggle("is-active", active);
      row.classList.toggle("is-playing", active && this.isPlaying);
    });
  }

  public selectTrack(idx: number, autoPlay: boolean): void {
    if (!this.tracks.length) return;
    this.currentIdx = ((idx % this.tracks.length) + this.tracks.length) % this.tracks.length;
    const track = this.tracks[this.currentIdx];

    if (this.trackTitleEl) this.trackTitleEl.textContent = track.name;
    if (this.trackArtistEl) this.trackArtistEl.textContent = track.artist;
    if (track.pic) {
      this.coverImgs.forEach((img) => (img.src = track.pic));
      if (this.auraImg) this.auraImg.src = track.pic;
    }
    if (this.miniTitle) this.miniTitle.textContent = track.name;
    if (this.miniSub) this.miniSub.textContent = track.artist;
    if (this.progressBar) this.progressBar.value = "0";
    if (this.curTimeEl) this.curTimeEl.textContent = "00:00";
    if (this.durTimeEl) this.durTimeEl.textContent = "00:00";

    this.lyrics = [];
    this.activeLyricIdx = -1;
    if (this.lyricCurEl) this.lyricCurEl.textContent = track.name;
    if (this.lyricNextEl) this.lyricNextEl.textContent = track.artist;
    if (this.lyricFullListEl) {
      this.lyricFullListEl.innerHTML = `<div class="lyrics-empty">歌词载入中…</div>`;
    }

    this.audio.src = track.url;
    this.audio.playbackRate = this.rpm45 ? 1.12 : 1.0;
    this.audio.load();
    this.highlightActiveRow();
    this.updateTonearmAngle(0);

    if (track.lrc) {
      this.loadLyrics(track.lrc, this.currentIdx);
    } else {
      this.renderImmersiveLyrics();
    }

    if (autoPlay) {
      this.play();
    } else {
      this.syncPlayUi();
    }
  }

  private async loadLyrics(lrcUrl: string, trackIndex: number): Promise<void> {
    try {
      const res = await this.fetchWithTimeout(lrcUrl, 4500);
      if (!res.ok || trackIndex !== this.currentIdx) return;
      const text = await res.text();
      if (trackIndex !== this.currentIdx) return;
      this.lyrics = parseLrc(text);
      if (this.lyrics.length > 0 && this.lyricCurEl && this.lyricNextEl) {
        this.lyricCurEl.textContent = this.lyrics[0].text;
        this.lyricNextEl.textContent = this.lyrics[1]?.text || "";
      }
      this.renderImmersiveLyrics();
    } catch {
      this.renderImmersiveLyrics();
    }
  }

  /** Smoothly tracks the brass tonearm inward from outer groove -> inner groove as song plays */
  private updateTonearmAngle(progress01: number): void {
    if (!this.tonearmEl) return;
    if (!this.isPlaying) {
      this.tonearmEl.style.removeProperty("--arm-angle");
      return;
    }
    const clamped = Math.max(0, Math.min(1, progress01));
    const deg = 14 + clamped * 13; // 14deg outer edge -> 27deg inner label
    this.tonearmEl.style.setProperty("--arm-angle", `${deg.toFixed(2)}deg`);
  }

  public async play(): Promise<void> {
    if (this.usingIframeFallback) return;
    if (this.loadingPromise) await this.loadingPromise;
    if (!this.tracks.length) {
      await this.loadPlaylist(this.playlistId);
      if (!this.tracks.length) return;
    }
    if (!this.audio.src) {
      this.selectTrack(this.currentIdx, false);
    }
    if (!this.isPlaying) {
      this.sound.vinylNeedleDrop();
    }
    try {
      this.audio.playbackRate = this.rpm45 ? 1.12 : 1.0;
      await this.audio.play();
      this.isPlaying = true;
      this.consecutiveErrors = 0;
      this.setStatus("");
      if (this.crackleOn) this.sound.setVinylAmbience(true);
      this.syncPlayUi();
      this.syncMiniDockVisibility();
    } catch {
      this.isPlaying = false;
      this.syncPlayUi();
      this.setStatus("请再点一次播放键以解锁浏览器音频权限", false);
    }
  }

  public pause(): void {
    this.audio.pause();
    this.isPlaying = false;
    this.sound.setVinylAmbience(false);
    this.sound.clipClick();
    this.syncPlayUi();
  }

  public togglePlay(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  public next(fromError = false): void {
    if (!this.tracks.length) return;
    if (this.playMode === "shuffle" && this.tracks.length > 1) {
      let nextIdx = this.currentIdx;
      while (nextIdx === this.currentIdx) {
        nextIdx = Math.floor(Math.random() * this.tracks.length);
      }
      this.selectTrack(nextIdx, true);
    } else if (this.playMode === "single" && !fromError) {
      this.audio.currentTime = 0;
      this.play();
    } else {
      this.selectTrack(this.currentIdx + 1, true);
    }
  }

  public prev(): void {
    if (!this.tracks.length) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    this.selectTrack(this.currentIdx - 1, true);
  }

  private syncPlayUi(): void {
    const track = this.tracks[this.currentIdx];
    this.platter?.classList.toggle("is-playing", this.isPlaying);
    this.platter?.classList.toggle("is-rpm45", this.rpm45);
    this.modal.classList.toggle("is-playing", this.isPlaying);
    this.topBtn?.classList.toggle("is-playing", this.isPlaying);
    this.topBtn?.setAttribute("aria-pressed", String(this.isPlaying));
    this.hangCard?.classList.toggle("is-playing", this.isPlaying);
    document.querySelectorAll<HTMLElement>(".book-vinyl-btn").forEach((b) => {
      b.classList.toggle("is-playing", this.isPlaying);
    });

    const dur = this.audio.duration || 0;
    this.updateTonearmAngle(dur > 0 ? this.audio.currentTime / dur : 0);

    if (this.topLabel) {
      if (this.isPlaying && track) {
        this.topLabel.textContent = track.name.length > 8 ? `${track.name.slice(0, 8)}…` : track.name;
      } else {
        this.topLabel.textContent = "唱片机";
      }
    }

    const playSvg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.8L13 8l-8.5 5.2V2.8z"/></svg>`;
    const pauseSvg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.5" y="2.8" width="3.2" height="10.4" rx="0.8"/><rect x="9.3" y="2.8" width="3.2" height="10.4" rx="0.8"/></svg>`;
    if (this.playBtn) {
      this.playBtn.innerHTML = this.isPlaying ? pauseSvg : playSvg;
      this.playBtn.setAttribute("aria-label", this.isPlaying ? "暂停播放" : "开始播放");
    }
    if (this.miniPlayBtn) {
      this.miniPlayBtn.innerHTML = this.isPlaying ? pauseSvg : playSvg;
      this.miniPlayBtn.setAttribute("aria-label", this.isPlaying ? "暂停播放" : "继续播放");
    }
    this.highlightActiveRow();
  }

  private showIframeFallback(): void {
    this.pause();
    this.usingIframeFallback = true;
    if (this.iframeBoxEl) {
      this.iframeBoxEl.innerHTML = `
        <iframe
          frameborder="no"
          border="0"
          marginwidth="0"
          marginheight="0"
          width="100%"
          height="420"
          src="https://music.163.com/outchain/player?type=0&id=${encodeURIComponent(this.playlistId)}&auto=0&height=430"
          title="网易云音乐官方歌单播放器"
        ></iframe>
      `;
      this.iframeBoxEl.classList.add("is-open");
    }
    this.syncMiniDockVisibility();
  }

  private hideIframeFallback(): void {
    this.usingIframeFallback = false;
    if (this.iframeBoxEl) {
      this.iframeBoxEl.innerHTML = "";
      this.iframeBoxEl.classList.remove("is-open");
    }
  }

  private bindAudioEvents(): void {
    this.audio.addEventListener("loadedmetadata", () => {
      if (this.durTimeEl) this.durTimeEl.textContent = formatTime(this.audio.duration);
    });

    this.audio.addEventListener("timeupdate", () => {
      const cur = this.audio.currentTime;
      const dur = this.audio.duration || 0;
      if (this.curTimeEl) this.curTimeEl.textContent = formatTime(cur);
      if (this.progressBar && dur > 0) {
        const ratio = cur / dur;
        this.progressBar.value = String(Math.round(ratio * 1000));
        this.progressBar.style.setProperty("--prog", `${(ratio * 100).toFixed(1)}%`);
        this.updateTonearmAngle(ratio);
      }

      if (this.lyrics.length > 0) {
        let found = -1;
        for (let i = 0; i < this.lyrics.length; i++) {
          if (cur >= this.lyrics[i].time) found = i;
          else break;
        }
        if (found !== this.activeLyricIdx && found >= 0) {
          this.activeLyricIdx = found;
          if (this.lyricCurEl) this.lyricCurEl.textContent = this.lyrics[found].text;
          if (this.lyricNextEl) this.lyricNextEl.textContent = this.lyrics[found + 1]?.text || "";
          if (this.miniSub && this.isPlaying) {
            this.miniSub.textContent = this.lyrics[found].text;
          }
          // Highlight and smoothly center active line inside Immersive Lyrics view
          if (this.lyricFullListEl) {
            const rows = this.lyricFullListEl.querySelectorAll<HTMLElement>(".lrc-line");
            rows.forEach((el, idx) => el.classList.toggle("is-current", idx === found));
            const activeEl = rows[found];
            if (activeEl && this.lyricFullListEl.offsetParent) {
              activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }
      }
    });

    this.audio.addEventListener("ended", () => this.next(false));

    this.audio.addEventListener("pause", () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.sound.setVinylAmbience(false);
        this.syncPlayUi();
      }
    });

    this.audio.addEventListener("play", () => {
      if (!this.isPlaying) {
        this.isPlaying = true;
        if (this.crackleOn) this.sound.setVinylAmbience(true);
        this.syncPlayUi();
      }
    });

    this.audio.addEventListener("error", () => {
      if (!this.audio.src || this.usingIframeFallback) return;
      this.consecutiveErrors++;
      if (this.consecutiveErrors <= Math.min(5, this.tracks.length)) {
        this.setStatus("当前曲目受版权/VIP 限制，已自动切至下一首 · 可去网易云听完整版 ↗", true);
        window.setTimeout(() => this.next(true), 650);
      } else {
        this.isPlaying = false;
        this.sound.setVinylAmbience(false);
        this.syncPlayUi();
        this.setStatus("多首曲目受版权限制，可切换网易云官方播放器或去网易云主页收听 ↗", true);
      }
    });
  }

  private bindUiEvents(): void {
    this.playBtn?.addEventListener("click", () => this.togglePlay());
    this.modal.querySelector("[data-vinyl-disc-btn]")?.addEventListener("click", () => this.togglePlay());
    this.modal.querySelector("[data-vinyl-prev]")?.addEventListener("click", () => {
      this.sound.clipClick();
      this.prev();
    });
    this.modal.querySelector("[data-vinyl-next]")?.addEventListener("click", () => {
      this.sound.clipClick();
      this.next(false);
    });

    this.modeBtn?.addEventListener("click", () => {
      this.sound.clipClick();
      const order: PlayMode[] = ["list", "shuffle", "single"];
      const next = order[(order.indexOf(this.playMode) + 1) % order.length];
      this.playMode = next;
      const labels: Record<PlayMode, string> = { list: "顺序", shuffle: "随机", single: "单曲" };
      if (this.modeBtn) this.modeBtn.textContent = labels[next];
    });

    // Mechanical 33⅓ / 45 RPM speed toggle
    this.rpmBtn?.addEventListener("click", () => {
      this.rpm45 = !this.rpm45;
      this.sound.clipClick();
      this.audio.playbackRate = this.rpm45 ? 1.12 : 1.0;
      this.rpmBtn?.setAttribute("aria-pressed", String(this.rpm45));
      if (this.rpmBtn) this.rpmBtn.textContent = this.rpm45 ? "45 RPM" : "33⅓ RPM";
      if (this.rpmTextEl) this.rpmTextEl.textContent = this.rpm45 ? "45 RPM · HI-FI" : "33⅓ RPM · HI-FI";
      this.platter?.classList.toggle("is-rpm45", this.rpm45);
    });

    // Analog vinyl surface crackle toggle
    this.crackleBtn?.addEventListener("click", () => {
      this.crackleOn = !this.crackleOn;
      this.sound.clipClick();
      this.crackleBtn?.setAttribute("aria-pressed", String(this.crackleOn));
      this.sound.setVinylAmbience(this.crackleOn && this.isPlaying);
    });

    // Right panel Tracklist <-> Immersive Lyrics tabs
    const panelTabs = this.modal.querySelectorAll<HTMLButtonElement>("[data-vinyl-tab]");
    const trackPane = this.modal.querySelector<HTMLElement>("[data-vinyl-pane='list']");
    const lyricPane = this.modal.querySelector<HTMLElement>("[data-vinyl-pane='lyrics']");
    panelTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.sound.clipClick();
        const target = btn.dataset.vinylTab;
        panelTabs.forEach((b) => b.classList.toggle("is-active", b === btn));
        trackPane?.classList.toggle("is-hidden", target !== "list");
        lyricPane?.classList.toggle("is-hidden", target !== "lyrics");
      });
    });

    this.progressBar?.addEventListener("input", () => {
      const dur = this.audio.duration;
      if (Number.isFinite(dur) && dur > 0 && this.progressBar) {
        const ratio = Number(this.progressBar.value) / 1000;
        this.audio.currentTime = ratio * dur;
        this.progressBar.style.setProperty("--prog", `${(ratio * 100).toFixed(1)}%`);
        this.updateTonearmAngle(ratio);
      }
    });

    this.volumeBar?.addEventListener("input", () => {
      if (!this.volumeBar) return;
      const v = Number(this.volumeBar.value) / 100;
      this.audio.volume = Math.max(0, Math.min(1, v));
      try {
        localStorage.setItem("studio-bgm-vol", String(this.audio.volume));
      } catch {
        // ignore
      }
    });

    // Hanging LP sleeve direct Play/Pause toggle button
    this.miniPlayBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePlay();
    });

    // Custom NetEase playlist switcher
    this.modal.querySelector("[data-toggle-playlist-switch]")?.addEventListener("click", () => {
      this.sound.clipClick();
      this.switchBoxEl?.classList.toggle("is-open");
      if (this.switchBoxEl?.classList.contains("is-open")) {
        this.switchInputEl?.focus();
      }
    });

    const applySwitch = () => {
      if (!this.switchInputEl) return;
      const parsed = parsePlaylistInput(this.switchInputEl.value);
      if (!parsed) {
        this.setStatus("没识别到有效歌单，请粘贴网易云歌单链接或编号", true);
        return;
      }
      this.sound.clipClick();
      try {
        localStorage.setItem("studio-netease-playlist-id", parsed);
      } catch {
        // ignore
      }
      this.switchBoxEl?.classList.remove("is-open");
      this.switchInputEl.value = "";
      this.loadPlaylist(parsed);
    };

    this.modal.querySelector("[data-apply-playlist-switch]")?.addEventListener("click", applySwitch);
    this.switchInputEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applySwitch();
      }
    });

    this.modal.querySelector("[data-reset-playlist]")?.addEventListener("click", () => {
      this.sound.clipClick();
      try {
        localStorage.removeItem("studio-netease-playlist-id");
      } catch {
        // ignore
      }
      this.switchBoxEl?.classList.remove("is-open");
      this.loadPlaylist(this.config.playlistId);
    });

    this.modal.querySelector("[data-toggle-iframe-mode]")?.addEventListener("click", (e) => {
      this.sound.clipClick();
      const btn = e.currentTarget as HTMLButtonElement;
      if (this.usingIframeFallback) {
        this.hideIframeFallback();
        btn.innerHTML = `<span><span class="hide-xs">网易云</span>原版</span>`;
      } else {
        this.showIframeFallback();
        btn.textContent = "返回唱机";
      }
    });
  }
}
