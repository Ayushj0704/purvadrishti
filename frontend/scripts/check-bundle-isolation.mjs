import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fails the build if a landing-page-only library ever leaks into the console
 * bundle. The multi-page split is only worth anything if it stays a split, and
 * a stray `import Lenis from "lenis"` in a console component is exactly the
 * kind of regression nobody notices until the payload doubles.
 */

const DIST = "dist/assets";

// Minified, so match on strings the bundler cannot rename away.
//
// `gl_PointSize` is deliberately NOT used as a Three.js marker: it is a GLSL
// keyword that appears in any hand-written point shader, including a raw WebGL
// one that does not use the library at all.
//
// THREE_REVISION is only an *absent* marker. It is an unused export, so the
// bundler tree-shakes it away even when Three.js is present — its presence
// means the library leaked, but its absence proves nothing.
const FORBIDDEN_IN_APP = {
  lenis: ["lenis-smooth", "lenis-stopped", "virtual-scroll"],
  three: ["THREE_REVISION", "WebGLRenderer", "ShaderMaterial", "BufferGeometry"],
  gsap: ["ScrollTrigger", "power3.out", "autoAlpha", "lagSmoothing"],
};

// Signatures that must actually survive minification in the landing bundle,
// because landing code calls them directly.
const REQUIRED_IN_LANDING = {
  three: ["WebGLRenderer", "ShaderMaterial"],
  gsap: ["ScrollTrigger", "autoAlpha", "lagSmoothing"],
  lenis: ["lenis-smooth", "virtual-scroll"],
};

const files = readdirSync(DIST);
const appJs = files.filter((f) => f.startsWith("app-") && f.endsWith(".js"));
const landingJs = files.filter((f) => f.startsWith("landing-") && f.endsWith(".js"));

if (appJs.length !== 1 || landingJs.length !== 1) {
  console.error(
    `Expected exactly one app-*.js and one landing-*.js in ${DIST}, found ` +
      `${appJs.length} and ${landingJs.length}. Did the rollupOptions.input change?`,
  );
  process.exit(1);
}

const app = readFileSync(join(DIST, appJs[0]), "utf8");
const landing = readFileSync(join(DIST, landingJs[0]), "utf8");

const failures = [];

for (const [pkg, signatures] of Object.entries(FORBIDDEN_IN_APP)) {
  for (const sig of signatures) {
    if (app.includes(sig)) failures.push(`${pkg} ("${sig}") leaked into ${appJs[0]}`);
  }
}

for (const [pkg, signatures] of Object.entries(REQUIRED_IN_LANDING)) {
  for (const sig of signatures) {
    if (!landing.includes(sig)) {
      failures.push(`${pkg} ("${sig}") is missing from ${landingJs[0]} — expected it there`);
    }
  }
}

// The dashboard HTML must not even reference the landing entry's assets.
const dashHtml = readFileSync(join("dist/dashboard/index.html"), "utf8");
if (/landing-/.test(dashHtml)) {
  failures.push("dist/dashboard/index.html references a landing-*. asset");
}

const landingHtml = readFileSync(join("dist/index.html"), "utf8");
if (/assets\/app-/.test(landingHtml)) {
  failures.push("dist/index.html references an app-*. asset");
}

if (failures.length) {
  console.error("\nBundle isolation check FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

const kb = (s) => `${(readFileSync(join(DIST, s), "utf8").length / 1024).toFixed(0)} kB`;
console.log(
  `Bundle isolation OK — landing ${kb(landingJs[0])} (three/gsap/lenis), ` +
    `app ${kb(appJs[0])} (none of them).`,
);
