/**
 * The landing page's footer behaviour: back-to-top.
 *
 * The footer used to drive three ticking clocks from here as well. They are
 * gone - see the handling block in sections.ts for why. Only the disposer
 * pattern remains, and it still earns its place: the landing tears its WebGL
 * field down on pagehide (see main.ts), so any listener attached here has to be
 * removable with the rest of the page.
 */

export function initFooter(root: ParentNode = document): () => void {
  const disposers: Array<() => void> = [];

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
