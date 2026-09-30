import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import * as Matter from "matter-js";

import { cn } from "../../lib/cn";
import "./FolderFloat.css";

const { Bodies, Body, Composite, Engine } = Matter;

const DEFAULT_ITEMS = [
  "Try a warmer palette",
  "Tighten the spacing",
  "Logo feels small",
  "Love the new hero",
];
const GAP = 12;
const DRAG_MIN = 4;
const ZONE_PAD = 8;

/** Pill metrics at scale 1; `pillSize` multiplies all of them together. */
const PILL = { h: 34, pad: 14, font: 13, row: 52, radius: 999, char: 6.8 };

/**
 * The file variant, for items that carry a note.
 *
 * The dashboard's four metrics are each an index, a label, a value AND a
 * qualifier — "of 41 cells matching filters". A pill only has room for two of
 * those, and a figure on the folder that disagrees with the banner under it is
 * worse than no figure at all. So an item with a note promotes itself to a
 * taller card that holds all three lines, and the label stops being truncated.
 *
 * `w` is a target, not a measurement. Sizing the card off its longest note gave
 * a 377px sheet, which four of them cannot fit across the folder's spread; the
 * qualifier wraps to a second line instead, and the fan stays readable.
 */
const FILE = { h: 108, pad: 15, font: 13, row: 124, radius: 12, char: 6.2, w: 208 };

type Dims = typeof PILL;

interface FloatItem {
  label: string;
  value: string;
  /** Qualifier line. Its presence on any item promotes every pill to a file. */
  note?: string;
  /** Short code shown ahead of the label, e.g. "A". */
  index?: string;
}

type FloatInput = string | FloatItem;

interface PaperSize {
  w: number;
  h: number;
}

