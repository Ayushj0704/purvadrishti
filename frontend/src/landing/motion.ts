import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const EASE = "power3.out";

/**
 * Scroll-revealed content. These are the elements that start hidden and are
 * brought in as their section arrives.
 *
 * The hidden state is set explicitly with gsap.set() rather than with a
 * `from()` tween. `from()` hides its targets through immediateRender and then
 * depends on a ScrollTrigger/tween handshake to bring them back; when that
 * handshake is late or interrupted the content stays at opacity 0. Setting the
 * start state directly and revealing from a plain onEnter makes the resting
 * state unambiguous, and sweepRevealed() below is the backstop.
 */
const REVEAL_SELECTORS = [
  ".split-title",
  ".split-body > *",
  ".section-title",
  ".tile",
  ".card",
  ".numbers-title",
  ".numbers-note",
  ".metric-card",
  ".close-title",
  ".close-lede",
] as const;

/** Above-the-fold copy, driven by the intro timeline rather than by scroll. */
const HERO_SELECTORS = [
  ".landing-nav",
  ".hero .kicker",
  ".hero-title",
  ".hero-lede",
  ".hero-actions",
  ".hero-stats > div",
  ".hero-inner",
  ".scroll-cue",
] as const;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function countUp(el: HTMLElement): void {
  const target = Number(el.dataset.count ?? 0);
  const dp = Number(el.dataset.countDp ?? 0);
  const suffix = el.dataset.countSuffix ?? "";

  const state = { value: 0 };
  gsap.to(state, {
    value: target,
    duration: 1.5,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = state.value.toFixed(dp) + suffix;
    },
  });
}

export function initMotion(
  lenis: Lenis | null,
  onProgress: (progress: number) => void,
): void {
  if (prefersReducedMotion()) {
    revealScribbles();
    onProgress(0);
    return;
  }

  try {
    setupMotion(lenis, onProgress);
  } catch (err) {
    // Anything above can throw. If it does mid-way, some elements are already
    // hidden and the rest of the setup never ran, so strip every animated
    // state and let the page render statically.
    console.error("[landing] motion setup failed, falling back to static", err);
    revealAll();
  }
}

function revealAll(): void {
  gsap.set([...REVEAL_SELECTORS, ...HERO_SELECTORS].join(","), {
    clearProps: "all",
  });
  revealScribbles();
}

function revealScribbles(): void {
  for (const el of gsap.utils.toArray<HTMLElement>(".scribble")) {
    el.classList.add("is-inview");
  }
}

/**
 * Pin each content section so the next one slides up over it from the bottom.
 *
 * ScrollTrigger's pin is used rather than `position: sticky` for two reasons:
 * the pin hands back a real 0..1 progress to drive the inner motion, and it
 * inserts the scroll runway (pin-spacing) that lets the following panel travel
 * all the way up over the pinned one.
 *
 * It also fixes a problem sticky would have introduced. A pinned element's own
 * box stops moving, so anything inside it reacting to its position against the
 * viewport goes dead - the old tile parallax would have frozen solid the
 * moment its section pinned. Inner motion therefore reads progress from the
 * pin rather than from element positions.
 */
function setupStack(lenis: Lenis | null): void {
  const panels = gsap.utils.toArray<HTMLElement>(".stack-panel");

  stack.length = 0;
  panels.forEach((el, i) => {
    // Explicit order, so a pinned panel is never painted under its successor.
    // Set whether or not it ends up pinned, so the order stays stable.
    el.style.zIndex = String(10 + i);
    stack.push({ el, trigger: null });
  });

  applyStackFits();
  setupAnchors(lenis);
}

const stack: { el: HTMLElement; trigger: ScrollTrigger | null }[] = [];

/**
 * Pin or unpin each panel depending on whether its content fits the viewport.
 *
 * This has to be re-runnable rather than decided once. A panel taller than the
 * viewport would be pinned with its overflow permanently off-screen, but the
 * first measurement happens before webfonts have landed, when the content is
 * at its smallest and looks like it fits. So the decision is made again from
 * settle() once the layout is trustworthy, and can be reversed either way.
 */
function applyStackFits(): void {
  for (const entry of stack) {
    // offsetHeight, not scrollHeight: scrollHeight counts overflow, and the
    // question is whether the panel's own box exceeds a single screen.
    const fits = entry.el.offsetHeight <= window.innerHeight + 8;

    if (fits && !entry.trigger) {
      entry.el.classList.remove("is-unpinned");
      entry.trigger = makeStackTrigger(entry.el);
    } else if (!fits && entry.trigger) {
      // kill(true) reverts the pin and removes its spacer, so the panel drops
      // back to being an ordinary block in flow.
      entry.trigger.kill(true);
      entry.trigger = null;
      entry.el.classList.add("is-unpinned");
    }
  }
}

