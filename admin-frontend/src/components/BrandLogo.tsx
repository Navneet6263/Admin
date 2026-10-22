import { useId } from "react";

/** "AM" monogram for Admin @ Management — the amber dot in the A stands for the "@". */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Admin @ Management" className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={`am-bg-${id}`} x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#312E81" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#am-bg-${id})`} />
      <path d="M0 16A16 16 0 0 1 16 0h32a16 16 0 0 1 16 16v6C46 29 20 29 0 21Z" fill="#fff" opacity=".08" />
      <path d="M10 47 20.5 17 31 47" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20.5" cy="37.5" r="3.4" fill="#FBBF24" />
      <path d="M35.5 47V17l9 16 9-16v30" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + "Admin @ Management" wordmark. `tone="light"` for dark/photo backgrounds. */
export function BrandLogo({ size = 32, tone = "dark", subtitle, className = "" }: {
  size?: number; tone?: "dark" | "light"; subtitle?: string; className?: string;
}) {
  const text = tone === "light" ? "text-white" : "text-slate-900";
  const muted = tone === "light" ? "text-white/70" : "text-slate-400";
  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMark size={size} />
      <span className="min-w-0 leading-none">
        <span className={`block truncate font-display font-semibold tracking-tight ${text}`} style={{ fontSize: Math.max(13, size * 0.45) }}>
          Admin <span className="text-amber-400">@</span> Management
        </span>
        {subtitle && <span className={`mt-1 block truncate text-[9px] uppercase tracking-widest ${muted}`}>{subtitle}</span>}
      </span>
    </span>
  );
}