interface Zone {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Drag {
  i: number;
  id: number;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  moved: boolean;
}

interface World {
  engine: Matter.Engine | null;
  bodies: Matter.Body[];
  sizes: PaperSize[];
  raf: number;
  last: number;
  t0: number;
  drag: Drag | null;
  zone: Zone | null;
  live: boolean;
}

export interface FolderFloatProps {
  /** The pills that float out. A string is its own value. */
  items?: FloatInput[];
  /** The line on the flap. */
  label?: string;
  /** The dimmer line under it. Empty counts the pills. */
  sublabel?: string;
  trigger?: "hover" | "click";
  defaultOpen?: boolean;
  closeOnSelect?: boolean;
  /** Once the pills land, a zero-gravity world takes over. */
  physics?: boolean;
  drift?: number;
  onSelect?: (value: string, index: number) => void;
  onOpenChange?: (open: boolean) => void;
  folderColor?: string;
  frontColor?: string;
  paperColor?: string;
  itemColor?: string;
  itemTextColor?: string;
  labelColor?: string;
  width?: number;
  height?: number;
  radius?: number;
  /** Half the widest the cloud may be, in px. Pills pack into rows within it. */
  spread?: number;
  lift?: number;
  /** Scales the pills themselves: height, padding and type grow together. */
  pillSize?: number;
  tilt?: number;
  flapAngle?: number;
  restAngle?: number;
  openDuration?: number;
  stagger?: number;
  bounce?: number;
  className?: string;
}

const jitter = (i: number) => {
  const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

const layout = (
  list: FloatItem[],
  spread: number,
  lift: number,
  tilt: number,
  sizes: PaperSize[],
  scale: number,
  dims: Dims,
  pitch: number,
  gutter: number,
) => {
  const g = gutter || GAP;
  const rows: Array<{ items: Array<{ i: number; pw: number }>; width: number }> = [];
  let row: Array<{ i: number; pw: number }> = [];
  let width = 0;
  list.forEach((item, i) => {
    const est = (dims.pad + Math.max(item.label.length, String(item.value).length) * dims.char) * scale;
    const pw = sizes[i]?.w ?? est;
    if (row.length && width + g + pw > spread * 2) {
      rows.push({ items: row, width });
      row = [];
      width = 0;
    }
    row.push({ i, pw });
    width += (row.length > 1 ? g : 0) + pw;
  });
  if (row.length) rows.push({ items: row, width });
  const pos: Array<{ x: number; y: number; r: number }> = [];
  rows.forEach((r, ri) => {
    let x = -r.width / 2;
    const shift = (ri % 2 ? 1 : -1) * Math.min(16, spread * 0.1);
    r.items.forEach(({ i, pw }) => {
      const j = jitter(i);
      pos[i] = {
        x: x + pw / 2 + shift + (j - 0.5) * 6,
        y: -lift - ri * pitch - j * 6,
        r: tilt * (j * 2 - 1),
      };
      x += pw + g;
    });
  });
  return pos;
};

export function FolderFloat({
  items = DEFAULT_ITEMS,
  label = "Design feedback",
  sublabel = "",
  trigger = "hover",
  defaultOpen = false,
  closeOnSelect = true,
  physics = true,
  drift = 0.5,
  onSelect,
  onOpenChange,
  folderColor = "#3f3f46",
  frontColor = "#52525b",
  paperColor = "#f5f5f5",
  itemColor = "#f5f5f5",
  itemTextColor = "#18181b",
  labelColor = "#f5f5f5",
  width = 200,
  height = 148,
  radius = 14,
  spread = 180,
  lift = 26,
  pillSize = 1,
  tilt = 8,
  flapAngle = 34,
  restAngle = 16,
  openDuration = 520,
  stagger = 45,
  bounce = 0.3,
  className,
}: FolderFloatProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [popped, setPopped] = useState(-1);
  const [live, setLive] = useState(false);
  const [sizes, setSizes] = useState<PaperSize[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const world = useRef<World>({
    engine: null,
    bodies: [],
    sizes: [],
    raf: 0,
    last: 0,
    t0: 0,
    drag: null,
    zone: null,
    live: false,
  });
  const latest = useRef<{
    onSelect?: (value: string, index: number) => void;
    onOpenChange?: (open: boolean) => void;
    drift: number;
    reduce: boolean;
  }>({ drift, reduce: false });
  latest.current = { onSelect, onOpenChange, drift, reduce: latest.current.reduce };
  const popTimer = useRef<number | undefined>(undefined);
  const liveTimer = useRef<number | undefined>(undefined);

  const list: FloatItem[] = items.map((item) =>
    typeof item === "string" ? { label: item, value: item } : item,
  );
  const n = list.length;
  const sub = sublabel || `${n} ${n === 1 ? "note" : "notes"}`;

  // Values are part of the key, not just labels: a live count changing from 9 to
  // 10 changes the card's measured width, and the layout packs rows by that width.
  const labelsKey = list.map((item) => `${item.index}${item.label}=${item.value}`).join("|");

  // One note on any item promotes the whole cloud to files. Mixing a pill and a
  // card in the same fan would make the taller one look like the broken one, so
  // the variant is decided once for the set rather than per item.
  const asFiles = list.some((item) => Boolean(item.note));
  const dims: Dims = asFiles ? FILE : PILL;

  // The cloud is centred on the folder but may be much wider than it, so cap the
  // spread to the space the host column actually has. Without this the cards
  // overflow a narrow viewport no matter how the caller sizes the folder.
  const [available, setAvailable] = useState<number | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const parent = root.parentElement;
    if (!parent) return;
    const measure = () => setAvailable(parent.clientWidth || null);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // File cards get a wider gutter than the default. The pill gap is sized for
  // chips that overlap slightly as they fan; sheets that size sit almost flush
  // and read as one block, which is the opposite of the fan this component
  // exists to do. Scaled off the column so it grows with the cards rather than
  // becoming a fixed gap that looks cramped on a wide screen and breaks the row
  // on a narrow one.
  const fileGutter = useMemo(() => {
    if (!asFiles || !available) return GAP;
    const ceiling = (available - 8) / 2;
    return Math.round(Math.min(40, Math.max(16, ceiling * 0.13)));
  }, [asFiles, available]);

  // A card has no intrinsic width once its text is allowed to wrap, so the
  // browser shrinks it to min-content and the note stacks into a tall ribbon.
  // Give it a target width, then cap that against the column it must fan into.
  //
  // The cap is deliberately half the budget rather than the whole thing. The row
  // packer in layout() starts a new row once `width + gutter + pw > spread * 2`,
  // and for file cards spread is the card width plus the gutter - so the widest
  // row it can ever accept is two cards. Capping against the full column let a
  // 245px card sit in a 240px half-budget, every card failed that test on its
  // own, and the set collapsed to one card per row: four rows climbing off the
  // top of the screen. Deriving the cap from the same two-across budget the
  // packer uses keeps the break test satisfiable at any column width.
  const fileWidth = useMemo(() => {
    if (!asFiles) return 0;
    const target = Math.round(FILE.w * pillSize);
    if (!available) return target;
    const budget = available - 8;
    const twoAcross = (budget - fileGutter) / 2 - 2;
    return Math.max(140, Math.min(target, twoAcross));
  }, [asFiles, available, fileGutter, pillSize]);

  // The spread is half the cloud's width, so it has to clear the widest card or
  // the row-break test can never fit two side by side. Capped too small it put
  // one card per row and the set climbed off the top of the screen. Cards set
  // their own floor (two across, plus the gutter); pills keep the caller's spread.
  const effSpread = useMemo(() => {
    if (!available) return spread;
    const ceiling = (available - 8) / 2;
    if (!asFiles) return Math.max(80, Math.min(spread, ceiling));
    // Two cards and a gutter, with a little slack so the break is not borderline.
    return Math.max(80, Math.min(fileWidth + fileGutter, ceiling));
  }, [available, asFiles, fileWidth, fileGutter, spread]);
  // How much room the cards have above them. Rows fan upward from the folder, so
  // a set that breaks into several rows grows toward the top of the screen; this
  // is the ceiling the row pitch has to respect.
  //
  // In fan mode this is measured from the items anchor, not the folder's top
  // edge. The anchor sits below the folder's top by the tab height, so
  // measuring the folder understated the headroom by that much and made the fit
  // guard shrink cards that already had room to spare - cards were dropping to
  // 72% on a 1600x1000 desktop for no reason.
  //
  // In compact mode the anchor is the grid below the folder, so measuring it
  // would compare the grid against itself and flip the decision back and forth.
  // The folder is the stable reference in both modes, so each mode measures the
  // element that supports it and the choice cannot oscillate.
  const [topRoom, setTopRoom] = useState(320);

  // Pack the rows first, then shrink the pitch if the stack would outgrow the
  // space above the folder. Shrinking rather than clipping keeps every card
  // reachable, and the row gap is floored so cards never overlap into mush.
  const pos0 = layout(list, effSpread, lift, tilt, sizes, pillSize, dims, dims.row * pillSize, asFiles ? fileGutter : GAP);
  const rowCount = pos0.length ? Math.max(1, Math.round((Math.abs(Math.min(...pos0.map((p) => p.y))) + lift) / (dims.row * pillSize))) : 1;
  const cardH = (sizes[0]?.h ?? dims.h * pillSize) || dims.h * pillSize;
  const maxPitch = rowCount > 1 ? Math.max(cardH + 8, (topRoom - lift - cardH) / (rowCount - 1)) : dims.row * pillSize;
  const pitch = Math.min(dims.row * pillSize, maxPitch);
  const pos = rowCount > 1 && pitch < dims.row * pillSize
    ? layout(list, effSpread, lift, tilt, sizes, pillSize, dims, pitch, asFiles ? fileGutter : GAP)
    : pos0;

  // Last line of defence. On a short viewport the folder can sit so low that
  // even a tight two-row stack is taller than the room above it, and no amount
  // of repacking fits - there is simply less than 300px between the folder and
  // the top edge. Rather than let the cards slide off (or overlap into an
  // unreadable pile), scale the entire cloud about the folder's own centre so it
  // always fits the space it has. Applied to the container, not the cards, so
  // positions and physics coordinates scale together and the fan keeps its
  // shape instead of every card shrinking in place and colliding.
  const stackTop = lift + (rowCount - 1) * pitch;
  const needed = stackTop + cardH;
  const fit = needed > topRoom
    ? Math.max(0.5, Math.min(1, (topRoom - cardH * 0.35) / needed))
    : 1;

  // Below roughly 0.7 the fan is no longer a fan - the cards are shrunken far
  // enough that the type stops being readable, which is a worse outcome than
  // cards overflowing. That happens on narrow layouts where the folder sits
  // close to the top of the screen and there is simply less room above it than
  // a single card occupies. There is no scale that fixes that, so the cloud
  // stops fanning and becomes an ordinary grid that flows below the folder,
  // where it can be as tall as it needs without leaving the viewport.
  //
  // The two thresholds are a dead band, not a mistake. Which element gets
  // measured depends on the mode, so a single threshold lets a viewport sitting
  // near the boundary oscillate between fan and grid on every scroll tick.
  // Requiring a clear margin to leave the grid, and a smaller one to enter it,
  // settles it in one direction.
  const compactRef = useRef(false);
  const compact = fit < (compactRef.current ? 0.78 : 0.7);
  compactRef.current = compact;

  // Re-measuring when the mode changes is deliberately NOT done here. The
  // compact grid makes this root taller, which moves the folder up the page,
  // which leaves even less room and so argues for compact again - a loop that
  // locked 1366x768 into the grid on a fresh load, where the fan fits
  // comfortably. Measuring once per layout, in fan terms, keeps the decision
  // independent of its own side effects.
  useEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const el = root.hasAttribute("data-compact")
        ? root.querySelector<HTMLElement>(".folder-float__folder")
        : anchorRef.current;
      if (!el) return;
      setTopRoom(Math.max(120, el.getBoundingClientRect().top - 8));
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const next = pillRefs.current
        .slice(0, n)
        .map((el) => (el ? { w: el.offsetWidth, h: el.offsetHeight } : null));
      if (next.some((s) => !s)) return;
      const sized = next as PaperSize[];
      setSizes((prev) =>
        prev.length === sized.length && prev.every((s, i) => s.w === sized[i].w && s.h === sized[i].h)
          ? prev
          : sized,
      );
    };
    measure();
    document.fonts?.ready.then(measure);
    // fileWidth and pillSize are in the deps on purpose. They decide the card's
    // real width, and the row packer below compares that width against the
    // column budget - so when either changes, the cached sizes are stale and
    // packing silently reverts to one card per row. That is what left the
    // metrics stacked in a single vertical column after a resize: 245px measured
    // at the old width, tested against a 240px budget, every card its own row.
  }, [n, labelsKey, fileWidth, pillSize]);

