import { h, svg, wordmark } from "./dom";

/**
 * Copy follows one rule set throughout: sentence case, two to four words per
 * headline, terminal punctuation doing real rhythmic work, second person, and a
 * tricolon in most paragraphs. The "quick, quiet, exact" shape is the house
 * voice - it is also what makes a security pitch stop reading like a spec.
 */

const KICKERS = {
  problem: "The problem",
  pipeline: "The pipeline",
  capability: "What it does",
  evaluation: "Evaluation",
} as const;

const TILES = [
  {
    index: "01",
    title: "One complaint. One record.",
    body: "NCRP, I4C, a bank portal, or a hand-typed FIR — they all land in the same normalised record, carrying the transaction trail with them.",
    meta: ["Source: CFCFRMS", "Dedup on ack ID"],
  },
  {
    index: "02",
    title: "Every ATM nearby.",
    body: "We pull every active machine inside the search radius, then cut it by distance, state and recent activity. Nothing gets scored until it survives that cut.",
    meta: ["Radius 5 km", "H3 resolution 8"],
  },
  {
    index: "03",
    title: "Ranked, with a window.",
    body: "A classifier scores each survivor and a separate regressor estimates minutes-to-cash-out. You get a place to go, and how long you have to get there.",
    meta: ["Horizons 30–720 min", "Top-K = 5"],
  },
  {
    index: "04",
    title: "One brief, wherever it lands.",
    body: "The prediction fans out to the console, a webhook, or email. Cross-state hops stop being the place investigations quietly stall.",
    meta: ["Webhook or email", "Audit logged"],
  },
];

const CAPABILITIES = [
  {
    title: "Cross-state trails",
    body: "Victim in Delhi, cash-out in Rajasthan. The hop chain across a state border is exactly where the old process used to stall.",
  },
  {
    title: "Burst heat, not just score",
    body: "An unsupervised layer flags machines with abnormal recent withdrawal counts, independent of where any single case happened to rank.",
  },
  {
    title: "Honest attribution",
    body: "Every score ships with the feature values behind it. No opaque ranking handed to a duty officer without a reason string attached.",
  },
  {
    title: "Ranked, not directive",
    body: "This is intelligence for an authorised human. It never tells a patrol team what action to take, and it does not need to.",
  },
  {
    title: "Recall per event",
    body: "Retrieval quality is scored against held-out cash-outs rather than a flattering aggregate. Top-5 recall is the number that matters.",
  },
  {
    title: "Nothing faked",
    body: "When a provider key is absent, the fan-out says so. A prediction that cannot be delivered is never dressed up as delivered.",
  },
];

const METRICS = [
  { value: 0.78, dp: 2, suffix: "", label: "ROC-AUC", note: "60-minute horizon" },
  { value: 50.8, dp: 1, suffix: "%", label: "Top-5 recall", note: "Held-out test split" },
  { value: 38, dp: 0, suffix: " min", label: "Time MAE", note: "Minutes to cash-out" },
  { value: 4, dp: 0, suffix: "", label: "Horizons", note: "30 / 60 / 240 / 720 min" },
];

const RAILS = [
  ["Top-5 recall 50.8%", "Overall recall 82.4%", "ROC-AUC 0.78", "Time MAE 38 min", "H3 resolution 8"],
  ["Model XGB v0.5.0", "Horizons 30–720 min", "Top-K = 5", "Cross-state trails on"],
  ["LEA · Bank · I4C", "Audit logged", "Authorised use only", "No live banking connections"],
];

const CAPTIONS = [
  "Fast, explained rankings",
  "One lead, every case",
  "Built for cross-state work",
];

/** A hand-drawn marker underline, the way a word gets circled in a brief. */
function scribble(word: string | Node): HTMLElement {
  return h("span", { class: "scribble" }, word);
}

const NAV_ITEMS = [
  { label: "Pipeline", href: "#pipeline", index: "01" },
  { label: "Capabilities", href: "#capabilities", index: "02" },
  { label: "Evaluation", href: "#evaluation", index: "03" },
];

/**
 * The console header, rebuilt for a page with no router.
 *
 * Structure, type and spacing are lifted from
 * src/app/components/layout/TopNav.tsx so both ends of the product read as one
 * piece: same 64px full-bleed bar, same two-line brand lockup, same caps
 * labels, same hairline action cluster, same scrollable row on narrow screens.
 *
 * The one thing it cannot copy is the active-route underline. React Router
 * hands TopNav an `isActive` flag for free; anchor links have no route, so
 * setupNavSpy() in motion.ts derives the same state from scroll geometry and
 * toggles .is-active. The markup keeps the identical underline element so the
 * rule stays in the stylesheet either way.
 *
 * .landing-nav is kept on the header because the intro timeline and the nav
 * spy both select on it.
 */
