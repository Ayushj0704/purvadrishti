import "./landing.css";
import { initCardSwap } from "./cardSwap";
import { initFooter } from "./footer";
import { createField } from "./gl/createField";
import { createLenis, initMotion } from "./motion";
import { initRails } from "./rails";
import { renderLanding } from "./sections";

const mount = document.getElementById("landing");
if (!mount) throw new Error("Landing mount point missing");

mount.replaceWith(renderLanding());

// ------------------------------------------------------------------ CardSwap --

const swapRoot = document.getElementById("hero-swap");
const disposeSwap = swapRoot ? initCardSwap(swapRoot, { pauseOnHover: true }) : null;

// --------------------------------------------------------------------- rails --

// Sizing only: the motion stays in CSS. Called after the mount so the rails can
// be measured against a laid-out viewport.
const disposeRails = initRails();

// ------------------------------------------------------------------- footer --

// The footer clocks and the back-to-top control. Runs its own interval, so it is
// disposed alongside the other two rather than left to outlive the page.
const disposeFooter = initFooter();

/* ------------------------------------------------------------------ WebGL -- */

const canvas = document.getElementById("gl-field") as HTMLCanvasElement | null;
const field = canvas ? createField(canvas) : null;

if (field) {
  let pointerX = 0;
  let pointerY = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );

  // One loop, ever. `running` is the single source of truth so the observer
  // below can never leave a second rAF chain running.
  const started = performance.now();
  let running = false;
  let frame = 0;

  const tick = (now: number) => {
    field.setPointer(pointerX, pointerY);
    field.render((now - started) / 1000);
    if (running) frame = requestAnimationFrame(tick);
  };

  const play = () => {
    if (running) return;
    running = true;
    frame = requestAnimationFrame(tick);
  };

  const pause = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  play();

  // A landing page left open in a background tab, or scrolled far past the
  // hero, should cost nothing. The canvas is position:fixed, so it never leaves
  // the viewport — this is purely about the tab being hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else play();
  });

  window.addEventListener("pagehide", () => {
    pause();
    field.dispose();
  });
}

// Scroll progress is the only channel from Lenis into the field.
initMotion(createLenis(), (progress) => field?.setProgress(progress));

// All of these run a rAF, a timer or an observer, so they are torn down together,
// outside the field block - the hero and the footer are on the page whether or not
// WebGL is available.
window.addEventListener("pagehide", () => {
  disposeSwap?.();
  disposeRails();
  disposeFooter();
});
