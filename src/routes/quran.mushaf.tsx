import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Arabesque, Icon, icons } from "@/components/manar/shell";

export const Route = createFileRoute("/quran/mushaf")({
  head: () => ({ meta: [{ title: "المصحف — منار" }] }),
  component: MushafReader,
});

function MushafReader() {
  const [bookmarked, setBookmarked] = useState(false);
  const [showMore, setShowMore] = useState(false);

  return (
    <div dir="rtl" className="relative min-h-screen bg-background text-foreground">
      {/* Ambient Islamic backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <Arabesque className="absolute -top-24 -right-24 h-[420px] w-[420px] text-primary/10" />
        <Arabesque className="absolute -bottom-24 -left-24 h-[420px] w-[420px] text-gold/15" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
      </div>

      <div className="relative mx-auto max-w-md pb-10">
        {/* Premium app bar */}
        <header className="sticky top-0 z-30 animate-fade-up">
          <div className="mx-4 mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-full border border-border/60 bg-card/80 px-3 py-2 shadow-elegant backdrop-blur-2xl">
            <Link
              to="/quran"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 text-foreground shadow-soft transition hover:shadow-elegant"
              aria-label="رجوع"
            >
              <span className="rotate-180"><Icon d={icons.back} size={18} /></span>
            </Link>
            <div className="min-w-0 text-center">
              <div className="font-display text-base font-medium leading-tight truncate">المصحف</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">قارئ منار</div>
            </div>
            <button
              onClick={() => setShowMore((v) => !v)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 text-foreground shadow-soft transition hover:shadow-elegant"
              aria-label="خيارات"
            >
              <Icon d={icons.more} size={18} />
            </button>
          </div>

          {/* More options popover */}
          {showMore && (
            <div className="mx-4 mt-2 animate-fade-in rounded-2xl border border-border/60 bg-card/90 p-2 shadow-elegant backdrop-blur-2xl">
              <div className="grid grid-cols-3 gap-2">
                {MORE_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-background/60 p-3 text-center transition hover:shadow-soft"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon d={a.icon} size={16} />
                    </span>
                    <span className="text-[10px] font-medium text-foreground/90">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Selectors row */}
        <div className="mt-4 grid grid-cols-2 gap-3 px-4 stagger">
          <SelectorPill label="السورة" value="الفاتحة" iconKey="quran" />
          <SelectorPill label="الجزء" value="١" iconKey="bookmark" />
        </div>

        {/* Page indicator + progress */}
        <div className="mt-4 px-4 animate-fade-up">
          <div className="glass flex items-center gap-4 rounded-3xl border border-border/60 p-4">
            <div className="flex flex-col items-center rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2">
              <span className="text-[9px] uppercase tracking-[0.25em] text-gold">صفحة</span>
              <span className="font-display text-xl font-medium tabular-nums text-foreground">١</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-foreground/80">تقدّم القراءة</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">٠٪</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="gradient-gold h-full w-0 transition-all duration-700" />
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">
                ٦٠٤ صفحات · ١١٤ سورة
              </div>
            </div>
          </div>
        </div>

        {/* Mushaf page placeholder */}
        <div className="mt-5 px-4 animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/70 shadow-elegant backdrop-blur-2xl">
            {/* Ornamental frame */}
            <div className="pointer-events-none absolute inset-3 rounded-[26px] border border-gold/25" />
            <div className="pointer-events-none absolute inset-5 rounded-[22px] border border-gold/10" />
            <Arabesque className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 text-primary/10" />
            <Arabesque className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 text-gold/15" />

            {/* Corner ornaments */}
            {["top-4 right-4", "top-4 left-4", "bottom-4 right-4", "bottom-4 left-4"].map((pos) => (
              <span
                key={pos}
                className={`pointer-events-none absolute ${pos} h-4 w-4 rotate-45 border border-gold/40`}
              />
            ))}

            <div className="relative flex min-h-[440px] flex-col items-center justify-center px-8 py-14 text-center">
              {/* Illustration */}
              <div className="relative flex h-24 w-24 items-center justify-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 text-primary/20" aria-hidden>
                  <path d="M50 6 L86 26 V66 L50 90 L14 66 V26 Z" fill="none" stroke="currentColor" strokeWidth="0.9" />
                  <path d="M50 18 L74 32 V60 L50 76 L26 60 V32 Z" fill="none" stroke="currentColor" strokeWidth="0.7" />
                </svg>
                <div className="gradient-primary relative flex h-16 w-16 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                  <Icon d={icons.quran} size={26} />
                </div>
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gold shadow-gold animate-pulse" />
              </div>

              <div className="mt-6 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1">
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold">قريبًا</span>
              </div>

              <h2 className="mt-5 font-display text-2xl font-medium leading-snug">
                صفحات المصحف الشريف
              </h2>
              <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
                نُجهّز حاليًا مصحفًا متكاملًا بخط عثماني واضح وتجربة قراءة فاخرة. ستضاف الآيات في المرحلة القادمة بإذن الله.
              </p>

              <div className="mt-6 flex items-center gap-2">
                <span className="h-px w-8 bg-gold/50" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">منار</span>
                <span className="h-px w-8 bg-gold/50" />
              </div>
            </div>
          </div>
        </div>

        {/* Primary action bar */}
        <div className="mt-5 px-4">
          <div className="glass grid grid-cols-5 gap-1 rounded-full border border-border/60 p-1.5 shadow-soft">
            <ReaderAction icon={icons.bookmark} label="آخر قراءة" />
            <ReaderAction icon={icons.info} label="التفسير" />
            <ReaderAction icon={icons.play} label="الصوت" />
            <ReaderAction icon={icons.search} label="بحث" />
            <ReaderAction
              icon={icons.bookmark}
              label="حفظ"
              active={bookmarked}
              onClick={() => setBookmarked((v) => !v)}
            />
          </div>
        </div>

        {/* Secondary tools */}
        <div className="mt-4 grid grid-cols-2 gap-3 px-4 stagger">
          <ToolCard iconKey="settings" title="إعدادات القراءة" hint="الخط، الحجم، السطوع" />
          <ToolCard iconKey="bookmark" title="العلامات" hint="آياتك المحفوظة" />
        </div>

        <p className="mt-6 px-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          واجهة القارئ جاهزة. سيتم ربطها بمحتوى المصحف في المرحلة القادمة.
        </p>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

const MORE_ACTIONS: { label: string; icon: string }[] = [
  { label: "مشاركة", icon: icons.share },
  { label: "الليلي", icon: icons.moon },
  { label: "إعدادات", icon: icons.settings },
];

function SelectorPill({
  label,
  value,
  iconKey,
}: {
  label: string;
  value: string;
  iconKey: keyof typeof icons;
}) {
  return (
    <button className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-3 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon d={icons[iconKey]} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate font-display text-sm font-medium">{value}</div>
      </div>
      <span className="rotate-90 text-muted-foreground"><Icon d={icons.chevron} size={14} /></span>
    </button>
  );
}

function ReaderAction({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-full py-2 transition ${
        active ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon d={icon} size={16} />
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  );
}

function ToolCard({
  iconKey,
  title,
  hint,
}: {
  iconKey: keyof typeof icons;
  title: string;
  hint: string;
}) {
  return (
    <button className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 text-right shadow-soft backdrop-blur-xl transition hover:shadow-elegant">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
        <Icon d={icons[iconKey]} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</div>
      </div>
    </button>
  );
}
