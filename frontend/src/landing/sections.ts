import { h, wordmark } from "./dom";

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
  { value: 82.4, dp: 1, suffix: "%", label: "Top-5 recall", note: "Held-out test split" },
  { value: 38, dp: 0, suffix: " min", label: "Time MAE", note: "Minutes to cash-out" },
  { value: 4, dp: 0, suffix: "", label: "Horizons", note: "30 / 60 / 240 / 720 min" },
];

const RAILS = [
  ["Top-5 recall 82.4%", "ROC-AUC 0.78", "Time MAE 38 min", "H3 resolution 8", "Radius 5 km"],
  ["Model XGB v0.2.0", "Horizons 30–720 min", "Top-K = 5", "Cross-state trails on"],
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

function nav(): HTMLElement {
  return h(
    "header",
    { class: "landing-nav" },
    h(
      "a",
      { href: "/", class: "nav-brand", "aria-label": "PurvaDrishti home" },
      wordmark(26),
      h("span", { class: "nav-brand-name" }, "PurvaDrishti"),
    ),
    h(
      "nav",
      { class: "nav-links" },
      ...[
        ["Pipeline", "#pipeline"],
        ["Capabilities", "#capabilities"],
        ["Evaluation", "#evaluation"],
      ].map(([label, href]) => h("a", { href, class: "nav-link" }, label)),
    ),
    // Real document navigation, not React Router - this has to tear the whole
    // runtime down so the console starts on a clean page.
    //
    // Trailing slash is load-bearing: dashboard/ is a directory on disk, and
    // only ".../dashboard/" resolves to dashboard/index.html. A bare /dashboard
    // 404s on a static host and falls back to the landing page locally.
    h("a", { href: "/dashboard/", class: "btn btn-primary btn-sm" }, "Enter console"),
  );
}

function hero(): HTMLElement {
  return h(
    "section",
    { class: "hero", id: "top" },
    h(
      "div",
      { class: "hero-inner" },
      h("p", { class: "kicker" }, "Smart India Hackathon 26"),
      h(
        "h1",
        { class: "display hero-title" },
        "The money moves.",
        h("br"),
        h("span", { class: "text-accent" }, "You have hours."),
      ),
      h(
        "p",
        { class: "hero-lede" },
        "Fraud funds surface as cash within hours, somewhere in India. PurvaDrishti turns one victim complaint into a ranked list of probable ATMs, and a predicted withdrawal window — before the cash is gone.",
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
          ["Top-5 recall", "82.4%"],
          ["Time MAE", "38 min"],
          ["Horizons", "4"],
        ].flatMap(([label, value]) => [
          h("div", {}, h("dt", { class: "stat-label" }, label), h("dd", { class: "stat-value tnum" }, value)),
        ]),
      ),
    ),
    h("div", { class: "scroll-cue", "aria-hidden": "true" }, h("span", { class: "scroll-cue-line" }), h("span", { class: "stat-label" }, "Scroll")),
  );
}

/** Sticky statement on the left, the argument scrolling past it on the right. */
function problem(): HTMLElement {
  return h(
    "section",
      { class: "section split stack-panel", id: "problem" },
    h(
      "div",
      { class: "shell split-grid" },
      h(
        "div",
        { class: "split-aside" },
        h("p", { class: "kicker" }, KICKERS.problem),
        h(
          "h2",
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
          "By the time a complaint reaches an investigator the money is usually already gone — sometimes withdrawn in a different state from the victim. The trail lives on the transaction, not the complaint.",
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
      { class: "section stack-panel", id: "capabilities" },
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
      { class: "section rails stack-panel" },
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
      h("p", { class: "kicker" }, "Ready"),
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

function footer(): HTMLElement {
  return h(
    "footer",
    { class: "landing-footer" },
    h(
      "div",
      { class: "footer-block" },
      h(
        "div",
        { class: "footer-lead" },
        wordmark(22),
        h("p", { class: "footer-pitch" }, "Predictive cash-out intelligence for Indian law enforcement. Built at Smart India Hackathon 26."),
      ),
      h(
        "div",
        { class: "footer-cols" },
        h("p", { class: "footer-head" }, "Built with"),
        h("p", { class: "footer-body" }, "XGBoost · H3 geospatial · FastAPI · React · Three.js"),
      ),
      h(
        "div",
        { class: "footer-cols" },
        h("p", { class: "footer-head" }, "Scope"),
        h("p", { class: "footer-body" }, "Authorised use only · Audit logged · No live banking connections"),
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