function makeStackTrigger(panel: HTMLElement): ScrollTrigger {
  return ScrollTrigger.create({
    id: panel.id || undefined,
    trigger: panel,
    start: "top top",
    end: () => `+=${Math.round(dwellFor(panel))}`,
    pin: true,
    pinSpacing: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => onPanelProgress(panel, self.progress),
  });
}

/** How long a panel holds still, in pixels of scroll. */
function dwellFor(panel: HTMLElement): number {
  const vh = window.innerHeight;
  const overflow = Math.max(0, panel.scrollHeight - vh);
  return Math.max(vh * 0.9, overflow + vh * 0.6);
}

/**
 * Inner motion for a pinned panel, driven by the pin's 0..1 progress.
 *
 * The pipeline walks its four tiles in sequence, so one pinned panel reads as
 * stepping through the stages. Everything else just gets a slow drift - enough
 * to feel alive without competing with the panel sliding over it.
 */
function onPanelProgress(panel: HTMLElement, p: number): void {
  if (panel.classList.contains("tiles")) {
    const tiles = gsap.utils.toArray<HTMLElement>(".tile", panel);
    const n = tiles.length;
    if (!n) return;

    const step = 1 / n;
    tiles.forEach((tile, i) => {
      const local = Math.min(1, Math.max(0, (p - i * step) / step));
      tile.classList.toggle("is-active", p >= i * step && p < (i + 1) * step);
      // `x` is safe to drive here: the reveal tween only animates `y`/autoAlpha.
      gsap.set(tile, { x: (local - 0.5) * 18 });
    });
    return;
  }

  for (const sel of [".cards", ".numbers-grid", ".split-body", ".rail"]) {
    const grid = panel.querySelector<HTMLElement>(sel);
    if (grid) gsap.set(grid, { y: -22 * p });
  }
}

/**
 * Nav links jump to a section's pinned position.
 *
 * Once a panel is pinned its box is position: fixed, so its bounding rect says
 * where it happens to be stuck rather than where the section lives in the
 * document - and Lenis's own anchor handling reads that rect, which would drop
 * the visitor somewhere arbitrary. The pin's `start` is the scroll position
 * where the section is flush with the top, revealed and pinned, so that is the
 * one position worth aiming at.
 */
function setupAnchors(lenis: Lenis | null): void {
  for (const link of gsap.utils.toArray<HTMLAnchorElement>('a[href^="#"]')) {
    const id = link.getAttribute("href")?.slice(1);
    if (!id) continue;

    link.addEventListener("click", (event) => {
      const trigger = ScrollTrigger.getById(id);
      if (!trigger) return;

      event.preventDefault();
      if (lenis) {
        lenis.scrollTo(trigger.start, { duration: 1.5 });
      } else {
        window.scrollTo({ top: trigger.start, behavior: "smooth" });
      }
    });
  }
}

