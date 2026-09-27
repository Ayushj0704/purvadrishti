import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "lenis";

/**
 * Shared instance, so anything outside the tree (a future command palette, an
 * anchor helper) can drive the scroller without prop drilling.
 */
let instance: Lenis | null = null;

export function getLenis(): Lenis | null {
  return instance;
}

// Same curve as --ease-out-expo in index.css, so programmatic scrolls settle on
// the same easing as the CSS transitions elsewhere in the console. The t >= 1
// guard matters: the raw formula asymptotes to 0.999 and Lenis wants an exact 1.
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.05,
      easing: easeOutExpo,
      smoothWheel: true,
      // Not a scrolljacking demo: 1:1 wheel travel, only the easing is smoothed.
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      autoRaf: true,
      anchors: true,
      // A click mid-glide should plant the page, not keep coasting.
      stopInertiaOnNavigate: true,
      // Lenis drops its own smoothing when this matches and falls back to 1:1
      // scroll, so reduced-motion users need no second code path here.
      respectReducedMotion: true,
    });

    instance = lenis;

    return () => {
      lenis.destroy();
      instance = null;
    };
  }, []);

  // The router swaps the page without touching scroll, so without this a route
  // change inherits the previous route's offset — and any coast still in flight.
  useEffect(() => {
    instance?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return <>{children}</>;
}
