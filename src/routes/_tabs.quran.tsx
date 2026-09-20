import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Arabesque,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";
import { toArabicDigits, useBookmarks, useReadingHistory } from "@/lib/quran";
import { SURAH_META } from "@/lib/quran/metadata";
import { formatRelativeArabic } from "@/lib/quran-reader-state";

export const Route = createFileRoute("/_tabs/quran")({
  head: () => ({
    meta: [
      { title: "القرآن الكريم — منار" },
      {
        name: "description",
        content: "المصحف، التلاوات، التفسير، العلامات والبحث في القرآن الكريم.",
      },
    ],
  }),
  component: QuranHub,
});

type Card = {
  to: string;
  title: string;
  hint: string;
  iconKey: keyof typeof icons;
  accent: "primary" | "gold" | "night";
};

const CARDS: Card[] = [
  {
    to: "/quran/mushaf",
    title: "المصحف",
    hint: "١١٤ سورة بخط عثماني",
    iconKey: "quran",
    accent: "primary",
  },
  {
    to: "/quran/recitations",
    title: "التلاوات",
    hint: "١٨ قارئًا · آية آية",
    iconKey: "play",
    accent: "gold",
  },
  {
    to: "/quran/tafsir",
    title: "التفسير",
    hint: "الميسّر والمختصر",
    iconKey: "info",
    accent: "night",
  },
  {
    to: "/quran/bookmarks",
    title: "العلامات",
    hint: "آياتك وملاحظاتك",
    iconKey: "bookmark",
    accent: "gold",
  },
  {
    to: "/quran/search",
    title: "البحث",
    hint: "في ٦٢٣٦ آية",
    iconKey: "search",
    accent: "primary",
  },
  {
    to: "/quran/share",
    title: "مشاركة آية",
    hint: "بطاقات فاخرة",
    iconKey: "share",
    accent: "night",
  },
];

function QuranHub() {
  const { last, streak, progress } = useReadingHistory();
  const { items: bookmarks } = useBookmarks();
  const percent = Math.round(progress * 100);

  return (
    <Screen>
      <ScreenHeader title="القرآن الكريم" subtitle="١١٤ سورة · ٣٠ جزءًا · ٦٢٣٦ آية" />

      {/* Hero — resume reading */}
      <div className="px-5 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="pointer-events-none absolute -left-14 -bottom-14 h-64 w-64 text-gold/25" />
          <Arabesque className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 text-white/10" />
          <div className="grain-overlay absolute inset-0" />

          <div className="relative flex items-center justify-between">
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] backdrop-blur">
              كتاب الله
            </div>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-white/70">
                <Icon d={icons.flame} size={12} />
                {toArabicDigits(streak)} يوم متتابع
              </span>
            )}
          </div>

          <div className="relative mt-6">
            {last ? (
              <>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                  تابع من حيث توقفت
                </div>
                <div className="mt-1 font-display text-3xl font-medium leading-snug">
                  سورة {SURAH_META[last.surah - 1].nameAr}
                </div>
                <p className="mt-1.5 text-xs font-light text-white/70 tabular-nums">
                  الآية {toArabicDigits(last.ayah)} · صفحة {toArabicDigits(last.page)} ·{" "}
                  <Relative at={last.at} />
                </p>
              </>
            ) : (
              <>
                <div className="font-display text-3xl font-medium leading-snug">
                  اقرأ. تدبّر. ارتقِ.
                </div>
                <p className="mt-2 max-w-[16rem] text-xs font-light leading-relaxed text-white/70">
                  مساحتك القرآنية داخل منار — مصحف كامل، تفسير وتلاوات بدون إنترنت.
                </p>
              </>
            )}
          </div>

          <Link
            to="/quran/mushaf"
            search={
              last
                ? { surah: last.surah, ayah: last.ayah, mode: "surah" as const }
                : { surah: 1, mode: "surah" as const }
            }
            className="relative mt-5 flex items-center justify-center gap-2 rounded-2xl bg-white/15 py-3 text-[13px] font-medium backdrop-blur transition active:scale-[0.98]"
          >
            <Icon d={icons.quran} size={16} />
            {last ? "متابعة القراءة" : "ابدأ من الفاتحة"}
          </Link>

          <div className="relative mt-5 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="gradient-gold h-full transition-all duration-700"
                style={{ width: `${Math.max(2, percent)}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-white/70">
              {toArabicDigits(percent)}٪ من الختمة
            </span>
          </div>
        </div>
      </div>

      {/* Live stats */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 px-5">
        <StatPill label="العلامات" value={toArabicDigits(bookmarks.length)} to="/quran/bookmarks" />
        <StatPill label="سلسلة الأيام" value={toArabicDigits(streak)} to="/quran/last-read" />
        <StatPill label="الختمة" value={`${toArabicDigits(percent)}٪`} to="/quran/last-read" />
      </div>

      <SectionLabel hint="٦ أقسام">أقسام القرآن</SectionLabel>

      <div className="grid grid-cols-2 gap-3 px-5 stagger">
        {CARDS.map((c) => (
          <QuranCard key={c.to} {...c} />
        ))}
      </div>

      <div className="mt-8 px-5">
        <Link
          to="/quran/last-read"
          className="glass flex items-center gap-3 rounded-2xl border border-border/60 p-4 text-right"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Icon d={icons.sparkle} size={18} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">وِردك اليومي</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              تابع سلسلة أيامك وتقدّمك في الختمة.
            </p>
          </div>
          <span className="rotate-180 text-muted-foreground">
            <Icon d={icons.chevron} size={14} />
          </span>
        </Link>
      </div>
    </Screen>
  );
}

function StatPill({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border/60 bg-card/70 p-3 text-center shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5"
    >
      <div className="font-display text-xl font-medium tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </Link>
  );
}

function QuranCard({ to, title, hint, iconKey, accent }: Card) {
  const accentClasses: Record<Card["accent"], string> = {
    primary: "from-primary/15 to-primary/0 text-primary",
    gold: "from-gold/20 to-gold/0 text-gold",
    night: "from-foreground/10 to-foreground/0 text-foreground",
  };
  return (
    <Link
      to={to}
      className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-4 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <Arabesque className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 text-primary/10 opacity-70" />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentClasses[accent]}`}
      />

      <div className="relative flex items-start justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/70 shadow-soft ${
            accent === "gold"
              ? "text-gold"
              : accent === "primary"
                ? "text-primary"
                : "text-foreground"
          }`}
        >
          <Icon d={icons[iconKey]} size={20} />
        </span>
        <span className="rotate-180 text-muted-foreground opacity-0 transition group-hover:opacity-100">
          <Icon d={icons.chevron} size={14} />
        </span>
      </div>

      <div className="relative">
        <div className="font-display text-lg font-medium leading-tight">{title}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </Link>
  );
}

/** Client-only relative time (avoids SSR/CSR mismatch). */
function Relative({ at }: { at: number }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => setLabel(formatRelativeArabic(at)), [at]);
  return <>{label ?? ""}</>;
}