  const stopPhysics = useCallback(() => {
    const w = world.current;
    if (liveTimer.current) window.clearTimeout(liveTimer.current);
    if (w.raf) cancelAnimationFrame(w.raf);
    w.raf = 0;
    if (w.engine) {
      w.bodies.forEach((b, i) => {
        const el = pillRefs.current[i];
        if (!el) return;
        el.style.setProperty("--x", `${b.position.x.toFixed(1)}px`);
        el.style.setProperty("--y", `${(b.position.y - w.sizes[i].h / 2).toFixed(1)}px`);
      });
      Composite.clear(w.engine.world, false, true);
      Engine.clear(w.engine);
      w.engine = null;
    }
    w.bodies = [];
    w.drag = null;
    w.live = false;
    setLive(false);
  }, []);

  const startPhysics = useCallback(() => {
    const w = world.current;
    if (w.engine) return;
    // The compact layout is a static grid: the engine writes per-card x/y
    // transforms, which would drag the cards out of their grid cells and back
    // into a fan that does not fit. Nothing to simulate when they are not
    // floating.
    if (compact) return;
    const els = pillRefs.current.slice(0, n);
    if (els.some((el) => !el)) return;
    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engine.enableSleeping = false;
    w.engine = engine;
    w.sizes = els.map((el) => ({ w: el!.offsetWidth, h: el!.offsetHeight }));
    const ys = pos.map((p) => p.y);
    const zone: Zone = {
      left: -effSpread - ZONE_PAD,
      right: effSpread + ZONE_PAD,
      top: Math.min(...ys) - ZONE_PAD,
      bottom: -lift + Math.max(...w.sizes.map((s) => s.h)),
    };
    w.zone = zone;
    w.bodies = els.map((_el, i) => {
      const { w: bw, h: bh } = w.sizes[i];
      const b = Bodies.rectangle(pos[i].x, pos[i].y + bh / 2, bw, bh, {
        chamfer: { radius: Math.min(bh / 2 - 1, (dims.radius / 100) * bh) },
        restitution: 0.55,
        friction: 0,
        frictionAir: 0.08,
        inertia: Infinity,
      });
      b.plugin = { phase: jitter(i) * Math.PI * 2 };
      return b;
    });
    const T = 80;
    const walls = [
      Bodies.rectangle(
        (zone.left + zone.right) / 2,
        zone.top - T / 2,
        zone.right - zone.left + 2 * T,
        T,
        { isStatic: true },
      ),
      Bodies.rectangle(
        (zone.left + zone.right) / 2,
        zone.bottom + T / 2,
        zone.right - zone.left + 2 * T,
        T,
        { isStatic: true },
      ),
      Bodies.rectangle(zone.left - T / 2, (zone.top + zone.bottom) / 2, T, zone.bottom - zone.top + 2 * T, {
        isStatic: true,
      }),
      Bodies.rectangle(zone.right + T / 2, (zone.top + zone.bottom) / 2, T, zone.bottom - zone.top + 2 * T, {
        isStatic: true,
      }),
    ];
    Composite.add(engine.world, [...w.bodies, ...walls]);
    w.live = true;
    w.last = 0;
    w.t0 = performance.now();
    setLive(true);
    const tick = (now: number) => {
      const s = world.current;
      if (!s.engine) return;
      const dt = s.last ? Math.min(32, now - s.last) : 16;
      s.last = now;
      const t = (now - s.t0) / 1000;
      const k = latest.current.drift * 0.00005 * Math.min(1, t / 2);
      s.bodies.forEach((b, i) => {
        if (s.drag && s.drag.i === i) return;
        const ph = (b.plugin as { phase: number }).phase;
        Body.applyForce(b, b.position, {
          x: Math.sin(t * 0.9 + ph) * k * b.mass,
          y: Math.cos(t * 1.3 + ph * 1.7) * k * b.mass,
        });
      });
      Engine.update(s.engine, dt);
      s.bodies.forEach((b, i) => {
        const el = pillRefs.current[i];
        if (!el) return;
        el.style.setProperty("--x", `${b.position.x.toFixed(1)}px`);
        el.style.setProperty("--y", `${(b.position.y - s.sizes[i].h / 2).toFixed(1)}px`);
      });
      s.raf = requestAnimationFrame(tick);
    };
    w.raf = requestAnimationFrame(tick);
  }, [n, effSpread, lift, pillSize, compact, pos.map((p) => `${p.x},${p.y}`).join("|")]);

