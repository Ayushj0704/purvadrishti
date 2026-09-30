import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const CONSOLE_PREFIX = "/dashboard";

/**
 * Serves dashboard/index.html for client-side routes under /dashboard/.
 *
 * The console is a client-routed SPA, so /dashboard/alerts and
 * /dashboard/cases/42 are not files on disk — they only exist once React
 * Router has matched them. With appType: "mpa" there is no html fallback, so
 * without this a refresh on any in-app route would 404.
 *
 * This rewrites the request to "/dashboard/" and lets Vite (or sirv, in
 * preview) serve the entry normally, which keeps HMR and the built asset
 * hashes intact. Requests that look like files are left alone so genuinely
 * missing assets still 404 instead of silently returning HTML.
 */
function consoleEntryFallback(): Plugin {
  const rewrite = (req: { url?: string }) => {
    if (!req.url) return;
    const path = req.url.split("?")[0];
    if (path === CONSOLE_PREFIX) {
      req.url = "/dashboard/";
    } else if (path.startsWith(`${CONSOLE_PREFIX}/`)) {
      const rest = path.slice(CONSOLE_PREFIX.length + 1);
      // A dot in the last segment means it is an asset request, not a route.
      if (!rest.includes(".")) req.url = "/dashboard/";
    }
  };

  return {
    name: "purva:console-entry-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
}

/**
 * Two independent entry points, two independent dependency graphs.
 *
 *   landing  -> index.html            heavy: Three.js, GSAP, Lenis
 *   app      -> dashboard/index.html  light: React, Recharts, MapLibre
 *
 * The landing links to the console with a plain <a href="/dashboard/">, which is
 * a real document navigation. That tears down the whole JS runtime — every
 * WebGL context, every GSAP timeline, the Lenis rAF loop — so the console
 * starts on a genuinely fresh page. Nothing is torn down after the fact
 * because the console bundle never references those packages in the first
 * place; scripts/check-bundle-isolation.mjs fails the build if that ever
 * changes.
 */
export default defineConfig({
  plugins: [react(), consoleEntryFallback()],
  // `mpa` disables the SPA html-fallback. With the default `spa`, a request
  // like /dashboard that does not resolve to a file silently falls back to the
  // root index.html and shows the *landing page* at the console URL. Failing
  // loudly is strictly better than shipping the wrong document.
  appType: "mpa",
  // maplibre-gl ships an ES module web worker; emit it as one so the runtime
  // `new Worker(url, { type: "module" })` succeeds.
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "dashboard/index.html"),
      },
    },
  },
  server: {
    // /dashboard is a real directory in dev too, so the two entries behave the
    // same way in `vite dev` and in `vite build`.
    fs: { allow: [".."] },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
