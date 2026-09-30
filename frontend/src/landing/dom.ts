/** Minimal hyperscript. A marketing page does not justify shipping React. */

type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(key, value === true ? "" : String(value));
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }

  return el;
}

/** Namespaced SVG, since createElement would emit an unknown HTML element. */
export function svg(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return el;
}

/** The nav mark. Same asset as the tab favicon and the console's
 *  `Wordmark` component (`/logo.png`), so the mark, the favicon and the
 *  console navbar are one identity rather than three. It was an inline SVG
 *  reticle before, which is why the tab showed the real logo and the navbar
 *  did not.
 *
 *  `aria-hidden` because the wrapping link already carries
 *  `aria-label="PurvaDrishti home"`; the `alt` is there for a bare <img> but
 *  is moot to assistive tech while the image is hidden. The asset is 217x216,
 *  so forcing a square box costs a sub-pixel distortion. */
export function wordmark(size: number): HTMLElement {
  return h("img", {
    src: "/logo.png",
    alt: "PurvaDrishti",
    width: size,
    height: size,
    "aria-hidden": "true",
  });
}

/** Wraps every word in its own span so the intro can stagger them in. */
export function splitWords(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  text.split(" ").forEach((word, i) => {
    if (i > 0) frag.append(" ");
    frag.append(h("span", { class: "split-word" }, word));
  });
  return frag;
}