function nav(): HTMLElement {
  return h(
    "header",
    { class: "landing-nav fixed inset-x-0 top-0 bg-transparent backdrop-blur-md" },
    h(
      "div",
      {
        class: "mx-auto flex h-16 max-w-[110rem] items-center justify-between gap-8 px-5 sm:px-8",
      },
      h(
        "a",
        {
          href: "/",
          class: "group flex items-center gap-3 text-accent",
          "aria-label": "PurvaDrishti home",
        },
        wordmark(34),
        h(
          "span",
          { class: "flex flex-col leading-none" },
          h(
            "span",
            {
              class: "text-[0.9375rem] font-semibold tracking-[-0.03em] text-ink",
            },
            "PurvaDrishti",
          ),
          h("span", { class: "eyebrow mt-1" }, "Cash-out intelligence"),
        ),
      ),
      h(
        "nav",
        { class: "hidden items-center gap-1 md:flex", "aria-label": "Sections" },
        ...NAV_ITEMS.map((item) =>
          h(
            "a",
            {
              href: item.href,
              "data-nav-link": "",
              class: "nav-link group relative px-4 py-2 transition-colors duration-200",
            },
            h("span", { class: "label-caps" }, item.label),
            h("span", {
              class: "nav-underline absolute inset-x-4 -bottom-px h-px origin-left bg-accent transition-transform duration-300",
            }),
          ),
        ),
      ),
      h(
        "div",
        { class: "flex items-center gap-2" },
        h(
          "div",
          {
            class: "label-caps hidden items-center gap-2 rounded-full border border-hairline px-3 py-2 text-muted sm:flex",
          },
          h(
            "span",
            { class: "relative inline-flex size-1.5" },
            h("span", {
              class: "animate-ping-slow absolute inset-0 rounded-full bg-stable",
            }),
            h("span", { class: "relative size-1.5 rounded-full bg-stable" }),
          ),
          "Live",
        ),
        // Real document navigation, not React Router - this has to tear the whole
        // runtime down so the console starts on a clean page.
        //
        // Trailing slash is load-bearing: dashboard/ is a directory on disk, and
        // only ".../dashboard/" resolves to dashboard/index.html. A bare
        // /dashboard 404s on a static host and falls back to the landing page
        // locally.
        h(
          "a",
          {
            href: "/dashboard/",
            class: "label-caps rounded-md border border-hairline px-3 py-2 text-muted transition-colors duration-200 hover:border-[#2e2e3a] hover:bg-white/[0.03] hover:text-ink",
          },
          "Enter console",
        ),
      ),
    ),
    // data-lenis-prevent matters more here than on the console: this row is a
    // horizontal scroller, and without it Lenis swallows the wheel and the row
    // cannot be panned sideways.
    h(
      "nav",
      {
        "data-lenis-prevent": "",
        class: "flex items-center gap-1 overflow-x-auto border-t border-transparent px-5 md:hidden",
        "aria-label": "Sections",
      },
      ...NAV_ITEMS.map((item) =>
        h(
          "a",
          {
            href: item.href,
            "data-nav-link": "",
            class: "nav-link label-caps whitespace-nowrap border-b-2 px-3 py-3 transition-colors",
          },
          h("span", { class: "mr-2 text-accent" }, item.index),
          item.label,
        ),
      ),
    ),
  );
}

/**
 * The hero's right-hand stack. A single complaint in, a ranked list out — the
 * same shape the console shows, run early enough to still be worth something.
 */
const HERO_CARDS = [
  {
    venue: "HDFC ATM, Nehru Place",
    note: "Two hops from the last confirmed withdrawal, both before noon.",
    score: "0.94",
    window: "14:00 - 17:00",
  },
  {
    venue: "State Bank ATM, C-Scheme",
    note: "Withdrawal burst across four accounts in the same forty minutes.",
    score: "0.88",
    window: "16:00 - 19:00",
  },
  {
    venue: "Axis ATM, Banaras Road",
    note: "Complaint filed in Delhi, cash expected well south of it.",
    score: "0.81",
    window: "11:00 - 13:00",
  },
  {
    venue: "ICICI ATM, Sector 18",
    note: "Rank held steady overnight; no competing burst in range.",
    score: "0.76",
    window: "19:00 - 22:00",
  },
] as const;

