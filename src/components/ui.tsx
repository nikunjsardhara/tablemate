import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

/* ------------------------------------------------------------------ Button */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  full?: boolean;
  size?: "sm" | "md";
}

const buttonStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-600/50 shadow-sm",
  secondary:
    "bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50",
  ghost: "text-amber-700 hover:bg-amber-50 disabled:opacity-50",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
};

export function Button({
  variant = "primary",
  loading = false,
  full = false,
  size = "md",
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed ${
        size === "sm" ? "h-9 px-3" : "h-11 px-4"
      } ${buttonStyles[variant]} ${full ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4 border-white/40 border-t-white" />}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Input */

const fieldStyles =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldStyles} ${className}`} {...rest} />;
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${fieldStyles} resize-none leading-relaxed ${className}`}
      {...rest}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint && <span className="mb-1.5 text-xs text-zinc-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Badges */

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "amber" | "green" | "red" | "zinc";
}) {
  const tones = {
    default: "bg-zinc-100 text-zinc-600",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-700",
    zinc: "bg-zinc-800 text-zinc-100",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Spinner */

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      role="status"
      className={`inline-block animate-spin rounded-full border-2 border-zinc-300 border-t-amber-600 ${className}`}
    />
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-zinc-500">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="text-4xl">☕</div>
      <h2 className="text-base font-semibold text-zinc-800">{title}</h2>
      <p className="max-w-xs text-sm text-zinc-500">{description}</p>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------- Score dial */

export function ScoreDial({ score }: { score: number | null }) {
  const value = score ?? 0;
  const tone =
    value >= 81
      ? "border-green-500 text-green-700 bg-green-50"
      : value >= 51
        ? "border-amber-500 text-amber-700 bg-amber-50"
        : "border-zinc-300 text-zinc-500 bg-zinc-50";

  return (
    <div
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 ${tone}`}
      aria-label={`Match score ${value}`}
    >
      <span className="text-sm font-bold leading-none">{value}</span>
      <span className="text-[9px] uppercase leading-tight opacity-70">match</span>
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} tone="amber">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- Modal */

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
