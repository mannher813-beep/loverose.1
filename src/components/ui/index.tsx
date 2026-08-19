/* =====================================================================
   LOVEROSE — KIT DE COMPOSANTS "EDITORIAL"
   ---------------------------------------------------------------------
   Primitives partagées par tous les écrans, pour que la refonte reste
   cohérente et que les futurs écrans n'aient plus à réinventer un bouton
   ou une carte à coups de classes Tailwind copiées-collées.
   ===================================================================== */

import React, { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "ink" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-rose-500 text-white border border-rose-500 hover:bg-rose-600 hover:border-rose-600 active:bg-rose-700",
  ink: "bg-slate-900 text-slate-50 border border-slate-900 hover:bg-slate-800 hover:border-slate-800",
  outline:
    "bg-white text-slate-800 border border-slate-300 hover:border-slate-900 hover:text-slate-950",
  ghost:
    "bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900",
  danger:
    "bg-white text-red-700 border border-red-300 hover:bg-red-50 hover:border-red-500",
};

// Hauteurs conformes aux cibles de touche recommandées (>= 40px).
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-bold tracking-tight",
        "transition-colors duration-150 cursor-pointer select-none",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  flush?: boolean;
}

export function Card({ flush = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "bg-white border border-slate-200 rounded-xl",
        !flush && "p-5",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kicker + SectionTitle — signature éditoriale                        */
/* ------------------------------------------------------------------ */

export function Kicker({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "u-kicker inline-flex items-center gap-1.5 text-rose-600",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag className={cx("u-display text-slate-950", className)}>{children}</Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "ink";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  brand: "bg-rose-50 text-rose-700 border-rose-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-600 border-amber-100",
  ink: "bg-slate-900 text-slate-50 border-slate-900",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 border rounded-md px-2 py-1",
        "text-[11px] font-bold leading-none whitespace-nowrap",
        BADGE_TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton — remplace les spinners plein écran                        */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("u-skeleton rounded-md", className)} />;
}

/** Fantôme d'une carte d'annonce, affiché pendant le chargement du fil. */
export function PostSkeleton() {
  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-2.5 w-1/5" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <Skeleton className="h-52 w-full rounded-lg" />
      <div className="flex gap-6 pt-3 border-t border-slate-100">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center px-6 py-14 bg-white border border-dashed border-slate-300 rounded-xl">
      {icon && (
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
          {icon}
        </div>
      )}
      <h3 className="u-display text-xl text-slate-900">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field — libellé + input cohérents                                   */
/* ------------------------------------------------------------------ */

export const inputClassName = cx(
  "w-full h-11 px-3.5 bg-white text-sm text-slate-900 font-medium",
  "border border-slate-300 rounded-lg",
  "placeholder:text-slate-400 placeholder:font-normal",
  "focus:border-slate-900 focus:outline-none transition-colors"
);

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="block text-[13px] font-bold text-slate-800">
          {label}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-xs font-semibold text-red-600">{error}</span>
      ) : (
        hint && <span className="block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}
