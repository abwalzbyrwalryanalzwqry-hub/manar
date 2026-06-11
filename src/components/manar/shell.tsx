import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Icon = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const icons = {
  home: "M3 11l9-8 9 8v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2V11z",
  prayer: "M12 3v18M5 10c0-3 3-5 7-5s7 2 7 5M5 14c0 3 3 5 7 5s7-2 7-5",
  quran: "M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z M4 4v12a4 4 0 004 4",
  azkar: "M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  qibla: "M12 3l4 9-4 9-4-9 4-9z",
  calendar: "M3 8h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z M8 3v4 M16 3v4",
  stats: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  profile: "M16 8a4 4 0 11-8 0 4 4 0 018 0z M4 21a8 8 0 0116 0",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8z M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1A2 2 0 114.4 17l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8L4.2 7A2 2 0 117 4.2l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1A2 2 0 1119.8 7l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 8h.01 M11 12h1v4h1",
  back: "M15 18l-6-6 6-6",
  search: "M21 21l-4.3-4.3 M11 19a8 8 0 100-16 8 8 0 000 16z",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0",
  play: "M6 4l14 8-14 8V4z",
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
};

type TabDef = { to: string; label: string; iconKey: keyof typeof icons };
const TABS: TabDef[] = [
  { to: "/home", label: "الرئيسية", iconKey: "home" },
  { to: "/prayer", label: "الصلاة", iconKey: "prayer" },
  { to: "/quran", label: "القرآن", iconKey: "quran" },
  { to: "/azkar", label: "الأذكار", iconKey: "azkar" },
  { to: "/more", label: "المزيد", iconKey: "more" },
];

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-3">
      <div className="pointer-events-auto glass mx-3 flex w-full max-w-md items-center justify-around rounded-full px-2 py-2 shadow-elegant">
        {TABS.map((t) => {
          const active = pathname === t.to || (t.to === "/more" && MORE_PATHS.includes(pathname));
          return (
            <Link
              key={t.to}
              to={t.to}
              className="group flex flex-1 flex-col items-center gap-0.5 py-1"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  active ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                }`}
              >
                <Icon d={icons[t.iconKey]} size={20} />
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

const MORE_PATHS = ["/more", "/qibla", "/calendar", "/statistics", "/profile", "/settings", "/about"];

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
      <div className={`mx-auto max-w-md ${padBottom ? "pb-28" : ""}`}>{children}</div>
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
    <div className="flex items-center justify-between px-5 pt-6 pb-4">
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
    <div className="mt-6 mb-3 flex items-center justify-between px-5">
      <h2 className="text-sm font-medium text-foreground">{children}</h2>
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