function setupMotion(
  lenis: Lenis | null,
  onProgress: (progress: number) => void,
): void {
  const onScroll = () => {
    ScrollTrigger.update();
  };

  // --- Lenis <-> ScrollTrigger wiring ---------------------------------------
  // Both libraries keep their own notion of "now". ScrollTrigger updates on
  // Lenis' scroll event, and Lenis advances on GSAP's ticker instead of its own
  // rAF, so the two never disagree by a frame and scrubbed triggers stay locked
  // to the smoothed position.
  //
  // These must be wrapped, not passed by reference. ScrollTrigger.update's
  // first parameter is `reset: boolean`, and both Lenis and the DOM pass a
  // truthy event object. Handing it over directly makes every scroll look like
  // a "reset all triggers" call, which silently breaks every scroll trigger.
  if (lenis) {
    lenis.on("scroll", onScroll);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.on("scroll", (e: { progress: number }) => onProgress(e.progress));
  }

  // Not every scroll passes through Lenis. Dragging the scrollbar, pressing
  // space/PageDown, find-in-page and a load-time #hash all move the document
  // natively, and without this listener ScrollTrigger never hears about them.
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => ScrollTrigger.refresh(), {
    passive: true,
  });

  // --- Load-in ------------------------------------------------------------
  // The reference system slides its first paint up from 80px on a 100ms
  // stagger. Same numbers here, so the page opens at the same tempo.
  const intro = gsap.timeline({ defaults: { ease: EASE } });

  intro
    .from(".landing-nav", { y: -18, autoAlpha: 0, duration: 0.7 })
    .from(".hero .kicker", { y: 14, autoAlpha: 0, duration: 0.6 }, "-=0.45")
    .from(".hero-title", { y: 80, autoAlpha: 0, duration: 1.1 }, "-=0.4")
    .from(".hero-lede", { y: 24, autoAlpha: 0, duration: 0.8 }, "-=0.7")
    .from(".hero-actions", { y: 16, autoAlpha: 0, duration: 0.7 }, "-=0.55")
    .from(
      ".hero-stats > div",
      { y: 12, autoAlpha: 0, duration: 0.6, stagger: 0.1 },
      "-=0.45",
    )
    .from(".scroll-cue", { autoAlpha: 0, duration: 0.6 }, "-=0.3");

  // --- Hero departure ------------------------------------------------------
  // Hands the WebGL field its scroll offset and parallaxes the hero copy out, so
  // the field visibly takes over as the hero leaves.
  gsap.to(".hero-inner", {
    y: -90,
    autoAlpha: 0,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  gsap.to(".scroll-cue", {
    autoAlpha: 0,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "20% top",
      scrub: true,
    },
  });

  ScrollTrigger.create({
    start: "top -80",
    onUpdate: (self) => {
      document
        .querySelector(".landing-nav")
        ?.classList.toggle("is-scrolled", self.scroll() > 80);
    },
  });

  // --- Scroll reveals -----------------------------------------------------
  // Grouped per section so the stagger stays local to what is actually on
  // screen, instead of one global batch firing off-screen.
  for (const section of gsap.utils.toArray<HTMLElement>(
    ".section, .close, .landing-footer",
  )) {
    const targets = [...section.querySelectorAll(REVEAL_SELECTORS.join(","))];
    if (!targets.length) continue;

    gsap.set(targets, { autoAlpha: 0, y: 40 });

    ScrollTrigger.create({
      trigger: section,
      start: "top 80%",
      once: true,
      onEnter: () => {
        gsap.to(targets, {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          ease: EASE,
          stagger: 0.08,
          overwrite: true,
        });
      },
    });
  }

  // --- Stacked panels -----------------------------------------------------
  setupStack(lenis);

  // --- Scribble underlines ------------------------------------------------
  for (const scribble of gsap.utils.toArray<HTMLElement>(".scribble")) {
    ScrollTrigger.create({
      trigger: scribble,
      start: "top 90%",
      once: true,
      onEnter: () => scribble.classList.add("is-inview"),
    });
  }

  // --- Count-ups ----------------------------------------------------------
  for (const metric of gsap.utils.toArray<HTMLElement>(".metric-value")) {
    ScrollTrigger.create({
      trigger: metric,
      start: "top 88%",
      once: true,
      onEnter: () => countUp(metric),
    });
  }

  // Positions are only trustworthy once layout has actually settled: fonts land
  // late, and the hero is sized in svh, which resolves differently depending on
  // when it is first read.
  const settle = () => {
    // Re-decide pin vs. normal flow first: fonts landing can push a panel past
    // a viewport, and a panel past a viewport must not be pinned. Creating or
    // killing a pin shifts everything below it, so refresh comes after.
    applyStackFits();
    ScrollTrigger.refresh();
    sweepRevealed();
  };

  document.fonts?.ready.then(settle);
  window.addEventListener("load", settle);
  // Two frames is enough for the first layout pass to land.
  requestAnimationFrame(() => requestAnimationFrame(settle));
  // And once more after the intro timeline has finished, in case the hero's
  // height changed as fonts swapped in.
  intro.eventCallback("onComplete", settle);
  settle();
}

/**
 * Guarantee that nothing inside the viewport is ever left invisible.
 *
 * Scroll-revealed content is hidden up front and depends on a ScrollTrigger
 * firing to bring it back. That is the part of this page most likely to fail
 * quietly: a trigger whose start position is computed against a layout that
 * later shifts (late webfonts, `svh` resolving differently) can miss entirely,
 * and then real content sits at opacity 0 with nothing logged anywhere.
 *
 * This is the backstop, and it deliberately does not animate - it runs at
 * settle points, so snapping is both correct and cheap. It only ever touches
 * reveal content, never the hero, so it cannot interrupt the load-in, and it
 * skips anything already visible, so it cannot fight a running tween.
 */
function sweepRevealed(): void {
  for (const el of gsap.utils.toArray<HTMLElement>(REVEAL_SELECTORS.join(","))) {
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0) continue;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || parseFloat(style.opacity) < 1) {
      gsap.set(el, { clearProps: "all" });
    }
  }
  revealScribbles();
}

export function createLenis(): Lenis | null {
  if (prefersReducedMotion()) return null;

  return new Lenis({
    duration: 1.1,
    easing: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
    // Anchor targets are handled in setupAnchors(). Lenis measures a pinned
    // panel by its fixed position, which is not where the section lives in the
    // document, so its own anchor handling lands in the wrong place.
    anchors: false,
    respectReducedMotion: true,
  });
}