function hero(): HTMLElement {
  return h(
    "section",
    { class: "hero", id: "top" },
    h(
      "div",
      { class: "hero-inner" },
      h(
        "div",
        { class: "hero-copy" },
        h(
          "h1",
          { class: "display hero-title" },
          "Purva",
          h("span", { class: "text-accent" }, "Drishti"),
        ),
        h(
          "p",
          { class: "hero-lede" },
          "Fraud funds surface as cash within hours, somewhere in India. PurvaDrishti turns one victim complaint into a ranked list of probable ATMs, and a predicted withdrawal window, before the cash is gone.",
        ),
        h(
          "div",
          { class: "hero-actions" },
          h("a", { href: "/dashboard/", class: "btn btn-primary" }, "Enter the console", h("span", { class: "btn-arrow" }, "→")),
          h("a", { href: "#pipeline", class: "btn btn-secondary" }, "See how it works"),
        ),
        h(
          "dl",
          { class: "hero-stats" },
          ...[
            ["Top-5 recall", "50.8%"],
            ["Time MAE", "38 min"],
            ["Horizons", "4"],
          ].flatMap(([label, value]) => [
            h("div", {}, h("dt", { class: "stat-label" }, label), h("dd", { class: "stat-value tnum" }, value)),
          ]),
        ),
      ),
        h(
          "div",
          { class: "hero-swap" },
          h(
            "div",
            { class: "swap-stack", id: "hero-swap", "aria-label": "Sample ranked predictions" },
            ...HERO_CARDS.map((card, i) =>
              h(
                "article",
                { class: "swap-card", "data-swap-card": "", tabindex: "0", role: "button", "aria-label": `Prediction ${i + 1} of ${HERO_CARDS.length}: ${card.venue}. Show the next prediction.` },
                h("span", { class: "card-chip", "aria-hidden": "true" }, String(i + 1).padStart(2, "0")),
                h("h2", { class: "card-title" }, card.venue),
                h("p", { class: "body-md" }, card.note),
                h(
                  "div",
                  { class: "swap-card-meta" },
                  h("span", { class: "stat-label" }, "Confidence"),
                  h("span", { class: "swap-card-score tnum" }, card.score),
                  h("span", { class: "stat-label" }, "Window"),
                  h("span", { class: "tnum" }, card.window),
                ),
            ),
          ),
        ),
      ),
    ),
    h("div", { class: "scroll-cue", "aria-hidden": "true" }, h("span", { class: "scroll-cue-line" }), h("span", { class: "stat-label" }, "Scroll")),
  );
}

/** Sticky statement on the left, the argument scrolling past it on the right. */
function problem(): HTMLElement {
  return h(
    "section",
      { class: "section split stack-panel accent-band", id: "problem" },
    h(
      "div",
      { class: "shell split-grid" },
      h(
        "div",
        { class: "split-aside" },
        h("p", { class: "kicker" }, KICKERS.problem),
        h(
          "h1",
          { class: "display split-title" },
          "A race, run across state lines.",
        ),
      ),
      h(
        "div",
        { class: "split-body" },
        h(
          "p",
          { class: "body-lg" },
          "By the time a complaint reaches an investigator the money is usually already gone, sometimes withdrawn in a different state from the victim. The trail lives on the transaction, not the complaint.",
        ),
        h(
          "p",
          { class: "body-lg" },
          "Ranking where that trail surfaces, and when, is the entire job. So we built one system that does exactly that: fast, explainable, and honest about what it does not know.",
        ),
      ),
    ),
  );
}

/** The signature move: stacked full-width tiles that parallax past each other. */
function pipeline(): HTMLElement {
  return h(
    "section",
      { class: "section tiles stack-panel", id: "pipeline" },
    h(
      "div",
      { class: "shell" },
      h("p", { class: "kicker" }, KICKERS.pipeline),
      h(
        "h2",
        { class: "display section-title" },
        "Four steps, ",
        scribble("one ranked window."),
      ),
    ),
    h(
      "div",
      { class: "shell tile-rail" },
      ...TILES.map((tile, i) =>
        h(
          "article",
          { class: `tile tile-${i % 2 ? "right" : "left"}` },
          h("span", { class: "tile-index tnum" }, tile.index),
          h("h3", { class: "tile-title" }, tile.title),
          h("p", { class: "body-md" }, tile.body),
          h(
            "ul",
            { class: "tile-meta" },
            ...tile.meta.map((m) => h("li", { class: "chip" }, m)),
          ),
        ),
      ),
    ),
  );
}

