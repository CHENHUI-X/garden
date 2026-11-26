/**
 * High-performance Canvas-rendered Verlet Physics Clothesline Engine.
 * - Zero SVG DOM mutations & zero CSS filter:blur per frame.
 * - Driven by a single unified rAF loop from studio-main.ts.
 * - Renders sunlit dust motes + rope cast shadow + braided linen rope + brass anchors
 *   in a single lightweight <canvas> pass (< 0.4ms/frame).
 * - Zero getBoundingClientRect() during pointermove (eliminates layout thrashing).
 */
import type { StudioSound } from "./studio-sound";

interface RopeNode {
  x: number;
  y: number;
  ox: number;
  oy: number;
  pinned: boolean;
  mass: number;
}

interface RopeLine {
  nodes: RopeNode[];
  segLen: number;
}

interface HangingItem {
  el: HTMLElement;
  innerEl: HTMLElement;
  sheenEl: HTMLElement | null;
  action: string;
  desktopNode: number;
  mobileRope: number;
  mobileNode: number;
  baseTilt: number;
  angle: number;
  angVel: number;
  lastAnchorX: number;
  weight: number;
  hovered: boolean;
  // Cached hover box & smooth tilt targets (applied in rAF, never inside pointermove)
  cachedLeft: number;
  cachedTop: number;
  cachedW: number;
  cachedH: number;
  tiltRx: number;
  tiltRy: number;
  targetRx: number;
  targetRy: number;
  sheenX: number;
  sheenY: number;
  tiltDirty: boolean;
  dispX: number;
  dispY: number;
  lastTx: number;
  lastTy: number;
  lastDeg: number;
}

interface DustMote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface ClotheslineCallbacks {
  onOpenArtifact: (action: string, sourceEl: HTMLElement) => void;
  onCursorState?: (state: "default" | "rope" | "open" | "book" | "btn", labelTop?: string, labelSub?: string) => void;
  onFirstInteract?: () => void;
}

const SEGMENTS = 30;

export class ClotheslineEngine {
  private stage: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sound: StudioSound;
  private cb: ClotheslineCallbacks;
  private ropes: RopeLine[] = [];
  private items: HangingItem[] = [];
  private motes: DustMote[] = [];
  private reducedMotion = false;
  private isMobile = false;
  private width = 1440;
  private height = 900;
  private dpr = 1;
  private time = 0;
  private isDark = false;

  // Pointer & drag state
  private px = -999;
  private py = -999;
  private prevPx = -999;
  private prevPy = -999;
  private dragRopeIdx = -1;
  private dragNodeIdx = -1;
  private dragStartX = 0;
  private dragStartY = 0;
  private draggedDist = 0;
  private suppressClickUntil = 0;
  private activeHanger: HangingItem | null = null;
  private lastPluckTime = 0;
  private paused = false;
  private resizePending = false;
  private tierGlideUntil = 0;

