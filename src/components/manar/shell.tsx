import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { PrayerKey } from "@/lib/prayer";



/* ---------- Iconography ---------- */
export const Icon = ({ d, size = 22, strokeWidth = 1.6 }: { d: string; size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const icons = {
  home: "M3 11l9-8 9 8v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2V11z",
  prayer: "M12 3v18M5 10c0-3 3-5 7-5s7 2 7 5M5 14c0 3 3 5 7 5s7-2 7-5",
  quran: "M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z M4 4v12a4 4 0 004 4",
  // Tasbih beads on a string
  azkar: "M5 12a7 7 0 0114 0 M5 12a7 7 0 0014 0 M8 6.5h.01 M6 10h.01 M6 14h.01 M8 17.5h.01 M16 6.5h.01 M18 10h.01 M18 14h.01 M16 17.5h.01 M12 3.5h.01 M12 20.5h.01",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  // Compass with N marker — Qibla
  qibla: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7l3 8-3-2-3 2 3-8z M12 3v1.5",
  // Calendar with crescent inside — Islamic Calendar
  calendar: "M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z M3 9h18 M8 3v4 M16 3v4 M15 15a3 3 0 11-3-3 2.4 2.4 0 003 3z",
  stats: "M4 20V10M10 20V4M16 20v-8M22 20H2 M3 20h18",
  profile: "M16 8a4 4 0 11-8 0 4 4 0 018 0z M4 21a8 8 0 0116 0",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8z M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1A2 2 0 114.4 17l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8L4.2 7A2 2 0 117 4.2l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1A2 2 0 1119.8 7l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 8h.01 M11 12h1v4h1",
  back: "M15 18l-6-6 6-6",
  search: "M21 21l-4.3-4.3 M11 19a8 8 0 100-16 8 8 0 000 16z",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0",
  bellOff: "M8 8a6 6 0 015-5.9 M19 8c0 7 3 9 3 9H8.5 M2 2l20 20 M13.7 21a2 2 0 01-3.4 0",
  play: "M6 4l14 8-14 8V4z",
  pause: "M6 4h4v16H6z M14 4h4v16h-4z",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  share: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8 M16 6l-4-4-4 4 M12 2v13",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z",
  sun: "M12 3v2 M12 19v2 M5 12H3 M21 12h-2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4L7 17 M17 7l1.4-1.4 M12 7a5 5 0 100 10 5 5 0 000-10z",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18z M3 12h18 M12 3a14 14 0 010 18 M12 3a14 14 0 000 18",
  lock: "M5 11h14v10H5z M8 11V7a4 4 0 118 0v4",
  mail: "M3 7l9 6 9-6 M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  chevron: "M9 6l6 6-6 6",
  check: "M5 12l5 5L20 7",
  heart: "M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z",
  star: "M12 2l3 7 7 .7-5.3 4.8 1.7 7L12 17.8 5.6 21.5l1.7-7L2 9.7 9 9z",
  plane: "M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1L15 22v-1.5L13 19v-5.5L21 16z",
  bed: "M3 18v-7a3 3 0 013-3h12a3 3 0 013 3v7 M3 18h18 M3 14h18 M7 11h4",
  sparkle: "M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z",
  location: "M12 22s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z M12 10a2 2 0 100 4 2 2 0 000-4z",
  flame: "M12 2s4 4 4 9a4 4 0 11-8 0c0-2 1-3 1-3s-1 4 1 4 0-3 2-6 0-4 0-4z",
  trend: "M3 17l6-6 4 4 8-8 M14 7h7v7",

  /* ----- Per-prayer iconography (sun/moon arc) ----- */
  // Fajr — pre-dawn star + horizon
  fajr: "M3 18h18 M6 15l1.5-1.5 M16.5 13.5L18 15 M12 10v4 M9 11h6 M5 21h14",
  // Sunrise — half sun rising over horizon
  sunrise: "M3 18h18 M12 4v3 M5.5 9.5L7 11 M17 11l1.5-1.5 M7 18a5 5 0 0110 0",
  // Dhuhr — sun overhead with rays
  dhuhr: "M12 4V2 M12 22v-2 M4 12H2 M22 12h-2 M5.6 5.6L4.2 4.2 M19.8 19.8l-1.4-1.4 M5.6 18.4L4.2 19.8 M19.8 4.2l-1.4 1.4 M12 7a5 5 0 100 10 5 5 0 000-10z",
  // Asr — afternoon sun at angle with longer shadows
  asr: "M16 6l3-3 M14 10l4-2 M13 14l5 0 M16 18l2 2 M3 21h12 M9 21a6 6 0 015-9",
  // Maghrib — sun setting below horizon
  maghrib: "M3 18h18 M12 8v6 M7 18a5 5 0 0110 0 M5.5 11.5L4 13 M18.5 11.5L20 13 M9 4l3 3 3-3",
  // Isha — crescent moon + star
  isha: "M19 14.8A8 8 0 119.2 5a6 6 0 109.8 9.8z M6 7l.6 1.2L8 9l-1.4.6L6 11l-.6-1.4L4 9l1.4-.6z",
};

export type IconKey = keyof typeof icons;

import type { PrayerKey } from "@/lib/prayer";
export function prayerIcon(p: PrayerKey): string {
  return icons[p as IconKey] ?? icons.prayer;
}

/* ---------- Decorative ---------- */
export function Arabesque({ className = "" }: { className?: string }) {
  // Eight-pointed Islamic star pattern (decorative watermark)
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <pattern id="manar-star" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <g stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.5">
            <path d="M30 6 L42 18 L54 30 L42 42 L30 54 L18 42 L6 30 L18 18 Z" />
            <path d="M30 14 L36 24 L46 30 L36 36 L30 46 L24 36 L14 30 L24 24 Z" />
            <circle cx="30" cy="30" r="1.4" fill="currentColor" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#manar-star)" />
    </svg>
  );
}

/* ---------- Ring countdown / progress ---------- */
export function RingProgress({
  value, // 0..1
  size = 200,
  stroke = 6,
  trackColor = "rgba(255,255,255,0.15)",
  children,
  gradient = true,
}: {
  value: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  children?: ReactNode;
  gradient?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, value)));
  const gid = "ring-grad";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        {gradient && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C9A227" />
              <stop offset="100%" stopColor="#F0D78C" />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={gradient ? `url(#${gid})` : "white"}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

/* ---------- Skeletons & empty states ---------- */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="glass flex h-16 w-16 items-center justify-center rounded-3xl text-muted-foreground">
        <Icon d={icon} size={28} />
      </div>
      <p className="mt-4 text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ---------- Tab bar ---------- */
type TabDef = { to: string; label: string; iconKey: keyof typeof icons };
const TABS: TabDef[] = [
  { to: "/home", label: "الرئيسية", iconKey: "home" },
  { to: "/prayer", label: "الصلاة", iconKey: "prayer" },
  { to: "/quran", label: "القرآن", iconKey: "quran" },
  { to: "/azkar", label: "الأذكار", iconKey: "azkar" },
  { to: "/more", label: "المزيد", iconKey: "more" },
];
const MORE_PATHS = ["/more", "/qibla", "/calendar", "/statistics", "/profile", "/settings", "/about"];

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4">
      <div className="pointer-events-auto relative mx-4 flex w-full max-w-md items-center justify-around rounded-full border border-border bg-card/85 px-2 py-2 shadow-elegant backdrop-blur-2xl">
        {TABS.map((t) => {
          const active = pathname === t.to || (t.to === "/more" && MORE_PATHS.includes(pathname));
          return (
            <Link key={t.to} to={t.to} className="group relative flex flex-1 flex-col items-center gap-0.5 py-1">
              <span
                className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 ${
                  active ? "gradient-primary text-primary-foreground shadow-glow scale-105" : "text-muted-foreground"
                }`}
              >
                <Icon d={icons[t.iconKey]} size={20} />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold" />
                )}
              </span>
              <span className={`text-[10px] transition ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- Layout helpers ---------- */
export function StatusBar({ title }: { title?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 text-[11px] font-medium text-foreground/70">
      <span className="tabular-nums">٩:٤١</span>
      {title && <span className="text-foreground">{title}</span>}
      <span>●●●●</span>
    </div>
  );
}

export function Screen({ children, padBottom = true }: { children: ReactNode; padBottom?: boolean }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className={`mx-auto max-w-md ${padBottom ? "pb-32" : ""}`}>{children}</div>
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  backTo,
  action,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-4 animate-fade-up">
      <div className="flex items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition hover:shadow-elegant"
          >
            <span className="rotate-180"><Icon d={icons.back} size={18} /></span>
          </Link>
        )}
        <div>
          <h1 className="font-display text-2xl font-medium leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mt-7 mb-3 flex items-end justify-between px-5">
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-gold" />
        <h2 className="text-[11px] font-medium uppercase tracking-[0.25em] text-foreground/80">{children}</h2>
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Mark({ size = 32, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const stroke = tone === "light" ? "#C9A227" : "var(--primary)";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 4 L34 12 V28 L20 36 L6 28 V12 Z" stroke={stroke} strokeWidth="1.4" />
      <path d="M20 12 L28 16 V24 L20 28 L12 24 V16 Z" stroke={stroke} strokeWidth="1.2" />
      <circle cx="20" cy="20" r="2.2" fill={stroke} />
    </svg>
  );
}