function capabilities(): HTMLElement {
  return h(
    "section",
      { class: "section stack-panel accent-band", id: "capabilities" },
    h(
      "div",
      { class: "shell" },
      h("p", { class: "kicker" }, KICKERS.capability),
      h(
        "h2",
        { class: "display section-title" },
        "Built for the duty officer, not the demo.",
      ),
      h(
        "div",
        { class: "cards" },
        ...CAPABILITIES.map((cap, i) =>
          h(
            "article",
            { class: "card" },
            h("span", { class: "card-chip", "aria-hidden": "true" }, String(i + 1).padStart(2, "0")),
            h("h3", { class: "card-title" }, cap.title),
            h("p", { class: "body-md" }, cap.body),
          ),
        ),
      ),
    ),
  );
}

/** Oversized numerals, the way a numbers slide earns trust. */
function evaluation(): HTMLElement {
  return h(
    "section",
      { class: "section numbers stack-panel", id: "evaluation" },
    h(
      "div",
      { class: "shell numbers-grid" },
      h(
        "div",
        { class: "numbers-aside" },
        h("p", { class: "kicker" }, KICKERS.evaluation),
        h(
          "h2",
          { class: "display numbers-title" },
          "A few numbers behind the ",
          scribble("ranking."),
        ),
        h(
          "p",
          { class: "body-md numbers-note" },
          "Ranked intelligence for authorised human decision-makers — not a directive for field action. No live banking, NCRP or I4C systems are connected to this build.",
        ),
      ),
      h(
        "div",
        { class: "numbers-list" },
        ...METRICS.map((m, i) =>
          h(
            "article",
            { class: "metric-card" },
            h(
              "span",
              { class: "display metric-value tnum", "data-count": m.value, "data-count-dp": m.dp, "data-count-suffix": m.suffix },
              `0${m.suffix}`,
            ),
            h("span", { class: "metric-label" }, m.label),
            h("span", { class: "metric-note" }, m.note),
            h("span", { class: "metric-chip", "aria-hidden": "true" }, String(i + 1).padStart(2, "0")),
          ),
        ),
      ),
    ),
  );
}

/** Three marquee rails of pill chips, drifting at different speeds. */
function rails(): HTMLElement {
  return h(
    "section",
      { class: "section rails stack-panel", id: "rails" },
    h(
      "div",
      { class: "shell" },
      h(
        "h2",
        { class: "display rails-title" },
        "Built for the people who answer.",
      ),
      h(
        "p",
        { class: "body-lg rails-lede" },
        "A duty officer, a bank liaison, an analyst at a control room. Same ranking, same reasons, same audit trail.",
      ),
    ),
    ...RAILS.map((items, r) =>
      h(
        "div",
        { class: "rail", "aria-hidden": "true", "data-speed": (0.4 + r * 0.25).toFixed(2) },
        h(
          "div",
          { class: "rail-track" },
          ...[0, 1].map(() =>
            h(
              "div",
              { class: "rail-group" },
              ...items.map((t) => h("span", { class: "rail-pill" }, t)),
            ),
          ),
        ),
      ),
    ),
    h(
      "div",
      { class: "shell" },
      h(
        "div",
        { class: "captions" },
        ...CAPTIONS.map((c) => h("span", { class: "caption" }, c)),
      ),
    ),
  );
}

function close(): HTMLElement {
  return h(
    "section",
    { class: "section close" },
    h(
      "div",
      { class: "close-band" },
      h("h2", { class: "display close-title" }, "Ready when you are."),
      h(
        "p",
        { class: "close-lede" },
        "Sign in and run a case through the model. No live systems are touched, and every prediction you see is auditable.",
      ),
      h(
        "a",
        { href: "/dashboard/", class: "btn btn-dark btn-lg" },
        "Enter the console",
        h("span", { class: "btn-arrow" }, "→"),
      ),
    ),
  );
}

/** Handling rules, mirroring PageFooter's HANDLING list. */
const FOOTER_HANDLING = [
  "Authorised use only",
  "Every action audit logged",
  "No live banking, NCRP or I4C connections",
  "Case data does not leave this deployment",
];

/** The same tone scale StatusPill draws, spelled out. */
const FOOTER_STATUS = [
  { tone: "accent", label: "Open", detail: "Logged, not yet worked" },
  { tone: "elevated-risk", label: "Investigating", detail: "Assigned and in progress" },
  { tone: "critical", label: "Escalated", detail: "Needs supervisor attention" },
  { tone: "faint", label: "Closed", detail: "Outcome recorded" },
];

const FOOTER_LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#evaluation", label: "Evaluation" },
  { href: "#rails", label: "Built for" },
  { href: "/dashboard/", label: "Enter console" },
];

