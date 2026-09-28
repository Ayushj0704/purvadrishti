import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { cn } from "../../lib/cn";
import "./GlideSelect.css";

export interface GlideSelectOption {
  value: string;
  label: ReactNode;
  tag?: string;
}

export type GlideSelectItem = string | GlideSelectOption;

type Size = "sm" | "md" | "lg";

export interface GlideSelectProps {
  /** Strings are shorthand for `{ value, label }` with both set to the string. */
  items: GlideSelectItem[];
  /** Controlled selection. Omit to let the component own it. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: GlideSelectOption) => void;
  size?: Size;
  radius?: number;
  /** Explicit menu width; defaults to the trigger width, minimum 11rem. */
  menuWidth?: number | string;
  /** Preferred side. Flips automatically when the preferred side has no room. */
  placement?: "top" | "bottom";
  align?: "start" | "end";
  openDuration?: number;
  exitDuration?: number;
  rememberPosition?: boolean;
  disabled?: boolean;
  colors?: {
    background?: string;
    text?: string;
    muted?: string;
    border?: string;
    accent?: string;
    accentText?: string;
  };
  ariaLabel?: string;
  className?: string;
}

const SIZE_CLASS: Record<Size, string> = {
  sm: "glide-select--sm",
  md: "glide-select--md",
  lg: "glide-select--lg",
};

/** Kept in sync with the app's motion token (--ease-out-expo). */
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 6;
const MIN_MENU_WIDTH = 176;
const TYPEAHEAD_RESET = 600;

interface Coords {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
}

const toOption = (item: GlideSelectItem): GlideSelectOption =>
  typeof item === "string" ? { value: item, label: item } : item;

/** ReactNode labels cannot be searched, so fall back to the value. */
const searchable = (option: GlideSelectOption) =>
  (typeof option.label === "string" ? option.label : option.value).toLowerCase();

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const toCssVars = (
  colors: GlideSelectProps["colors"],
  radius: number | undefined,
): CSSProperties => {
  const vars: Record<string, string> = {};
  if (colors?.background) vars["--glide-bg"] = colors.background;
  if (colors?.text) vars["--glide-fg"] = colors.text;
  if (colors?.muted) vars["--glide-dim"] = colors.muted;
  if (colors?.border) vars["--glide-border"] = colors.border;
  if (colors?.accent) vars["--glide-accent"] = colors.accent;
  if (colors?.accentText) vars["--glide-accent-fg"] = colors.accentText;
  if (typeof radius === "number") vars["--glide-radius"] = `${radius}px`;
  return vars as CSSProperties;
};

/**
 * A select-only combobox: a button that owns focus and a listbox that floats
 * above the page. The menu is portalled to <body> on purpose. Both ancestors
 * that would normally host it are hostile to an absolutely positioned overlay:
 * `.panel` clips its overflow (tokens.css), and `.reveal` ends its scroll
 * animation with a retained `transform` (--animate-rise uses fill-mode `both`),
 * which makes the wrapper a containing block. Focus never leaves the trigger,
 * so the portal costs nothing for keyboard or screen-reader users.
 */
