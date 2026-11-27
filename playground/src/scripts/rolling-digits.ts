/**
 * Lightweight GPU-composited mechanical rolling digits (tabular-nums).
 * - Animates ONLY numeric digits 0-9 via translate3d(0, -N em, 0).
 * - Keeps punctuation/CJK text crisp and static; zero layout reflow on tick.
 * - Falls back to plain textContent under prefers-reduced-motion.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setRollingText(
  el: HTMLElement | null,
  text: string,
  options?: { immediate?: boolean; staggerMs?: number }
): void {
  if (!el) return;
  const immediate = Boolean(options?.immediate) || REDUCED_MOTION;

  if (immediate || !/\d/.test(text)) {
    el.dataset.rdSig = "";
    el.textContent = text;
    return;
  }

  // Build structural signature: digits become '#', static chars stay literal
  const sig = text.replace(/\d/g, "#");
  const digits = Array.from(text).filter((ch) => ch >= "0" && ch <= "9");

  if (el.dataset.rdSig !== sig) {
    el.dataset.rdSig = sig;
    el.classList.add("rd-root");
    const frag = document.createDocumentFragment();
    let dIdx = 0;

    for (const ch of text) {
      if (ch >= "0" && ch <= "9") {
        const slot = document.createElement("span");
        slot.className = "rd-slot";
        slot.setAttribute("aria-hidden", "true");

        const reel = document.createElement("span");
        reel.className = "rd-reel";
        reel.dataset.rdDigit = String(dIdx);
        reel.textContent = "0\n1\n2\n3\n4\n5\n6\n7\n8\n9";
        // Place at initial digit immediately so first paint has no jarring jump
        reel.style.transitionDuration = "0ms";
        reel.style.transform = `translate3d(0, -${Number(ch)}em, 0)`;

        slot.appendChild(reel);
        frag.appendChild(slot);
        dIdx++;
      } else {
        const lit = document.createElement("span");
        lit.className = "rd-lit";
        lit.setAttribute("aria-hidden", "true");
        lit.textContent = ch;
        frag.appendChild(lit);
      }
    }

    el.innerHTML = "";
    el.appendChild(frag);
    el.setAttribute("aria-label", text);

    // Re-enable smooth spring transition after initial layout commit
    requestAnimationFrame(() => {
      el.querySelectorAll<HTMLElement>(".rd-reel").forEach((r) => {
        r.style.removeProperty("transition-duration");
      });
    });
    return;
  }

  // Same template shape -> smoothly roll ONLY changed digit reels!
  el.setAttribute("aria-label", text);
  const reels = el.querySelectorAll<HTMLElement>(".rd-reel");
  const stagger = options?.staggerMs ?? 24;
  let changed = 0;
  digits.forEach((d, idx) => {
    const reel = reels[idx];
    if (!reel) return;
    const target = `translate3d(0, -${Number(d)}em, 0)`;
    if (reel.style.transform !== target) {
      reel.style.transitionDelay = `${changed * stagger}ms`;
      reel.style.transform = target;
      changed++;
    }
  });
}

/** Roll a numeric stat tile from 0 -> target value with staggered reels */
export function rollStatNumber(el: HTMLElement, target: number): void {
  const formatted = Math.max(0, Math.round(target)).toLocaleString();
  if (REDUCED_MOTION || target <= 0) {
    el.textContent = formatted;
    return;
  }
  const zeroFormatted = formatted.replace(/\d/g, "0");
  // Mount all reels at 0 first
  el.dataset.rdSig = "";
  setRollingText(el, zeroFormatted, { immediate: false });
  // On the next two frames, roll smoothly to target with clean stagger
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setRollingText(el, formatted, { staggerMs: 42 });
    });
  });
}