/**
 * The Lusion reference layout, ported to the landing's own hyperscript.
 *
 * The console has this footer in React (see app/components/layout/PageFooter),
 * but the landing page ships no React on purpose, so this is the same structure
 * written against `h` instead of JSX. The two are kept in step deliberately -
 * same zones, same wordmark treatment, same accent.
 */
function footer(): HTMLElement {
  return h(
    "footer",
    { class: "landing-footer" },

    // Decorative glow. aria-hidden so the blurred blobs stay out of the
    // accessibility tree - there is nothing in them to read.
    h("div", { class: "footer-glow footer-glow-a", "aria-hidden": "true" }),
    h("div", { class: "footer-glow footer-glow-b", "aria-hidden": "true" }),

    // The wordmark leads, above the telemetry row. Set at display size it reads
    // as the heading of the footer rather than a sign-off at the bottom of it,
    // and the clocks settle underneath it instead of the page ending on a
    // telemetry panel. A paragraph rather than a heading: the hero already owns
    // the h1, and a second one here would compete with it in the outline.
    h(
      "p",
      { class: "footer-wordmark", "aria-label": "PurvaDrishti" },
      "PURVADRISHTI",
      h("span", { class: "footer-wordmark-dot", "aria-hidden": "true" }, "."),
    ),

    h(
      "div",
      { class: "footer-block" },
      // Operational, not promotional. This used to be a "Global telemetry
    // clocks" row naming a model host in one timezone with audit and review
    // desks in two others - a distributed footprint this deployment does not
    // have. What a user of a law-enforcement console needs before handling a
    // case is the handling rules, so that is what it says.

      h(
        "div",
        { class: "footer-telemetry" },
        h(
          "p",
          { class: "footer-label" },
          svg(
            "svg",
            {
              viewBox: "0 0 24 24",
              width: 16,
              height: 16,
              fill: "none",
              stroke: "currentColor",
              "stroke-width": 1.5,
              "aria-hidden": "true",
            },
            svg("path", {
              d: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z",
            }),
            svg("path", { d: "M9 12l2 2 4-4" }),
          ),
          "Handling",
        ),
        h(
          "ul",
          { class: "footer-handling" },
          ...FOOTER_HANDLING.map((rule) =>
            h("li", { class: "footer-handling-item" }, rule),
          ),
        ),
      ),

      h(
        "nav",
        { class: "footer-cols", "aria-label": "Sections" },
        h("p", { class: "footer-head" }, "Navigate"),
        h(
          "ul",
          { class: "footer-links" },
          ...FOOTER_LINKS.map((link, i) =>
            h(
              "li",
              {},
              h(
                "a",
                { class: "footer-link", href: link.href },
                h("span", { class: "footer-link-index" }, String(i + 1).padStart(2, "0")),
                ` / ${link.label}`,
              ),
            ),
          ),
        ),
      ),

      h(
        "div",
        { class: "footer-cols" },
        h("p", { class: "footer-head" }, "Case status"),
        h(
          "dl",
          { class: "footer-status" },
          ...FOOTER_STATUS.flatMap((entry) => [
            h(
              "div",
              { class: "footer-status-row" },
              h("dt", { class: `footer-status-dot footer-status-dot-${entry.tone}` }),
              h("dd", { class: "footer-status-text" }, entry.label, " — ", entry.detail),
            ),
          ]),
        ),
        h("p", { class: "footer-head footer-head-gap" }, "Built with"),
        h("p", { class: "footer-body" }, "XGBoost · H3 geospatial · FastAPI · React · Three.js"),
      ),
    ),

    h(
      "div",
      { class: "footer-meta" },
      h(
        "p",
        { class: "footer-meta-line" },
        "Predictive cash-out intelligence",
      ),
      h(
        "p",
        { class: "footer-meta-line" },
        "For authorised human decision-makers. ",
        h(
          "button",
          {
            class: "footer-top",
            type: "button",
            "data-footer-top": "",
          },
          "Back to top ",
          h("span", { "aria-hidden": "true" }, "→"),
        ),
      ),
    ),
  );
}

export function renderLanding(): HTMLElement {
  return h(
    "div",
    // main.ts replaces the #landing mount point with this root, so the id has
    // to travel with it. Without it the `#landing { z-index: 1 }` rule in
    // landing.css matches nothing and the fixed WebGL canvas ends up relying on
    // DOM order alone to stay behind the content.
    { id: "landing" },
    nav(),
    h("main", {}, hero(), problem(), pipeline(), capabilities(), evaluation(), rails(), close()),
    footer(),
  );
}
