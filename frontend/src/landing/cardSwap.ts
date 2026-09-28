import gsap from "gsap";

/**
 * CardSwap, ported to the landing's own stack.
 *
 * The upstream component is React, but this page ships no React on purpose (see
 * dom.ts) and the animation is GSAP either way — which the landing already loads
 * for the hero and the stack panels. So this is the same timeline logic with
 * refs replaced by element handles, and no new dependency.
 *
 * Two things the original does that this does not, both because the landing is
 * held to a stricter standard:
 *
 * - `prefers-reduced-motion` is honoured. The swap is autonomous motion that runs
 *   forever, which is the exact thing that setting asks to be spared. Under it
 *   the cards sit in their resting slots and never auto-advance; a click still
 *   reorders them, instantly and without the elastic drop, since a visitor asked
 *   for that by clicking.
 * - The loop stops when the hero scrolls away. The hero fades itself out on
 *   departure, so a stack of tweening cards behind it is work nobody can see.
 *
 * Returns a disposer, which the landing needs because it tears the WebGL field
 * down on pagehide and a bare setInterval would outlive it.
 */

export interface CardSwapOptions {
  /** X-axis spacing between cards. */
  cardDistance?: number;
  /** Y-axis spacing between cards. */
  verticalDistance?: number;
  /** Milliseconds between swaps. */
  delay?: number;
  /** Freeze the stack while the pointer is over it. */
  pauseOnHover?: boolean;
  onCardClick?: (index: number) => void;
  /** Degrees of slope on the top and bottom edges. */
  skewAmount?: number;
  easing?: "linear" | "elastic";
}

interface Slot {
  x: number;
  y: number;
  z: number;
  zIndex: number;
}

const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
});

const placeNow = (el: Element, slot: Slot, skew: number): void => {
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: "center center",
    zIndex: slot.zIndex,
    force3D: true,
  });
};

/** The two easing profiles, straight from the original. */
const PROFILES = {
  elastic: {
    ease: "elastic.out(0.6,0.9)",
    durDrop: 2,
    durMove: 2,
    durReturn: 2,
    promoteOverlap: 0.9,
    returnDelay: 0.05,
  },
  linear: {
    ease: "power1.inOut",
    durDrop: 0.8,
    durMove: 0.8,
    durReturn: 0.8,
    promoteOverlap: 0.45,
    returnDelay: 0.2,
  },
} as const;

