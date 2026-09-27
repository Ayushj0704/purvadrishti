import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent-strong text-white border-accent-strong hover:bg-accent-hover hover:border-accent-hover",
  outline: "bg-transparent text-ink border-hairline hover:border-[#2e2e3a] hover:bg-white/[0.03]",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink hover:bg-white/[0.04]",
  danger: "bg-critical/10 text-critical border-critical/40 hover:bg-critical/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3",
  md: "h-10 px-5",
};

const BASE =
  "label-caps inline-flex items-center justify-center gap-2 rounded-md border transition-all duration-200 disabled:pointer-events-none disabled:opacity-40";

function classes(variant: Variant, size: Size, className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={classes(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  to,
  variant = "outline",
  size = "md",
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link to={to} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}