  constructor(stage: HTMLElement, canvas: HTMLCanvasElement, sound: StudioSound, cb: ClotheslineCallbacks) {
    this.stage = stage;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true })!;
    this.sound = sound;
    this.cb = cb;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.syncTheme();

    this.motes = Array.from({ length: 18 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.8 + 0.7,
      vx: (Math.random() - 0.35) * 0.00016,
      vy: (Math.random() - 0.5) * 0.00011,
      phase: Math.random() * Math.PI * 2,
    }));

    this.collectItems();
    this.setupLayout();
    this.bindEvents();
  }

  public syncTheme(): void {
    this.isDark = document.documentElement.classList.contains("dark");
  }

  public setPaused(val: boolean): void {
    this.paused = val;
  }

  /** Gentle impulse wave along the rope (intro & theme switch) */
  public sendBreezeWave(strength = 1): void {
    if (this.reducedMotion) return;
    for (const rope of this.ropes) {
      for (let i = 2; i < rope.nodes.length - 2; i++) {
        const n = rope.nodes[i];
        n.oy -= Math.sin((i / rope.nodes.length) * Math.PI) * 3.6 * strength;
        n.ox -= 1.3 * strength;
      }
    }
    for (const item of this.items) {
      item.angVel += (Math.random() * 0.11 + 0.07) * strength;
    }
  }

  /** Called once per frame by the single unified rAF loop in studio-main.ts */
  public tick(dt: number, nowMs: number): void {
    if (this.paused) return;
    if (this.resizePending) {
      this.syncResizeInFrame();
    }
    this.time += dt;

    if (!this.reducedMotion) {
      this.stepPhysics(dt, true);
      this.stepHoverTilts(dt);
      this.renderDOM(dt);
      this.renderCanvas(nowMs);
    }
  }

  private collectItems(): void {
    const els = Array.from(this.stage.querySelectorAll<HTMLElement>(".hanger"));
    // 5 balanced artifacts across the 30-segment desktop rope; 2 (top) + 3 (bottom) on mobile
    const desktopNodes = [4, 9, 15, 21, 26];
    const mobileMap = [
      { rope: 0, node: 9 },
      { rope: 0, node: 21 },
      { rope: 1, node: 6 },
      { rope: 1, node: 15 },
      { rope: 1, node: 24 },
    ];
    const baseTilts = [-2.2, 0.6, -1.5, 1.8, -2.0];
    const weights = [1.35, 2.0, 1.35, 1.3, 1.45];

    els.forEach((el, idx) => {
      const innerEl = el.querySelector<HTMLElement>(".hanger-inner") || el;
      const sheenEl = el.querySelector<HTMLElement>(".card-sheen");
      const m = mobileMap[idx] || { rope: 0, node: 13 };
      this.items.push({
        el,
        innerEl,
        sheenEl,
        action: el.dataset.action || "book",
        desktopNode: desktopNodes[idx] ?? 13,
        mobileRope: m.rope,
        mobileNode: m.node,
        baseTilt: baseTilts[idx] ?? 0,
        angle: baseTilts[idx] ?? 0,
        angVel: 0,
        lastAnchorX: 0,
        weight: weights[idx] ?? 1.5,
        hovered: false,
        cachedLeft: 0,
        cachedTop: 0,
        cachedW: 180,
        cachedH: 220,
        tiltRx: 0,
        tiltRy: 0,
        targetRx: 0,
        targetRy: 0,
        sheenX: 50,
        sheenY: 50,
        tiltDirty: false,
        dispX: Number.NaN,
        dispY: Number.NaN,
        lastTx: Number.NaN,
        lastTy: Number.NaN,
        lastDeg: Number.NaN,
      });
    });
  }

  private buildRope(startX: number, startY: number, endX: number, endY: number, slackFactor: number): RopeLine {
    const nodes: RopeNode[] = [];
    const totalDx = endX - startX;
    const totalDy = endY - startY;
    const straightDist = Math.hypot(totalDx, totalDy);
    const segLen = (straightDist * slackFactor) / SEGMENTS;

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const x = startX + totalDx * t;
      const sag = Math.sin(t * Math.PI) * (this.isMobile ? 18 : 48);
      const y = startY + totalDy * t + sag;
      nodes.push({
        x,
        y,
        ox: x,
        oy: this.reducedMotion ? y : y - sag * 0.12,
        pinned: i === 0 || i === SEGMENTS,
        mass: 1,
      });
    }

    return { nodes, segLen };
  }

  private getRopeGeometry(w: number, h: number, mobile: boolean): Array<{ x0: number; y0: number; x1: number; y1: number; slack: number }> {
    if (mobile) {
      const pad = 12;
      const y1 = Math.max(80, h * 0.1);
      const y2 = Math.max(392, h * 0.478);
      return [
        { x0: pad, y0: y1, x1: w - pad, y1: y1 + 4, slack: 1.02 },
        { x0: pad, y0: y2 + 4, x1: w - pad, y1: y2 - 2, slack: 1.02 },
      ];
    }
    const pad = 32;
    const yLeft = Math.max(138, h * 0.245);
    const yRight = Math.max(150, h * 0.262);
    return [{ x0: pad, y0: yLeft, x1: w - pad, y1: yRight, slack: 1.036 }];
  }

  private setupLayout(preserveDisplayPos = false): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.isMobile = this.width <= 767;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const specs = this.getRopeGeometry(this.width, this.height, this.isMobile);
    this.ropes = specs.map((sp) => this.buildRope(sp.x0, sp.y0, sp.x1, sp.y1, sp.slack));

    for (const item of this.items) {
      const ropeIdx = this.isMobile ? item.mobileRope : 0;
      const nodeIdx = this.isMobile ? item.mobileNode : item.desktopNode;
      const rope = this.ropes[ropeIdx];
      if (rope && rope.nodes[nodeIdx]) {
        rope.nodes[nodeIdx].mass = this.isMobile ? Math.min(1.55, item.weight) : item.weight;
        item.lastAnchorX = rope.nodes[nodeIdx].x;
        if (!preserveDisplayPos) {
          item.dispX = Number.NaN;
          item.dispY = Number.NaN;
        }
      }
    }

    const steps = this.reducedMotion ? 48 : (preserveDisplayPos ? 14 : 32);
    for (let s = 0; s < steps; s++) {
      this.stepPhysics(0.016, false);
    }
    this.renderDOM(preserveDisplayPos ? 0.016 : 1);
    this.renderCanvas(performance.now());
  }

  /** VSync-aligned live resize: smoothly rescales existing rope nodes in-place (zero freeze/stutter!) */
  private syncResizeInFrame(): void {
    this.resizePending = false;
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    const newMobile = newW <= 767;
    const newDpr = Math.min(window.devicePixelRatio || 1, 2);

    if (newW === this.width && newH === this.height && newDpr === this.dpr) return;

    // Crossing 767px (1 rope <-> 2 ropes): lightweight rebuild + brief 260ms card glide into new tier
    if (newMobile !== this.isMobile || this.ropes.length === 0) {
      this.tierGlideUntil = performance.now() + 260;
      this.setupLayout(true);
      return;
    }

    const oldSpecs = this.getRopeGeometry(this.width, this.height, this.isMobile);
    const newSpecs = this.getRopeGeometry(newW, newH, newMobile);

    this.width = newW;
    this.height = newH;
    this.dpr = newDpr;

    const targetW = Math.floor(newW * newDpr);
    const targetH = Math.floor(newH * newDpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.ctx.setTransform(newDpr, 0, 0, newDpr, 0, 0);
    }

    // Proportionally stretch/shrink existing Verlet nodes without resetting physics momentum
    for (let r = 0; r < this.ropes.length; r++) {
      const rope = this.ropes[r];
      const oldSp = oldSpecs[r];
      const newSp = newSpecs[r];
      if (!oldSp || !newSp) continue;

      const oldSpanX = Math.max(1, oldSp.x1 - oldSp.x0);
      const newSpanX = Math.max(1, newSp.x1 - newSp.x0);
      const scaleX = newSpanX / oldSpanX;
      const oldMidY = (oldSp.y0 + oldSp.y1) * 0.5;
      const newMidY = (newSp.y0 + newSp.y1) * 0.5;
      const dyBase = newMidY - oldMidY;

      rope.segLen = (Math.hypot(newSp.x1 - newSp.x0, newSp.y1 - newSp.y0) * newSp.slack) / SEGMENTS;

      const nodes = rope.nodes;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (i === 0) {
          n.x = n.ox = newSp.x0;
          n.y = n.oy = newSp.y0;
        } else if (i === nodes.length - 1) {
          n.x = n.ox = newSp.x1;
          n.y = n.oy = newSp.y1;
        } else {
          n.x = newSp.x0 + (n.x - oldSp.x0) * scaleX;
          n.ox = newSp.x0 + (n.ox - oldSp.x0) * scaleX;
          n.y += dyBase;
          n.oy += dyBase;
        }
      }
    }

    for (const item of this.items) {
      const { rope, nodeIdx } = this.getAnchorForItem(item);
      if (rope && rope.nodes[nodeIdx]) {
        item.lastAnchorX = rope.nodes[nodeIdx].x;
        if (Number.isFinite(item.dispX)) {
          item.dispX = rope.nodes[nodeIdx].x;
          item.dispY = rope.nodes[nodeIdx].y;
        }
      }
    }

    // Brief 3-pass tension settle for crisp tautness during live window drag
    for (let s = 0; s < 3; s++) {
      this.stepPhysics(0.016, false);
    }
    if (this.reducedMotion) {
      this.renderDOM(1);
      this.renderCanvas(performance.now());
    }
  }

  private getAnchorForItem(item: HangingItem): { rope: RopeLine; nodeIdx: number } {
    const ropeIdx = this.isMobile ? item.mobileRope : 0;
    const nodeIdx = this.isMobile ? item.mobileNode : item.desktopNode;
    return { rope: this.ropes[ropeIdx] || this.ropes[0], nodeIdx };
  }

  private findNearestRopeNode(x: number, y: number, maxDist: number): { ropeIdx: number; nodeIdx: number; dist: number } | null {
    let best: { ropeIdx: number; nodeIdx: number; dist: number } | null = null;
    for (let r = 0; r < this.ropes.length; r++) {
      const nodes = this.ropes[r].nodes;
      for (let i = 1; i < nodes.length - 1; i++) {
        const n = nodes[i];
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < maxDist && (!best || d < best.dist)) {
          best = { ropeIdx: r, nodeIdx: i, dist: d };
        }
      }
    }
    return best;
  }

  private bindEvents(): void {
    window.addEventListener(
      "resize",
      () => {
        this.resizePending = true;
      },
      { passive: true }
    );

    window.addEventListener(
      "pointermove",
      (e) => {
        if (this.paused) return;
        this.prevPx = this.px < 0 ? e.clientX : this.px;
        this.prevPy = this.py < 0 ? e.clientY : this.py;
        this.px = e.clientX;
        this.py = e.clientY;
        const vx = this.px - this.prevPx;
        const vy = this.py - this.prevPy;

        if (this.dragRopeIdx >= 0 && this.dragNodeIdx >= 0) {
          this.draggedDist = Math.hypot(this.px - this.dragStartX, this.py - this.dragStartY);
          // Only tug a hanging artifact once pointer intentionally drags > 12px
          if (this.activeHanger && this.draggedDist < 12) return;
          const rope = this.ropes[this.dragRopeIdx];
          const n = rope?.nodes[this.dragNodeIdx];
          if (n && !n.pinned) {
            const minY = this.isMobile ? 66 : 92;
            const maxPullY = this.isMobile ? 80 : 120;
            const targetY = Math.max(minY, Math.min(this.height - 140, this.py));
            const dxPull = (this.px - n.x) * 0.32;
            const dyPull = (Math.min(targetY, n.y + maxPullY) - n.y) * 0.42;
            n.x += dxPull;
            n.y += dyPull;
            // Sympathetic pull on immediate neighbors keeps the quadratic Bezier smooth & welded to clips
            const prev = rope.nodes[this.dragNodeIdx - 1];
            const next = rope.nodes[this.dragNodeIdx + 1];
            if (prev && !prev.pinned) {
              prev.x += dxPull * 0.42;
              prev.y += dyPull * 0.42;
            }
            if (next && !next.pinned) {
              next.x += dxPull * 0.42;
              next.y += dyPull * 0.42;
            }
          }
          return;
        }

        // Aerodynamic cursor wind wake (capped impulse keeps lively bounce without whipping into topbar)
        if (!this.reducedMotion && vx * vx + vy * vy > 4) {
          const cvx = Math.max(-22, Math.min(22, vx));
          const cvy = Math.max(-18, Math.min(18, vy));
          for (let r = 0; r < this.ropes.length; r++) {
            const nodes = this.ropes[r].nodes;
            for (let i = 1; i < nodes.length - 1; i++) {
              const n = nodes[i];
              const dx = n.x - this.px;
              const dy = n.y - this.py;
              const distSq = dx * dx + dy * dy;
              if (distSq < 12100) {
                const force = (1 - Math.sqrt(distSq) / 110) * 0.14;
                n.x += cvx * force;
                n.y += cvy * force * 0.55;
              }
            }
          }
        }

        // Update hovered item tilt targets using CACHED rect (zero reflow!)
        let anyHovered = false;
        for (const item of this.items) {
          if (item.hovered) {
            anyHovered = true;
            if (!this.reducedMotion && !this.isMobile && item.cachedW > 0 && item.cachedH > 0) {
              const nx = Math.max(0, Math.min(1, (this.px - item.cachedLeft) / item.cachedW));
              const ny = Math.max(0, Math.min(1, (this.py - item.cachedTop) / item.cachedH));
              item.targetRx = (0.5 - ny) * 10;
              item.targetRy = (nx - 0.5) * 12;
              item.sheenX = nx * 100;
              item.sheenY = ny * 100;
              item.tiltDirty = true;
            }
          }
        }

        if (!anyHovered) {
          const hit = this.findNearestRopeNode(this.px, this.py, 26);
          if (hit) {
            this.cb.onCursorState?.("rope");
          } else {
            const target = e.target as HTMLElement | null;
            if (!target?.closest("button, a, [role='button']")) {
              this.cb.onCursorState?.("default");
            }
          }
        }
      },
      { passive: true }
    );

    this.stage.addEventListener("pointerdown", (e) => {
      if (this.paused) return;
      if ((e.target as HTMLElement).closest(".hanger")) return;
      const hit = this.findNearestRopeNode(e.clientX, e.clientY, 36);
      if (hit) {
        this.dragRopeIdx = hit.ropeIdx;
        this.dragNodeIdx = hit.nodeIdx;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.draggedDist = 0;
        this.cb.onFirstInteract?.();
      }
    });

    window.addEventListener("pointerup", () => {
      if (this.dragRopeIdx >= 0) {
        const rope = this.ropes[this.dragRopeIdx];
        const u = rope ? this.dragNodeIdx / rope.nodes.length : 0.5;
        const now = performance.now();
        if (this.draggedDist > 14 && now - this.lastPluckTime > 120) {
          this.sound.ropePluck(u, Math.min(1, this.draggedDist / 65));
          this.lastPluckTime = now;
          this.suppressClickUntil = now + 260;
        }
      }
      this.dragRopeIdx = -1;
      this.dragNodeIdx = -1;
      this.activeHanger = null;
      this.draggedDist = 0;
    });

    for (const item of this.items) {
      const btn = item.el.querySelector<HTMLElement>(".hanger-btn");

      item.el.addEventListener("pointerenter", () => {
        if (this.paused) return;
        item.hovered = true;
        // Measure ONCE on enter instead of every pointermove
        const rect = item.innerEl.getBoundingClientRect();
        item.cachedLeft = rect.left;
        item.cachedTop = rect.top;
        item.cachedW = rect.width;
        item.cachedH = rect.height;

        const { rope, nodeIdx } = this.getAnchorForItem(item);
        if (rope?.nodes[nodeIdx] && !this.reducedMotion) {
          rope.nodes[nodeIdx].oy += 1.5;
          item.angVel += this.px < rope.nodes[nodeIdx].x ? 0.13 : -0.13;
        }
        if (item.action === "book") {
          this.cb.onCursorState?.("book", "READ", "翻开书册");
        } else if (item.action === "about") {
          this.cb.onCursorState?.("open", "ABOUT", "关于我");
        } else if (item.action === "murmur") {
          this.cb.onCursorState?.("open", "MEMO", "碎碎念");
        } else if (item.action === "vinyl") {
          this.cb.onCursorState?.("open", "VINYL", "留声机");
        } else {
          this.cb.onCursorState?.("open", "POST", "朋友们");
        }
      });

      item.el.addEventListener("pointerleave", () => {
        item.hovered = false;
        item.targetRx = 0;
        item.targetRy = 0;
        item.tiltRx = 0;
        item.tiltRy = 0;
        item.tiltDirty = false;
        item.innerEl.style.transform = "";
        this.cb.onCursorState?.("default");
      });

      item.el.addEventListener("pointerdown", (e) => {
        if (this.paused) return;
        if ((e.target as HTMLElement).closest("[data-mini-toggle]")) return;
        const ropeIdx = this.isMobile ? item.mobileRope : 0;
        const nodeIdx = this.isMobile ? item.mobileNode : item.desktopNode;
        this.dragRopeIdx = ropeIdx;
        this.dragNodeIdx = nodeIdx;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.draggedDist = 0;
        this.activeHanger = item;
      });

      btn?.addEventListener("click", (e) => {
        if (this.paused) return;
        if ((e.target as HTMLElement).closest("[data-mini-toggle]")) return;
        if (performance.now() < this.suppressClickUntil) {
          e.preventDefault();
          return;
        }
        this.sound.clipClick();
        this.cb.onFirstInteract?.();
        this.cb.onOpenArtifact(item.action, item.el);
      });

      btn?.addEventListener("keydown", (e) => {
        if (e.target !== btn) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.sound.clipClick();
          this.cb.onFirstInteract?.();
          this.cb.onOpenArtifact(item.action, item.el);
        }
      });
    }
  }

  private stepHoverTilts(dt: number): void {
    const ease = 1 - Math.exp(-12 * dt);
    for (const item of this.items) {
      if (!item.hovered || !item.tiltDirty) continue;
      item.tiltRx += (item.targetRx - item.tiltRx) * ease;
      item.tiltRy += (item.targetRy - item.tiltRy) * ease;
      item.innerEl.style.transform = `translate3d(0,-7px,0) scale(1.03) rotateX(${item.tiltRx.toFixed(2)}deg) rotateY(${item.tiltRy.toFixed(2)}deg)`;
      if (item.sheenEl) {
        item.sheenEl.style.setProperty("--mx", `${item.sheenX.toFixed(1)}%`);
        item.sheenEl.style.setProperty("--my", `${item.sheenY.toFixed(1)}%`);
      }
      if (Math.abs(item.targetRx - item.tiltRx) < 0.04 && Math.abs(item.targetRy - item.tiltRy) < 0.04) {
        item.tiltDirty = false;
      }
    }
  }

  private stepPhysics(dt: number, withWind: boolean): void {
    const damping = 0.986;
    const gravity = this.isMobile ? 0.34 : 0.44;

    for (let r = 0; r < this.ropes.length; r++) {
      const rope = this.ropes[r];
      const nodes = rope.nodes;

      for (let i = 1; i < nodes.length - 1; i++) {
        const n = nodes[i];
        const vx = (n.x - n.ox) * damping;
        const vy = (n.y - n.oy) * damping;
        n.ox = n.x;
        n.oy = n.y;

        let windX = 0;
        let windY = 0;
        if (withWind && !this.reducedMotion) {
          const wave = Math.sin(this.time * 1.15 + i * 0.28 + r * 1.7);
          const gust = Math.sin(this.time * 0.42) * 0.5 + 0.5;
          windX = wave * 0.042 * (0.4 + gust);
          windY = Math.cos(this.time * 0.9 + i * 0.35) * 0.018;
        }

        n.x += vx + windX;
        n.y += vy + gravity * n.mass + windY;
      }

      const minY = this.isMobile ? 64 : 88;
      const maxY = this.height - 130;

      // 8 iterations with fast Math.sqrt gives crisp taut linen at minimal CPU cost
      for (let iter = 0; iter < 8; iter++) {
        for (let i = 0; i < nodes.length - 1; i++) {
          const p1 = nodes[i];
          const p2 = nodes[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const diff = (rope.segLen - dist) / dist;

          if (!p1.pinned && !p2.pinned) {
            const invMass = 1 / (p1.mass + p2.mass);
            const w1 = p2.mass * invMass;
            const w2 = p1.mass * invMass;
            p1.x -= dx * diff * w1;
            p1.y -= dy * diff * w1;
            p2.x += dx * diff * w2;
            p2.y += dy * diff * w2;
          } else if (!p1.pinned) {
            p1.x -= dx * diff;
            p1.y -= dy * diff;
          } else if (!p2.pinned) {
            p2.x += dx * diff;
            p2.y += dy * diff;
          }
        }
      }

      // Soft vertical ceiling keeps the rope below the top header brand even during hard shakes
      for (let i = 1; i < nodes.length - 1; i++) {
        const n = nodes[i];
        if (n.y < minY) {
          n.y = minY;
          if (n.oy > n.y) n.oy = n.y + (n.oy - n.y) * 0.35;
        } else if (n.y > maxY) {
          n.y = maxY;
          if (n.oy < n.y) n.oy = n.y - (n.y - n.oy) * 0.35;
        }
      }
    }

    const scaleDt = dt * 60;
    for (const item of this.items) {
      const { rope, nodeIdx } = this.getAnchorForItem(item);
      if (!rope) continue;
      const n = rope.nodes[nodeIdx];
      const prev = rope.nodes[Math.max(0, nodeIdx - 1)];
      const next = rope.nodes[Math.min(rope.nodes.length - 1, nodeIdx + 1)];

      const slopeDeg = Math.atan2(next.y - prev.y, next.x - prev.x) * 57.2958 * 0.48;
      const accelX = n.x - item.lastAnchorX;
      item.lastAnchorX = n.x;

      if (this.reducedMotion) {
        item.angle = item.baseTilt + slopeDeg;
        continue;
      }

      const windTorque = Math.sin(this.time * 1.45 + nodeIdx * 0.7) * 0.055;
      const targetAngle = item.baseTilt + slopeDeg;
      const restoring = (targetAngle - item.angle) * 0.065;
      item.angVel = (item.angVel + restoring - accelX * 0.17 + windTorque) * 0.935;
      item.angle += item.angVel * scaleDt;
      if (item.angle > 18) item.angle = 18;
      else if (item.angle < -18) item.angle = -18;
    }
  }

  private renderDOM(dt = 0.016): void {
    const gliding = performance.now() < this.tierGlideUntil && !this.reducedMotion && dt < 0.5;
    const glide = gliding ? 1 - Math.exp(-15 * dt) : 1;
    for (const item of this.items) {
      const { rope, nodeIdx } = this.getAnchorForItem(item);
      if (!rope) continue;
      const n = rope.nodes[nodeIdx];
      const prev = rope.nodes[Math.max(0, nodeIdx - 1)];
      const next = rope.nodes[Math.min(rope.nodes.length - 1, nodeIdx + 1)];
      // Exact point on the drawn quadratic Bezier curve (B(0.5) = 0.125*prev + 0.75*n + 0.125*next)
      const curveX = 0.125 * prev.x + 0.75 * n.x + 0.125 * next.x;
      const curveY = 0.125 * prev.y + 0.75 * n.y + 0.125 * next.y;

      if (!Number.isFinite(item.dispX) || glide >= 1) {
        item.dispX = curveX;
        item.dispY = curveY;
      } else {
        const dx = curveX - item.dispX;
        const dy = curveY - item.dispY;
        if (dx * dx + dy * dy < 0.04) {
          item.dispX = curveX;
          item.dispY = curveY;
        } else {
          item.dispX += dx * glide;
          item.dispY += dy * glide;
        }
      }

      if (
        Math.abs(item.dispX - item.lastTx) < 0.04 &&
        Math.abs(item.dispY - item.lastTy) < 0.04 &&
        Math.abs(item.angle - item.lastDeg) < 0.02
      ) {
        continue;
      }
      item.lastTx = item.dispX;
      item.lastTy = item.dispY;
      item.lastDeg = item.angle;
      item.el.style.transform = `translate3d(${item.dispX.toFixed(1)}px, ${item.dispY.toFixed(1)}px, 0) translateX(-50%) rotate(${item.angle.toFixed(2)}deg)`;
    }
  }

  private traceRope(nodes: RopeNode[], offsetY: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y + offsetY);
    for (let i = 1; i < nodes.length - 1; i++) {
      const xc = (nodes[i].x + nodes[i + 1].x) * 0.5;
      const yc = (nodes[i].y + nodes[i + 1].y) * 0.5 + offsetY;
      ctx.quadraticCurveTo(nodes[i].x, nodes[i].y + offsetY, xc, yc);
    }
    const last = nodes[nodes.length - 1];
    ctx.lineTo(last.x, last.y + offsetY);
  }

  private renderCanvas(nowMs: number): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Subtle drifting sunlit dust motes (single fillStyle + globalAlpha, zero per-mote string alloc)
    if (!this.reducedMotion) {
      ctx.fillStyle = this.isDark ? "#ffe0b2" : "#b48258";
      for (let i = 0; i < this.motes.length; i++) {
        const m = this.motes[i];
        m.x = (m.x + m.vx + 1) % 1;
        m.y = (m.y + m.vy + Math.sin(nowMs * 0.0006 + m.phase) * 0.00007 + 1) % 1;
        ctx.globalAlpha = 0.12 + 0.14 * (0.5 + 0.5 * Math.sin(nowMs * 0.0011 + m.phase));
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 2. Hardware-fast Verlet ropes (soft double-stroke shadow, NO Gaussian blur pass!)
    const shadowOuter = this.isDark ? "rgba(0, 0, 0, 0.28)" : "rgba(35, 27, 18, 0.065)";
    const shadowInner = this.isDark ? "rgba(0, 0, 0, 0.42)" : "rgba(35, 27, 18, 0.11)";
    const ropeMain = this.isDark ? "#a49077" : "#6b5b49";
    const ropeBraid = this.isDark ? "rgba(255, 245, 225, 0.22)" : "rgba(255, 248, 236, 0.34)";
    const anchorDot = this.isDark ? "rgba(235, 229, 218, 0.65)" : "rgba(22, 21, 19, 0.65)";
    const anchorRing = this.isDark ? "rgba(229, 106, 82, 0.72)" : "rgba(200, 75, 49, 0.72)";

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let r = 0; r < this.ropes.length; r++) {
      const nodes = this.ropes[r].nodes;
      if (nodes.length < 2) continue;

      // Soft cast shadow (2 crisp alpha strokes replace expensive SVG filter:blur)
      this.traceRope(nodes, 14);
      ctx.setLineDash([]);
      ctx.lineWidth = 8;
      ctx.strokeStyle = shadowOuter;
      ctx.stroke();

      ctx.lineWidth = 3.5;
      ctx.strokeStyle = shadowInner;
      ctx.stroke();

      // Main linen rope
      this.traceRope(nodes, 0);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = ropeMain;
      ctx.stroke();

      // Twisted braid texture highlight
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = ropeBraid;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Left & right brass wall anchors
      const endpoints = [nodes[0], nodes[nodes.length - 1]];
      for (const pt of endpoints) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = anchorRing;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = anchorDot;
        ctx.fill();
      }
    }
  }
}
