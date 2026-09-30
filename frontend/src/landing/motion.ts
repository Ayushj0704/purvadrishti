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

/** The number a metric is meant to end on, read from its data attributes. */
function countTarget(el: HTMLElement): { target: number; dp: number; suffix: string } {
  return {
    target: Number(el.dataset.count ?? 0),
    dp: Number(el.dataset.countDp ?? 0),
    suffix: el.dataset.countSuffix ?? "",
  };
}

function countUp(el: HTMLElement): void {
  const { target, dp, suffix } = countTarget(el);
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

/**
 * Put the finished number up with no animation.
 *
 * The counting is a scroll trigger, and with reduced motion no triggers are
 * created at all - so without this the metrics keep whatever they were authored
 * with, which is no text at all. Someone who has asked for less motion should get
 * exactly the same figures, just without watching them roll up.
 */
function setCountFinal(el: HTMLElement): void {
  const { target, dp, suffix } = countTarget(el);
  el.textContent = target.toFixed(dp) + suffix;
}

function setAllCountsFinal(): void {
  for (const el of gsap.utils.toArray<HTMLElement>(".metric-value")) setCountFinal(el);
}

export function initMotion(
  lenis: Lenis | null,
  onProgress: (progress: number) => void,
): void {
  if (prefersReducedMotion()) {
    // The panels are still position: sticky under reduced motion - that is CSS,
    // and it is not motion the visitor asked to be spared. So the fit decision
    // still has to be made here: a panel taller than a phone held in portrait
    // cannot be stuck at top: 0, because its overflow would sit above the fold
    // with no way to scroll to it.
    collectStack();
    applyStackFits();
    document.fonts?.ready.then(() => {
      applyStackFits();
    });
    setAllCountsFinal();
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
  setAllCountsFinal();
}

function revealScribbles(): void {
  for (const el of gsap.utils.toArray<HTMLElement>(".scribble")) {
    el.classList.add("is-inview");
  }
}

/**
 * The stack, and the one measurement that position: sticky breaks.
 *
 * Neither getBoundingClientRect() nor offsetTop will do here, and this is the
 * single most important thing to get right in the file. Both report where a
 * sticky element currently *is*, not where it lives in the document: a panel
 * reads offsetTop 2565 at the top of the page and 8460 once the panels below it
 * have been pushed to the foot of the viewport, and its rect says top: 0 for the
 * whole of its hold. Every trigger here is a scroll position, so measuring
 * against the stuck position means measuring the scroll position against itself -
 * which is how the anchors end up scrolling to wherever the visitor already is,
 * and how the tile sequence ends up pinned to one step.
 *
 * The only trustworthy reading of a stuck element's static position is to take
 * the stickiness away while it is measured. So the panels are switched to
 * position: static for the duration of the read and put back afterwards. That is
 * safe because static is the layout they already have: a sticky element is in
 * normal flow, so its height, its margins and its position in the flow are all
 * identical, and only the offset is removed. It happens inside one synchronous
 * read, before the browser paints, so nothing flickers.
 */
let measuring = 0;

function withoutSticky<T>(read: () => T): T {
  // Already un-stuck by an enclosing measurement - most importantly by
  // refreshStack(), so one refresh costs one layout pass rather than one per
  // trigger that asks where something is.
  if (measuring) return read();

  measuring++;
  const restore: [HTMLElement, string][] = [];
  for (const entry of stack) {
    if (entry.el.classList.contains("is-unpinned")) continue;
    restore.push([entry.el, entry.el.style.position]);
    entry.el.style.position = "static";
  }

  try {
    return read();
  } finally {
    for (const [el, position] of restore) el.style.position = position;
    measuring--;
  }
}

/** An element's static offset from the top of the document, with no stickiness. */
function docTop(el: HTMLElement): number {
  return withoutSticky(() => {
    let y = 0;
    let node: HTMLElement | null = el;
    while (node) {
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return y;
  });
}

/**
 * The scroll position at which `el`'s top sits `fraction` of the way down the
 * viewport - the numeric form of ScrollTrigger's "top NN%", measured against the
 * document rather than against the stuck position.
 */
function atViewport(el: HTMLElement, fraction: number): () => number {
  return () => docTop(el) - window.innerHeight * fraction;
}

/**
 * Recompute every trigger, with the stack un-stuck for the whole pass.
 *
 * ScrollTrigger calls each start/end function while refreshing, so un-sticking
 * inside docTop() would cost a layout pass per call. Doing it once around the
 * refresh - and letting the nested measurements short-circuit - keeps it to one.
 */
function refreshStack(): void {
  withoutSticky(() => ScrollTrigger.refresh());
}

/**
 * Stack the panels and hand each one a progress value for its inner motion.
 *
 * The panels themselves are held in place by CSS (position: sticky plus a
 * --stack-dwell margin); nothing here positions them. What this does is measure
 * each panel to decide whether it can be stuck at all, and give the pipeline a
 * real 0..1 to drive its tiles with.
 *
 * The progress window is the panel's hold (see makeStackProgress): the panel is
 * locked and fully readable for its whole duration, and the window closes at the
 * moment the next panel starts to cover it.
 */
function setupStack(lenis: Lenis | null): void {
  collectStack();
  for (const entry of stack) entry.trigger = makeStackProgress(entry.el);
  setupAnchors(lenis);
}

/**
 * Find the panels and record the paint order.
 *
 * Split out of setupStack() because the sticky behaviour is CSS, not JS: with
 * reduced motion the panels are still stuck, so the fit decision still has to be
 * made, just without the triggers and tweens.
 */
function collectStack(): void {
  const panels = gsap.utils.toArray<HTMLElement>(".stack-panel");

  stack.length = 0;
  panels.forEach((el, i) => {
    // Explicit order, so a panel is never painted under its successor. Set
    // whether or not it ends up stuck, so the order stays stable.
    el.style.zIndex = String(10 + i);
    stack.push({ el, trigger: null });
  });
}

const stack: { el: HTMLElement; trigger: ScrollTrigger | null }[] = [];

/**
 * Stuck or unstuck, depending on whether the panel's content fits the viewport.
 *
 * This has to be re-runnable rather than decided once. A panel taller than the
 * viewport would be stuck with its overflow permanently above the fold, but the
 * first measurement happens before webfonts have landed, when the content is at
 * its smallest and looks like it fits. So the decision is made again from
 * settle() once the layout is trustworthy, and can be reversed either way.
 */

function applyStackFits(): void {
  for (const entry of stack) {
    // offsetHeight, not scrollHeight: scrollHeight counts overflow, and the
    // question is whether the panel's own box exceeds a single screen.
    const fits = entry.el.offsetHeight <= window.innerHeight + 8;
    entry.el.classList.toggle("is-unpinned", !fits);
  }
}

/**
 * A panel's hold, as a 0..1 progress for its inner motion.
 *
 * The hold is the stretch where the panel is locked at the top of the viewport
 * with nothing else on screen: it opens when the panel lands and closes when the
 * next panel's top edge reaches the bottom of the viewport, which is exactly
 * where that panel starts covering this one. Driving the content from this
 * window rather than from the arrival means the pipeline steps through its tiles
 * while it is settled and readable, and finishes as the next panel takes over.
 *
 * The end is measured off the next sibling's document offset rather than off
 * --stack-dwell, so it stays right when a panel runs taller than one viewport
 * (the hold is then whatever is left over) and for the last panel, which is held
 * open by .close rather than by another panel.
 */
function makeStackProgress(panel: HTMLElement): ScrollTrigger {
  const next = panel.nextElementSibling as HTMLElement | null;

  return ScrollTrigger.create({
    id: panel.id || undefined,
    trigger: panel,
    // Absolute scroll positions, not keywords - see docTop().
    start: () => docTop(panel),
    end: () => {
      const landed = docTop(panel);
      if (!next) return landed + window.innerHeight;
      return Math.max(landed + 1, docTop(next) - window.innerHeight);
    },
    invalidateOnRefresh: true,
    onUpdate: (self) => onPanelProgress(panel, self.progress),
    // onUpdate only fires inside the window, so without these the tiles would
    // keep whichever step was last showing when scrolling back out of range.
    onLeave: () => onPanelProgress(panel, 1),
    onLeaveBack: () => onPanelProgress(panel, 0),
  });
}

/**
 * Inner motion for a panel, driven by its arrival progress.
 *
 * The pipeline walks its four tiles in sequence, so one panel reads as stepping
 * through the stages. Everything else just gets a slow drift - enough to feel
 * alive without competing with the panel sliding over it.
 */
function onPanelProgress(panel: HTMLElement, p: number): void {
  if (panel.classList.contains("tiles")) {
    const tiles = gsap.utils.toArray<HTMLElement>(".tile", panel);
    const n = tiles.length;
    if (!n) return;

    const step = 1 / n;
    // The active tile is derived from the index rather than from a per-tile
    // `p < (i + 1) * step` test, because that test is false for the last tile
    // once p reaches 1 - which left the panel locked with nothing lit, on the
    // one frame the visitor is actually looking at it. Clamping the index is
    // what makes the fourth tile hold.
    const active = Math.min(n - 1, Math.floor(p * n));
    tiles.forEach((tile, i) => {
      const local = Math.min(1, Math.max(0, (p - i * step) / step));
      tile.classList.toggle("is-active", i === active);
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
 * Nav links jump to a section's locked position.
 *
 * Lenis's own anchor handling is off (see createLenis) because it reads the
 * target's bounding rect, and a panel held at top: 0 reports a rect that says it
 * is already at the top of the viewport - which would drop the visitor nowhere at
 * all. The scroll position worth aiming at is the panel's static document offset,
 * which is also exactly where it locks, so docTop() is both correct and immune to
 * the sticky constraint.
 */
function setupAnchors(lenis: Lenis | null): void {
  for (const link of gsap.utils.toArray<HTMLAnchorElement>('a[href^="#"]')) {
    const id = link.getAttribute("href")?.slice(1);
    if (!id) continue;
    const target = document.getElementById(id);
    if (!target) continue;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      const top = docTop(target);
      if (lenis) {
        lenis.scrollTo(top, { duration: 1.5 });
      } else {
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  }
}

/**
 * Marks the nav link for whichever section currently owns the screen.
 *
 * The console's TopNav gets this from React Router's isActive. There is no router
 * here, so the same state is read off scroll geometry instead: the last section
 * whose top has crossed the header is the one being read, and everything below
 * the fold still has nothing active.
 *
 * `top` is the right signal to read, not an IntersectionObserver ratio, because
 * of the stack. A stuck panel reports top: 0 for its entire hold - which is
 * precisely the "this section owns the screen" answer - and the ratio would
 * flicker as a panel slides over its neighbour. It also means the incoming
 * section takes the highlight at the moment it locks, not while it is still
 * climbing, which keeps the label from changing twice in one viewport of scroll.
 * Keyed by href rather than index because the header renders its links twice,
 * once per breakpoint, and both copies have to light up together.
 */
function setupNavSpy(): void {
  const links = gsap.utils.toArray<HTMLAnchorElement>(".landing-nav a[data-nav-link]");
  const nav = document.querySelector<HTMLElement>(".landing-nav");

  const sections = new Map<string, HTMLElement>();
  for (const link of links) {
    const id = link.getAttribute("href")?.slice(1);
    if (!id || sections.has(id)) continue;
    const section = document.getElementById(id);
    if (section) sections.set(id, section);
  }
  if (!sections.size) return;

  let queued = false;

  const update = () => {
    queued = false;
    // The header grows a second row below 768px, and that row is part of what
    // the visitor is reading, so the line moves with it.
    const line = (nav?.offsetHeight ?? 64) + 8;

    let active: string | null = null;
    for (const [id, section] of sections) {
      if (section.getBoundingClientRect().top <= line) active = id;
    }

    for (const link of links) {
      const id = link.getAttribute("href")?.slice(1);
      link.classList.toggle("is-active", !!id && id === active);
    }
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();
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
  window.addEventListener("resize", () => refreshStack(), {
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
      // atViewport() rather than "top 80%": a sticky section's rect does not
      // describe where it lives in the document, so a keyword start would fire
      // at an arbitrary moment. See docTop().
      start: atViewport(section, 0.8),
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

  // --- Nav active state ---------------------------------------------------
  setupNavSpy();

  // --- Scribble underlines ------------------------------------------------
  for (const scribble of gsap.utils.toArray<HTMLElement>(".scribble")) {
    ScrollTrigger.create({
      trigger: scribble,
      start: atViewport(scribble, 0.9),
      once: true,
      onEnter: () => scribble.classList.add("is-inview"),
    });
  }

  // --- Count-ups ----------------------------------------------------------
  for (const metric of gsap.utils.toArray<HTMLElement>(".metric-value")) {
    ScrollTrigger.create({
      trigger: metric,
      start: atViewport(metric, 0.88),
      once: true,
      onEnter: () => countUp(metric),
    });
  }

  // Positions are only trustworthy once layout has actually settled: fonts land
  // late, and the hero is sized in svh, which resolves differently depending on
  // when it is first read.
  const settle = () => {
    // Re-decide which panels can be stuck first: fonts landing can push a panel
    // past a viewport, and a panel past a viewport must not be stuck. Toggling
    // .is-unpinned changes the document height, so refresh comes after.
    applyStackFits();
    refreshStack();
    sweepRevealed();
    sweepCounts();
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
  sweepCounts();
}

/**
 * The same backstop for the metrics: a count-up trigger that never fires leaves
 * an empty element, so the figure is simply missing rather than wrong. Filling in
 * any metric that is still blank costs nothing and cannot overwrite a count that
 * has already run.
 */
function sweepCounts(): void {
  for (const el of gsap.utils.toArray<HTMLElement>(".metric-value")) {
    if (!el.textContent?.trim()) setCountFinal(el);
  }
}

export function createLenis(): Lenis | null {
  if (prefersReducedMotion()) return null;

  return new Lenis({
    duration: 1.1,
    easing: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
    // Anchor targets are handled in setupAnchors(). Lenis resolves a link by
    // the target's bounding rect, and a panel held at top: 0 by sticky reports a
    // rect saying it is already at the top of the viewport, so its own anchor
    // handling would land in the wrong place.
    anchors: false,
    respectReducedMotion: true,
  });
}
