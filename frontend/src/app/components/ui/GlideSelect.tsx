import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import "./GlideSelect.css";

const SIZES = {
  sm: { chip: 28, row: 26, font: 12 },
  md: { chip: 32, row: 30, font: 13 },
  lg: { chip: 44, row: 40, font: 14 },
} as const;

/** The list is a grid with a 1px gap, so consecutive rows are row + gap apart. */
const GAP = 1;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

const DEFAULT_OPTIONS = ["One", "Two", "Three"];

export interface GlideSelectOption {
  value: string;
  label: string;
  tag?: string;
}

export type GlideSelectItem = string | GlideSelectOption;

export type GlideSelectSize = keyof typeof SIZES;

export interface GlideSelectProps {
  /** Strings are shorthand for `{ value, label }` with both set to the string. */
  options?: GlideSelectItem[];
  /** Controlled selection. Omit to let the component own it. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: GlideSelectOption) => void;
  placeholder?: string;
  showTags?: boolean;
  /** Defaults resolve to console tokens rather than the neutral grey ramp. */
  accentColor?: string;
  surfaceColor?: string;
  highlightColor?: string;
  textColor?: string;
  size?: GlideSelectSize;
  radius?: number;
  /** Floor for the menu width; the menu is never narrower than its trigger. */
  menuWidth?: number;
  /** Preferred side. Flips automatically when the preferred side has no room. */
  placement?: "top" | "bottom";
  align?: "left" | "right";
  popDuration?: number;
  glideDuration?: number;
  rememberPosition?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const norm = (item: GlideSelectItem): GlideSelectOption =>
  typeof item === "string" ? { value: item, label: item } : item;

const textOf = (item: GlideSelectOption) => item.label;

const typeaheadIndex = (
  items: GlideSelectOption[],
  from: number,
  ch: string,
): number => {
  const c = ch.toLowerCase();
  const n = items.length;
  for (let k = 1; k <= n; k += 1) {
    const i = (from + k) % n;
    if (textOf(items[i]).toLowerCase().startsWith(c)) return i;
  }
  return from;
};

interface Coords {
  top: number;
  left: number;
  width: number;
}

interface Scrub {
  id: number;
  top: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * A select-only combobox: a button that owns focus and a listbox that floats
 * above the page. The menu is portalled to <body> and positioned from the
 * trigger rect, which is the one thing that has to differ from an in-flow
 * overlay here. Both ancestors that would host it are hostile: `.panel` and
 * `.panel-glass` clip their overflow, and `.reveal` ends its scroll animation
 * with a retained `transform` (`--animate-rise` is fill-mode `both`), which makes
 * the wrapper a containing block for an absolutely positioned child. Focus never
 * leaves the trigger, so the portal costs nothing for keyboard or screen-reader
 * users.
 */
export default function GlideSelect({
  options = DEFAULT_OPTIONS,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  showTags = true,
  accentColor = "var(--color-accent-bright, #9aa0ff)",
  surfaceColor = "var(--color-abyss, #1a1a1a)",
  highlightColor = "#2c2c36",
  textColor = "var(--color-ink, #f5f5f5)",
  size = "md",
  radius = 10,
  menuWidth = 176,
  placement = "bottom",
  align = "left",
  popDuration = 180,
  glideDuration = 220,
  rememberPosition = true,
  disabled = false,
  ariaLabel = "Select",
  className = "",
}: GlideSelectProps) {
  const items = options.map(norm);
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selected = items.findIndex((item) => item.value === current);

  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [active, setActive] = useState<number | null>(null);
  const [side, setSide] = useState<"top" | "bottom">(placement);
  const [coords, setCoords] = useState<Coords | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const instant = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const scrub = useRef<Scrub | null>(null);

  const id = useId();
  const S = SIZES[size] ?? SIZES.md;
  const step = S.row + GAP;
  const popOut = Math.round((popDuration * 2) / 3);

  /** Measures the trigger and the freshly mounted menu, then pins the menu. */
  const place = () => {
    const menu = menuRef.current;
    const root = rootRef.current;
    if (!menu || !root) return;

    const rect = root.getBoundingClientRect();
    const height = menu.offsetHeight;
    const width = clamp(
      Math.max(menuWidth, rect.width),
      VIEWPORT_MARGIN * 2,
      window.innerWidth - VIEWPORT_MARGIN * 2,
    );
    const need = height + MENU_GAP;

    const next: "top" | "bottom" =
      placement === "bottom" && rect.bottom + need > window.innerHeight
        ? "top"
        : placement === "top" && rect.top - need < 0
          ? "bottom"
          : placement;
    setSide(next);

    const rawTop =
      next === "bottom" ? rect.bottom + MENU_GAP : rect.top - MENU_GAP - height;
    const rawLeft = align === "right" ? rect.right - width : rect.left;

    setCoords({
      top: clamp(
        rawTop,
        VIEWPORT_MARGIN,
        window.innerHeight - height - VIEWPORT_MARGIN,
      ),
      left: clamp(
        rawLeft,
        VIEWPORT_MARGIN,
        window.innerWidth - width - VIEWPORT_MARGIN,
      ),
      width,
    });
  };

  useLayoutEffect(() => {
    if (phase !== "open") return;
    place();

    const el = menuRef.current;
    if (!el) return;
    el.style.transitionDuration = instant.current ? "0ms" : "";
    // Replay the pop by bouncing the attribute across a reflow.
    el.dataset.state = "closed";
    void el.offsetHeight;
    el.dataset.state = "open";

    const pill = pillRef.current;
    if (pill) {
      pill.style.transition = "none";
      pill.style.transform = `translateY(${Math.max(0, selected) * step}px)`;
      pill.style.opacity = "0";
      void pill.offsetHeight;
      pill.style.transition = "";
    }
    // `selected` and `step` are read for the initial pill offset only: re-running
    // on a later selection would yank the highlight back to the chosen row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill || phase !== "open") return;
    if (active === null) {
      pill.style.opacity = "0";
      return;
    }
    const jump = instant.current || pill.style.opacity !== "1";
    pill.style.transitionDuration = jump ? "0ms, 150ms" : "";
    pill.style.transform = `translateY(${active * step}px)`;
    pill.style.opacity = "1";
    instant.current = false;
  }, [active, phase, step]);

  // The menu is viewport-positioned, so it has to follow the trigger.
  useEffect(() => {
    if (phase === "closed") return undefined;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const open = (viaKey: boolean) => {
    if (disabled) return;
    window.clearTimeout(closeTimer.current);
    instant.current = true;
    setActive(selected >= 0 ? selected : viaKey ? 0 : null);
    setPhase("open");
  };

  const close = (mode: "instant" | "pop") => {
    setActive(null);
    window.clearTimeout(closeTimer.current);
    const el = menuRef.current;
    if (mode === "instant" || !el) {
      setPhase("closed");
      return;
    }
    el.style.transitionDuration = "";
    el.dataset.state = "closed";
    setPhase("closing");
    closeTimer.current = window.setTimeout(() => setPhase("closed"), popOut + 20);
  };

  const pick = (index: number, viaKey: boolean) => {
    const item = items[index];
    if (!item) {
      close("instant");
      return;
    }
    if (item.value !== current) {
      if (value === undefined) setInner(item.value);
      onChange?.(item.value, item);
      if (!viaKey && rootRef.current) rootRef.current.dataset.swap = "";
    }
    close("instant");
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const k = e.key;
    const n = items.length;
    const cur = active ?? Math.max(0, selected);

    if (phase !== "open") {
      if (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        open(true);
      }
      return;
    }

    const go = (i: number) => {
      e.preventDefault();
      instant.current = true;
      setActive(Math.min(n - 1, Math.max(0, i)));
    };

    if (k === "ArrowDown" || k === "ArrowUp") {
      go(active === null ? cur : cur + (k === "ArrowDown" ? 1 : -1));
    } else if (k === "Home" || k === "End") {
      go(k === "Home" ? 0 : n - 1);
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      pick(cur, true);
    } else if (k === "Escape" || k === "Tab") {
      if (k === "Escape") e.preventDefault();
      close("instant");
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      go(typeaheadIndex(items, cur, k));
    }
  };

  useEffect(() => {
    if (phase === "closed") return undefined;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target && menuRef.current?.contains(target)) return;
      close("pop");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (disabled && phase !== "closed") close("instant");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
    },
    [],
  );

  /**
   * Row under the pointer. `origin` is the list's own top, which already sits
   * inside the menu's 4px padding, so the padding must not be subtracted again.
   */
  const rowAt = (y: number) => {
    const s = scrub.current;
    if (!s) return null;
    const i = Math.floor((y - s.top) / step);
    return i >= 0 && i < items.length ? i : null;
  };

  const onListDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; the move/up handlers still work without it.
    }
    scrub.current = {
      id: e.pointerId,
      top: e.currentTarget.getBoundingClientRect().top,
    };
    instant.current = true;
    setActive(rowAt(e.clientY));
  };