export function initCardSwap(root: HTMLElement, options: CardSwapOptions = {}): () => void {
  const {
    cardDistance = 60,
    verticalDistance = 70,
    delay = 5000,
    pauseOnHover = false,
    onCardClick,
    skewAmount = 6,
    easing = "elastic",
  } = options;

  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-swap-card]"));
  if (cards.length < 2) return () => {};

  const config = PROFILES[easing];
  const total = cards.length;
  const slotAt = (i: number): Slot => makeSlot(i, cardDistance, verticalDistance, total);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let order = cards.map((_, i) => i);
  let timeline: ReturnType<typeof gsap.timeline> | null = null;
  let interval = 0;
  let paused = false;
  let rotating = false;
  const disposers: Array<() => void> = [];

  const place = (index: number, slot: Slot): void => {
    gsap.set(cards[index], {
      x: slot.x,
      y: slot.y,
      z: slot.z,
      zIndex: slot.zIndex,
    });
  };

  /**
   * Rotate the stack: the front card drops out, the rest step forward, and the
   * dropped card settles into the back slot. The `promote` label is the overlap
   * that makes the handoff read as one movement rather than a queue.
   *
   * `order` is committed at the *start*, not in a callback at the end. That is
   * what makes a swap request arriving mid-rotation safe to ignore: the logical
   * order is never briefly out of step with what is on screen. Committing on
   * completion instead would mean killing an in-flight timeline — which is what
   * the original does — and that kill silently drops the rotation's commit, so
   * the stack drifts out of order by one every time a click lands mid-swap.
   */
  const swap = (): void => {
    if (order.length < 2) return;

    const [front, ...rest] = order;

    if (reduce.matches) {
      // No drop, no easing: everything lands on its final slot at once.
      const next = [...rest, front];
      next.forEach((cardIndex, i) => {
        place(cardIndex, slotAt(i));
        gsap.set(cards[cardIndex], { xPercent: -50, yPercent: -50, skewY: skewAmount });
      });
      order = next;
      return;
    }

    // One rotation at a time. The interval and a click can both ask.
    if (rotating) return;

    order = [...rest, front];
    rotating = true;
    const elFront = cards[front];
    const tl = gsap.timeline({ onComplete: () => (rotating = false) });
    timeline = tl;

    tl.to(elFront, { y: "+=500", duration: config.durDrop, ease: config.ease });

    tl.addLabel("promote", `-=${config.durDrop * config.promoteOverlap}`);

    rest.forEach((idx, i) => {
      const slot = slotAt(i);
      tl.set(cards[idx], { zIndex: slot.zIndex }, "promote");
      tl.to(
        cards[idx],
        { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease },
        `promote+=${i * 0.15}`,
      );
    });

    const backSlot = slotAt(total - 1);
    tl.addLabel("return", `promote+=${config.durMove * config.returnDelay}`);
    tl.call(() => gsap.set(elFront, { zIndex: backSlot.zIndex }), undefined, "return");
    tl.to(
      elFront,
      { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease },
      "return",
    );
  };

  // Resting state, set explicitly so the stack is correct before anything runs.
  // Deliberately no swap() here: the hero has its own intro timeline, and opening
  // with the stack already in motion means two sets of easing land on the visitor
  // at once. The first rotation happens one `delay` in.
  cards.forEach((card, i) => placeNow(card, slotAt(i), skewAmount));

  /**
   * Publish the two offsets the stylesheet needs to place the stack, measured
   * from the rendered result.
   *
   * The container is the original's fixed box that the cards are centred in, and
   * the back cards spill out of it upwards and to the right with
   * `overflow: visible` - that part is the design and is left alone. What CSS
   * cannot work out on its own is the two corrections below.
   *
   * Both have to be measured rather than calculated, because the cards are
   * transformed in 3D. The back cards sit at negative z under a 900px
   * perspective, so they are rendered *smaller* than their layout box, which
   * means the fan's centre is nowhere near the half-rise the slot maths suggests
   * (it comes out 62px above the front card, not 105px) and the right-hand spill
   * is likewise smaller than three card widths of `cardDistance`.
   *
   * Measuring is safe here in a way it was not before: this writes two custom
   * properties and changes no geometry, so the container's size - and therefore
   * the position the offsets are measured against - cannot move as a result.
   */
  const publishOffsets = (): void => {
    const box = root.getBoundingClientRect();
    if (!box.height) return;

    let top = Infinity;
    let bottom = -Infinity;
    let right = -Infinity;
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
      right = Math.max(right, r.right);
    }
    if (bottom <= top) return;

    // How far the fan's centre sits above the container's centre, so CSS can
    // translate down by the same amount and land it in the middle of the column.
    root.style.setProperty("--swap-drop", `${box.top + box.height / 2 - (top + bottom) / 2}px`);
    // How far the fan reaches past the container's right edge, so the original's
    // rightward nudge cannot push the back cards off the viewport.
    root.style.setProperty("--swap-spill", `${Math.max(0, right - box.right)}px`);
  };

  publishOffsets();

  // Perspective scaling depends on the card size, so both offsets move with it.
  let lastWidth = cards[0]?.offsetWidth ?? 0;
  const resizeObserver = new ResizeObserver(() => {
    const w = cards[0]?.offsetWidth ?? 0;
    if (w === lastWidth) return;
    lastWidth = w;
    publishOffsets();
  });
  resizeObserver.observe(root);
  disposers.push(() => resizeObserver.disconnect());

  const start = (): void => {
    if (paused || reduce.matches || interval) return;
    interval = window.setInterval(swap, delay);
  };

  const stop = (): void => {
    if (!interval) return;
    window.clearInterval(interval);
    interval = 0;
  };

  start();

  // --- Hover ---------------------------------------------------------------
  if (pauseOnHover) {
    const enter = (): void => {
      paused = true;
      timeline?.pause();
      stop();
    };
    const leave = (): void => {
      paused = false;
      timeline?.play();
      start();
    };
    root.addEventListener("pointerenter", enter);
    root.addEventListener("pointerleave", leave);
    disposers.push(() => {
      root.removeEventListener("pointerenter", enter);
      root.removeEventListener("pointerleave", leave);
    });
  }

  // --- Off-screen ----------------------------------------------------------
  // The hero fades out as it departs. No point tweening four cards nobody sees,
  // and a swap landing mid-scrub would pop when the hero comes back.
  //
  // The timeline has to be replayed on the way back in, not just the interval
  // restarted. A visitor who scrolls away mid-rotation leaves a paused
  // timeline behind with `rotating` still true; restarting the interval alone
  // would then call swap() forever and have it ignored, and the stack would sit
  // frozen for the rest of the session.
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        timeline?.play();
        start();
      } else {
        stop();
        timeline?.pause();
      }
    },
    { threshold: 0.05 },
  );
  observer.observe(root);
  disposers.push(() => observer.disconnect());

  // --- Activation ----------------------------------------------------------
  // The cards carry tabindex and a focus ring, so they are already reachable by
  // keyboard; they just had nothing to fire. Space and Enter are both accepted,
  // and the timings are the ones a real <button> uses: Enter on keydown, Space on
  // keyup. Space has to be preventDefault()ed on keydown either way, because on a
  // non-button element the key keeps its native meaning and scrolls the hero
  // instead of the card doing anything.
  const clicks = cards.map((card, i) => {
    const activate = (): void => {
      swap();
      onCardClick?.(i);
    };

    const onClick = (): void => activate();

    let spaceHeld = false;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        activate();
        return;
      }
      if (e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return;
      spaceHeld = true;
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key !== " " || !spaceHeld) return;
      e.preventDefault();
      spaceHeld = false;
      activate();
    };
    // Focus can leave while Space is held, in which case the keyup lands on
    // another element and the activation would never arrive.
    const onBlur = (): void => {
      spaceHeld = false;
    };

    card.addEventListener("click", onClick);
    card.addEventListener("keydown", onKeyDown);
    card.addEventListener("keyup", onKeyUp);
    card.addEventListener("blur", onBlur);
    return () => {
      card.removeEventListener("click", onClick);
      card.removeEventListener("keydown", onKeyDown);
      card.removeEventListener("keyup", onKeyUp);
      card.removeEventListener("blur", onBlur);
    };
  });
  disposers.push(...clicks);

  return () => {
    disposers.forEach((fn) => fn());
    stop();
    timeline?.kill();
    cards.forEach((card) => gsap.killTweensOf(card));
  };
}
