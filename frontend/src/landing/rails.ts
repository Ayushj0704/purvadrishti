/**
 * The marquee rails on "Built for the people who answer."
 *
 * A seamless left-to-right loop needs three things, and none of them can come
 * from the stylesheet alone:
 *
 * - Enough copies. The track has to hold more than a full viewport's worth of
 *   pills, because the animation slides it left by exactly one group and then
 *   snaps back to a visually identical state. Two groups only cover that if a
 *   single group is at least as wide as the rail - which on this page none of
 *   them are, so out of the box the rails ran out of pills partway through and
 *   left empty space at the right edge.
 * - The right shift distance. One group is 1/count of the track, and count is
 *   only known once the copies exist.
 * - The right duration, per rail. `data-speed` is a ratio between rails, so it
 *   only means anything once something reads it. It used to be set in the markup
 *   and read by nothing, so all three rails crawled at the same 38s and the
 *   "drifting at different speeds" they were meant to have never happened.
 *
 * The copies are cloned in rather than written into the markup because the count
 * is a function of the viewport: a 360px phone needs far fewer than a 1920px
 * display, and shipping the desktop count would be wasted nodes on the small
 * screens where they cost the most.
 *
 * The animation itself stays in CSS so it keeps running on the compositor. Only
 * two custom properties are published here, and neither changes geometry, so
 * writing them cannot feed back into the measurements taken below.
 */

/** Pixels per second, per unit of `data-speed`. Sets the overall pace. */
const PX_PER_SEC = 46;

export function initRails(root: ParentNode = document): () => void {
  const rails = Array.from(root.querySelectorAll<HTMLElement>(".rail[data-speed]"));
  if (!rails.length) return () => {};

  const cleanups: Array<() => void> = [];

  for (const rail of rails) {
    const track = rail.querySelector<HTMLElement>(".rail-track");
    const seed = track?.firstElementChild as HTMLElement | null;
    if (!track || !seed) continue;

    const speed = Number(rail.dataset.speed) || 1;

    const fit = (): void => {
      const railW = rail.getBoundingClientRect().width;
      const groupW = seed.getBoundingClientRect().width;
      if (!railW || !groupW) return;

      // The track slides left by one group and wraps, so at the far end of the
      // cycle only (count - 1) groups are still reachable on the right. That has
      // to be at least one viewport wide or the tail of the rail goes empty.
      const needed = Math.max(2, Math.ceil(railW / groupW) + 1);

      while (track.children.length < needed) {
        track.appendChild(seed.cloneNode(true));
      }
      while (track.children.length > needed) {
        track.lastElementChild?.remove();
      }

      track.style.setProperty("--rail-shift", `${(-100 / needed).toFixed(4)}%`);
      // Group width is the distance travelled per cycle, so holding px/s fixed
      // and dividing by the rail's own ratio is what makes 0.4 genuinely slower
      // than 0.9 rather than merely a different-looking number.
      track.style.setProperty("--rail-duration", `${(groupW / (speed * PX_PER_SEC)).toFixed(2)}s`);
    };

    fit();

    let lastWidth = rail.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const w = rail.getBoundingClientRect().width;
      if (w === lastWidth) return;
      lastWidth = w;
      fit();
    });
    observer.observe(rail);
    cleanups.push(() => observer.disconnect());
  }

  return () => cleanups.forEach((fn) => fn());
}