  const onListMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== e.pointerId) return;
    const i = rowAt(e.clientY);
    if (i !== active) setActive(i);
  };

  const onListUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== e.pointerId) return;
    const i = e.type === "pointerup" ? rowAt(e.clientY) : null;
    scrub.current = null;
    if (i !== null) pick(i, false);
    else if (!rememberPosition) setActive(null);
  };

  const onListOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || scrub.current) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!row) return;
    const i = Number(row.dataset.index);
    if (i !== active) setActive(i);
  };

  const origin = `${side === "bottom" ? "top" : "bottom"} ${align}`;

  return (
    <div
      ref={rootRef}
      className={`glide-select${className ? ` ${className}` : ""}`}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      style={
        {
          "--gs-accent": accentColor,
          "--gs-surface": surfaceColor,
          "--gs-highlight": highlightColor,
          "--gs-text": textColor,
          "--gs-radius": `${radius}px`,
          "--gs-inner-radius": `${Math.max(3, radius - 4)}px`,
          "--gs-chip": `${S.chip}px`,
          "--gs-row": `${S.row}px`,
          "--gs-font": `${S.font}px`,
          "--gs-menu-w": `${menuWidth}px`,
          "--gs-pop": `${popDuration}ms`,
          "--gs-pop-out": `${popOut}ms`,
          "--gs-glide": `${glideDuration}ms`,
          "--gs-origin": origin,
        } as CSSProperties
      }
      onAnimationEnd={(e) => {
        if (e.animationName === "gs-swap" && rootRef.current) {
          delete rootRef.current.dataset.swap;
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={phase === "open"}
        aria-controls={`${id}-list`}
        aria-activedescendant={active !== null ? `${id}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        className="glide-select__trigger"
        onPointerDown={(e) => {
          if (e.button !== 0 || disabled) return;
          e.currentTarget.focus({ preventScroll: true });
          if (phase === "open") close("pop");
          else open(false);
        }}
        onKeyDown={onTriggerKey}
      >
        <span
          className="glide-select__label"
          key={current}
          data-empty={selected < 0 ? "" : undefined}
        >
          {selected >= 0 ? items[selected].label : placeholder}
        </span>
        <span className="glide-select__chevron" aria-hidden="true">
          <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2.5} />
        </span>
      </button>

      {phase !== "closed"
        ? createPortal(
            <div
              ref={menuRef}
              className="glide-select__menu"
              data-state="open"
              data-side={side}
              data-align={align}
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                width: coords?.width,
                // Hidden until measured: a fixed menu with no coordinates yet
                // would otherwise flash in the top-left corner for one frame.
                visibility: coords ? "visible" : "hidden",
              }}
            >
              <div
                id={`${id}-list`}
                role="listbox"
                aria-label={ariaLabel}
                className="glide-select__list"
                data-live={active !== null ? "" : undefined}
                onPointerOver={onListOver}
                onPointerLeave={() => {
                  if (!scrub.current && !rememberPosition) setActive(null);
                }}
                onPointerDown={onListDown}
                onPointerMove={onListMove}
                onPointerUp={onListUp}
                onPointerCancel={onListUp}
                onLostPointerCapture={onListUp}
              >
                <span ref={pillRef} className="glide-select__pill" aria-hidden="true" />
                {items.map((item, i) => (
                  <div
                    key={item.value}
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={i === selected}
                    data-index={i}
                    className="glide-select__option"
                  >
                    <span className="glide-select__name">{item.label}</span>
                    {showTags && item.tag ? (
                      <span className="glide-select__tag">{item.tag}</span>
                    ) : null}
                    <span
                      className="glide-select__check"
                      data-on={i === selected ? "" : undefined}
                      aria-hidden="true"
                    >
                      <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.5} />
                    </span>
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
