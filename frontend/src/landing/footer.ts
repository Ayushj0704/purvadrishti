/**
 * The landing page's footer behaviour: back-to-top.
 *
 * Sits here rather than in sections.ts because it needs a disposer - a
 * listener that outlives the page is a leak, and the landing tears its WebGL
 * field down on pagehide (see main.ts), so the footer's wiring has to go
 * with it. (An earlier revision ticked three timezone clocks here; they were
 * removed — wall time says nothing about the product.)
 */

interface ZoneClock extends HTMLElement {
  dataset: { zone?: string };
}

export function initFooter(root: ParentNode = document): () => void {
  const disposers: Array<() => void> = [];

  // --- Clocks ------------------------------------------------------------
  // Retired: the footer no longer renders .footer-clock-time[data-zone]
  // nodes. Kept guarded so a stale cached bundle ticking old markup cannot
  // throw — the query simply finds nothing and no timer is installed.
  const clocks = Array.from(
    root.querySelectorAll<ZoneClock>(".footer-clock-time[data-zone]"),
  );

  if (clocks.length) {
    const update = (): void => {
      const now = new Date();
      for (const clock of clocks) {
        const zone = clock.dataset.zone;
        if (!zone) continue;
        // en-GB throughout so all three read 24-hour. The console's footer uses
        // en-US for EST, which is the one of the three that carries a meridiem;
        // three clocks in mixed formats side by side is harder to read than
        // three in the same one, so this page keeps them uniform.
        clock.textContent = now.toLocaleTimeString("en-GB", {
          timeZone: zone,
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
    };

    update();
    const timer = window.setInterval(update, 1000);
    disposers.push(() => window.clearInterval(timer));
  }

  // --- Back to top -------------------------------------------------------
  const top = root.querySelector<HTMLElement>("[data-footer-top]");
  if (top) {
    const onClick = (): void => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Lenis owns the scroll, and it keeps focus where it was. Move it to the
      // first meaningful control so a keyboard user is not left at the bottom of
      // the document after the view has jumped to the top.
      document
        .querySelector<HTMLElement>("main a, main button, main h1, .landing-nav a")
        ?.focus();
    };
    top.addEventListener("click", onClick);
    disposers.push(() => top.removeEventListener("click", onClick));
  }

  return () => disposers.forEach((fn) => fn());
}