  const applyOpen = useCallback(
    (next: boolean) => {
      if (!next) stopPhysics();
      setOpen((prev) => {
        if (prev === next) return prev;
        latest.current.onOpenChange?.(next);
        return next;
      });
    },
    [stopPhysics],
  );

  useEffect(() => {
    if (liveTimer.current) window.clearTimeout(liveTimer.current);
    if (!open || !physics || latest.current.reduce) {
      if (!open || !physics) stopPhysics();
      return undefined;
    }
    liveTimer.current = window.setTimeout(startPhysics, openDuration + (n - 1) * stagger + 80);
    return () => window.clearTimeout(liveTimer.current);
  }, [open, physics, openDuration, stagger, n, startPhysics, stopPhysics]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      latest.current.reduce = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(
    () => () => {
      if (popTimer.current) window.clearTimeout(popTimer.current);
      stopPhysics();
    },
    [stopPhysics],
  );

  const pick = (item: FloatItem, i: number) => {
    latest.current.onSelect?.(item.value, i);
    if (popTimer.current) window.clearTimeout(popTimer.current);
    setPopped(i);
    popTimer.current = window.setTimeout(() => setPopped(-1), 320);
    if (closeOnSelect) applyOpen(false);
  };

  const pointerAt = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const r = anchorRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const down = (e: ReactPointerEvent<HTMLButtonElement>, i: number) => {
    const w = world.current;
    if (!w.live || e.button !== 0) return;
    const b = w.bodies[i];
    if (!b) return;
    const p = pointerAt(e);
    w.drag = {
      i,
      id: e.pointerId,
      dx: b.position.x - p.x,
      dy: b.position.y - p.y,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
  };

  const move = (e: ReactPointerEvent<HTMLButtonElement>, i: number) => {
    const w = world.current;
    const d = w.drag;
    if (!d || d.i !== i || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) >= DRAG_MIN) {
      d.moved = true;
      e.currentTarget.setAttribute("data-drag", "");
    }
    if (!d.moved) return;
    const b = w.bodies[i];
    const { w: bw, h: bh } = w.sizes[i];
    const z = w.zone;
    if (!b || !z) return;
    const p = pointerAt(e);
    const x = Math.min(z.right - bw / 2, Math.max(z.left + bw / 2, p.x + d.dx));
    const y = Math.min(z.bottom - bh / 2, Math.max(z.top + bh / 2, p.y + d.dy));
    Body.setVelocity(b, { x: (x - b.position.x) * 0.6, y: (y - b.position.y) * 0.6 });
    Body.setPosition(b, { x, y });
  };

  const up = (e: ReactPointerEvent<HTMLButtonElement>, i: number, item: FloatItem) => {
    const w = world.current;
    const d = w.drag;
    if (!d || d.i !== i || d.id !== e.pointerId) return;
    w.drag = null;
    e.currentTarget.removeAttribute("data-drag");
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    if (!d.moved && e.type === "pointerup") pick(item, i);
  };

  const hover = trigger === "hover";

  return (
    <div
      ref={rootRef}
      className={cn("folder-float", className)}
      data-open={open ? "" : undefined}
      data-compact={compact ? "" : undefined}
      data-live={live ? "" : undefined}
      data-physics={physics ? "" : undefined}
      data-trigger={trigger}
      onPointerEnter={hover ? () => applyOpen(true) : undefined}
      onPointerLeave={
        hover
          ? () => {
              if (!world.current.drag) applyOpen(false);
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          applyOpen(false);
        }
      }}
      style={
        {
          "--ff-w": `${width}px`,
          "--ff-h": `${height}px`,
          "--ff-r": `${radius}px`,
          "--ff-back": folderColor,
          "--ff-front": frontColor,
          "--ff-paper": paperColor,
          "--ff-item": itemColor,
          "--ff-item-ink": itemTextColor,
          "--ff-label": labelColor,
      "--ff-pill-h": `${(dims.h * pillSize).toFixed(1)}px`,
      "--ff-pill-pad": `${(dims.pad * pillSize).toFixed(1)}px`,
      "--ff-pill-font": `${(dims.font * pillSize).toFixed(1)}px`,
      "--ff-radius": `${((dims.radius / 100) * dims.h * pillSize).toFixed(1)}px`,
      "--ff-file-w": `${fileWidth}px`,
      "--ff-fit": fit.toFixed(3),
          "--ff-spread": `${effSpread}px`,
          "--ff-lift": `${lift}px`,
          "--ff-angle": `${flapAngle}deg`,
          "--ff-rest": `${restAngle}deg`,
          "--ff-open": `${openDuration}ms`,
          "--ff-close": `${Math.round(openDuration * 0.6)}ms`,
          "--ff-stagger": `${stagger}ms`,
          "--ff-n": n,
          "--ff-spring": `cubic-bezier(0.34, ${(1 + bounce * 1.9).toFixed(2)}, 0.64, 1)`,
        } as CSSProperties
      }
    >
      <div ref={anchorRef} className="folder-float__items">
        {list.map((item, i) => {
          const p = pos[i];
          return (
            <button
              key={`${item.value}-${i}`}
              ref={(el) => {
                pillRefs.current[i] = el;
              }}
              type="button"
              className="folder-float__item"
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              data-pop={popped === i ? "" : undefined}
              data-file={asFiles ? "" : undefined}
              aria-label={
                [item.index, item.label, item.value, item.note]
                  .filter(Boolean)
                  .join(": ")
                  .replace(/: $/, "")
              }
              style={
                {
                  "--i": i,
                  "--x": `${p.x.toFixed(1)}px`,
                  "--y": `${p.y.toFixed(1)}px`,
                  "--r": `${p.r.toFixed(2)}deg`,
                } as CSSProperties
              }
              onPointerDown={(e) => down(e, i)}
              onPointerMove={(e) => move(e, i)}
              onPointerUp={(e) => up(e, i, item)}
              onPointerCancel={(e) => up(e, i, item)}
              onClick={(e) => {
                if (!world.current.live || e.detail === 0) pick(item, i);
              }}
            >
              <span className="folder-float__drift">
                {asFiles ? (
                  <>
                    {item.index && <span className="folder-float__index">{item.index}</span>}
                    <span className="folder-float__value">{item.value}</span>
                    <span className="folder-float__label">{item.label}</span>
                    {item.note && <span className="folder-float__note">{item.note}</span>}
                  </>
                ) : (
                  <>
                    <span className="folder-float__value">{item.value}</span>
                    {item.value !== item.label && (
                      <span className="folder-float__text">{item.label}</span>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="folder-float__folder">
        <span className="folder-float__back" aria-hidden="true" />
        <span className="folder-float__paper" aria-hidden="true" />
        <span className="folder-float__front" aria-hidden="true">
          <span className="folder-float__label">{label}</span>
          <span className="folder-float__sub">{sub}</span>
        </span>
        <button
          type="button"
          className="folder-float__trigger"
          aria-expanded={open}
          aria-label={`${label}, ${sub}`}
          onClick={() => applyOpen(!open)}
        />
      </div>
    </div>
  );
}