export function GlideSelect({
  items,
  value,
  defaultValue,
  onChange,
  size = "md",
  radius,
  menuWidth,
  placement = "bottom",
  align = "start",
  openDuration = 0.22,
  exitDuration = 0.15,
  rememberPosition = true,
  disabled = false,
  colors,
  ariaLabel,
  className,
}: GlideSelectProps) {
  const options = useMemo(() => items.map(toOption), [items]);

  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => defaultValue ?? options[0]?.value ?? "");
  const current = controlled ? (value as string) : inner;

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const currentRef = useRef(current);
  const typeRef = useRef("");
  const typeTimerRef = useRef<number | null>(null);
  /** Guards against a cancelled exit animation unmounting a reopened menu. */
  const closeToken = useRef(0);
  /** Set when `rememberPosition` is off, to skip the one scroll on open. */
  const skipScrollRef = useRef(false);

  currentRef.current = current;

  const listId = `glide-list-${useId()}`;
  const optionId = (index: number) => `${listId}-option-${index}`;

  const selectedIndex = options.findIndex((option) => option.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const show = useCallback(() => {
    if (disabled || open) return;
    closeToken.current += 1;
    // Without this the list opens at the top, hiding the current value.
    if (!rememberPosition) skipScrollRef.current = true;
    const from = options.findIndex((option) => option.value === currentRef.current);
    setActiveIndex(from >= 0 ? from : 0);
    setOpen(true);
  }, [disabled, open, options, rememberPosition]);

  const hide = useCallback(
    (restoreFocus = false) => {
      if (!open) return;
      const token = (closeToken.current += 1);
      const finish = () => {
        if (closeToken.current !== token) return;
        setOpen(false);
        setCoords(null);
        if (restoreFocus) triggerRef.current?.focus();
      };

      const menu = menuRef.current;
      if (!menu || exitDuration <= 0 || reducedMotion()) {
        finish();
        return;
      }

      const openUp = coords?.openUp ?? false;
      menu
        .animate(
          [
            { opacity: 1, transform: "translateY(0) scale(1)" },
            { opacity: 0, transform: `translateY(${openUp ? 4 : -4}px) scale(0.985)` },
          ],
          { duration: exitDuration, easing: EASE, fill: "forwards" },
        )
        .addEventListener("finish", finish, { once: true });
    },
    [coords, exitDuration, open],
  );

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (!controlled) setInner(option.value);
    onChange?.(option.value, option);
    hide(true);
  };

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const maxWidth = Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2);
    const triggerWidth = Math.min(rect.width, maxWidth);
    const floor = Math.max(triggerWidth, Math.min(MIN_MENU_WIDTH, maxWidth));
    const requested =
      typeof menuWidth === "number" ? menuWidth : Number.parseFloat(String(menuWidth ?? ""));
    const target = Number.isFinite(requested) ? Math.max(requested, floor) : floor;
    const width = Math.min(Math.max(target, triggerWidth), maxWidth);

    const height = menu.offsetHeight;
    const roomBelow = viewportHeight - rect.bottom - TRIGGER_GAP - VIEWPORT_MARGIN;
    const roomAbove = rect.top - TRIGGER_GAP - VIEWPORT_MARGIN;
    const openUp =
      placement === "top" ? roomAbove >= roomBelow : height > roomBelow && roomAbove > roomBelow;

    const rawTop = openUp ? rect.top - TRIGGER_GAP - height : rect.bottom + TRIGGER_GAP;
    const top = Math.min(
      Math.max(VIEWPORT_MARGIN, rawTop),
      Math.max(VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN),
    );

    const rawLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rawLeft),
      Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
    );

    setCoords((prev) =>
      prev && prev.top === top && prev.left === left && prev.width === width && prev.openUp === openUp
        ? prev
        : { top, left, width, openUp },
    );
  }, [align, menuWidth, placement]);

  // Measured before paint so the menu never renders a frame at the wrong spot.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open || !coords) return;
    const menu = menuRef.current;
    if (!menu || openDuration <= 0 || reducedMotion()) return;
    menu
      .animate(
        [
          { opacity: 0, transform: `translateY(${coords.openUp ? 6 : -6}px) scale(0.98)` },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: openDuration, easing: EASE, fill: "backwards" },
      );
  }, [coords, open, openDuration]);

  // The trigger can be a long way from the menu, so follow the viewport.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [hide, open]);

  // Keep the keyboard cursor inside the scroll window.
  useEffect(() => {
    if (!open) return;
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(
    () => () => {
      if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
    },
    [],
  );

  const step = (delta: number) => {
    if (!options.length) return;
    setActiveIndex((index) => (index + delta + options.length) % options.length);
  };

  const matchTypeahead = () => {
    const buffer = typeRef.current;
    if (!buffer) return;
    const start = activeIndex;
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + offset) % options.length;
      if (searchable(options[index]).startsWith(buffer)) {
        setActiveIndex(index);
        return;
      }
    }
  };

  const resetTypeahead = () => {
    if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
    typeTimerRef.current = window.setTimeout(() => {
      typeRef.current = "";
    }, TYPEAHEAD_RESET);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;

    if (typeRef.current) {
      if (key === "Backspace") {
        typeRef.current = typeRef.current.slice(0, -1);
        matchTypeahead();
        resetTypeahead();
        event.preventDefault();
        return;
      }
      if (key === "Escape") {
        typeRef.current = "";
        return;
      }
      if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        typeRef.current += key.toLowerCase();
        matchTypeahead();
        resetTypeahead();
        event.preventDefault();
        return;
      }
    }

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        show();
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        step(-1);
        break;
      case "Home":
        if (options.length) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (options.length) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        typeRef.current = "";
        hide(true);
        break;
      case "Tab":
        hide();
        break;
      default:
        break;
    }
  };

  const onBlur = (event: ReactFocusEvent<HTMLButtonElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && (rootRef.current?.contains(next) || menuRef.current?.contains(next))) return;
    hide();
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "glide-select",
        SIZE_CLASS[size],
        disabled && "is-disabled",
        className,
      )}
      style={toCssVars(colors, radius)}
      data-open={open ? "true" : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className="glide-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      >
        <span className="glide-value" key={current}>
          {selected ? selected.label : "Select\u2026"}
        </span>
        <span className="glide-arrow" aria-hidden="true">
          <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={1.75} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="glide-menu"
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              width: coords?.width,
              // Hidden until measured. The menu is viewport-positioned, so an
              // unmeasured frame takes up no space and cannot eat a click.
              visibility: coords ? "visible" : "hidden",
              transformOrigin: coords?.openUp ? "bottom center" : "top center",
            }}
          >
            <ul className="glide-list" id={listId} role="listbox" aria-label={ariaLabel}>
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  className="glide-item"
                  role="option"
                  aria-selected={option.value === current}
                  data-active={index === activeIndex ? "true" : undefined}
                  onPointerEnter={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                >
                  <span className="glide-item-label">{option.label}</span>
                  {option.tag ? <span className="glide-item-tag">{option.tag}</span> : null}
                  {option.value === current ? (
                    <span className="glide-item-check" aria-hidden="true">
                      <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={2} />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
