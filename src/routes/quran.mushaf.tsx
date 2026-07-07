import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Arabesque, Icon, icons } from "@/components/manar/shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  quranRepository,
  toArabicDigits,
  REVELATION_LABEL_AR,
  formatRangeAr,
} from "@/lib/quran";
import { formatRelativeArabic, useReaderState } from "@/lib/quran-reader-state";

export const Route = createFileRoute("/quran/mushaf")({
  head: () => ({ meta: [{ title: "المصحف — منار" }] }),
  component: MushafReader,
});

const SURAH_LIST = quranRepository.listSurahs();
const JUZ_LIST_META = quranRepository.listJuz();

function MushafReader() {
  const navigate = useNavigate();
  const [state, update] = useReaderState();
  const [showMore, setShowMore] = useState(false);
  const [surahOpen, setSurahOpen] = useState(false);
  const [juzOpen, setJuzOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Default to Al-Fatihah if no valid selection.
  useEffect(() => {
    if (!state.surah || state.surah < 1 || state.surah > 114) {
      update({ surah: 1 });
    }
  }, [state.surah, update]);

  const activeSurah =
    quranRepository.getSurah(state.surah) ?? quranRepository.getSurah(1)!;
  const activeJuz =
    quranRepository.getJuz(state.juz) ?? quranRepository.getJuz(1)!;
  const detail = quranRepository.getSurahDetail(activeSurah.id);

  const filteredSurahs = useMemo(() => {
    const q = query.trim();
    if (!q) return SURAH_LIST;
    return SURAH_LIST.filter(
      (s) =>
        s.nameAr.includes(q) ||
        s.nameEn.toLowerCase().includes(q.toLowerCase()) ||
        String(s.id).includes(q),
    );
  }, [query]);

  const revelationLabel = REVELATION_LABEL_AR[activeSurah.revelation];
  const progressPercent = Math.round((state.juz / 30) * 100);

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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 text-foreground shadow-soft transition hover:shadow-elegant active:scale-95"
              aria-label="رجوع"
            >
              <span className="rotate-180">
                <Icon d={icons.back} size={18} />
              </span>
            </Link>
            <button
              onClick={() => setSurahOpen(true)}
              className="min-w-0 text-center transition active:scale-[0.98]"
            >
              <div className="font-display text-base font-medium leading-tight truncate">
                {activeSurah.name}
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                المصحف · قارئ منار
              </div>
            </button>
            <button
              onClick={() => setShowMore((v) => !v)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 text-foreground shadow-soft transition hover:shadow-elegant active:scale-95 ${
                showMore ? "ring-2 ring-primary/40" : ""
              }`}
              aria-label="خيارات"
              aria-expanded={showMore}
            >
              <Icon d={icons.more} size={18} />
            </button>
          </div>

          {/* More options popover */}
          {showMore && (
            <div className="mx-4 mt-2 animate-scale-in rounded-2xl border border-border/60 bg-card/90 p-2 shadow-elegant backdrop-blur-2xl">
              <div className="grid grid-cols-3 gap-2">
                {MORE_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => {
                      setShowMore(false);
                      navigate({ to: a.to });
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-background/60 p-3 text-center transition hover:-translate-y-0.5 hover:shadow-soft active:scale-95"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon d={a.icon} size={16} />
                    </span>
                    <span className="text-[10px] font-medium text-foreground/90">
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Selectors row */}
        <div className="mt-4 grid grid-cols-2 gap-3 px-4 stagger">
          <SelectorPill
            label="السورة"
            value={activeSurah.name}
            iconKey="quran"
            onClick={() => setSurahOpen(true)}
          />
          <SelectorPill
            label="الجزء"
            value={toArabicDigits(activeJuz.number)}
            iconKey="bookmark"
            onClick={() => setJuzOpen(true)}
          />
        </div>

        {/* Dynamic reading progress card */}
        <div className="mt-4 px-4 animate-fade-up">
          <div className="glass rounded-3xl border border-border/60 p-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2">
                <span className="text-[9px] uppercase tracking-[0.25em] text-gold">
                  الجزء
                </span>
                <span className="font-display text-xl font-medium tabular-nums text-foreground">
                  {toArabicDigits(activeJuz.number)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-foreground/80">
                    آخر قراءة
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {formatRelativeArabic(state.updatedAt)}
                  </span>
                </div>
                <div className="mt-1 truncate font-display text-sm">
                  سورة {activeSurah.name}
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {activeSurah.type} · {toArabicDigits(activeSurah.verses)} آية
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="gradient-gold h-full transition-all duration-700"
                    style={{ width: `${(state.juz / 30) * 100}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>يبدأ عند: {activeJuz.startsAt}</span>
                  <span className="tabular-nums">
                    {toArabicDigits(Math.round((state.juz / 30) * 100))}٪
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mushaf page placeholder */}
        <div className="mt-5 px-4 animate-fade-up">
          <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/70 shadow-elegant backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-3 rounded-[26px] border border-gold/25" />
            <div className="pointer-events-none absolute inset-5 rounded-[22px] border border-gold/10" />
            <Arabesque className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 text-primary/10" />
            <Arabesque className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 text-gold/15" />

            {["top-4 right-4", "top-4 left-4", "bottom-4 right-4", "bottom-4 left-4"].map(
              (pos) => (
                <span
                  key={pos}
                  className={`pointer-events-none absolute ${pos} h-4 w-4 rotate-45 border border-gold/40`}
                />
              ),
            )}

            <div className="relative flex min-h-[440px] flex-col items-center justify-center px-8 py-14 text-center">
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
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold">
                  قريبًا
                </span>
              </div>

              <h2 className="mt-5 font-display text-2xl font-medium leading-snug">
                سورة {activeSurah.name}
              </h2>
              <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
                نُجهّز حاليًا مصحفًا متكاملًا بخط عثماني واضح وتجربة قراءة فاخرة.
                ستضاف الآيات في المرحلة القادمة بإذن الله.
              </p>

              <div className="mt-6 flex items-center gap-2">
                <span className="h-px w-8 bg-gold/50" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  منار
                </span>
                <span className="h-px w-8 bg-gold/50" />
              </div>
            </div>
          </div>
        </div>

        {/* Primary action bar */}
        <div className="mt-5 px-4">
          <div className="glass grid grid-cols-5 gap-1 rounded-full border border-border/60 p-1.5 shadow-soft">
            <ReaderAction icon={icons.bookmark} label="آخر قراءة" to="/quran/last-read" />
            <ReaderAction icon={icons.info} label="التفسير" to="/quran/tafsir" />
            <ReaderAction icon={icons.play} label="الصوت" to="/quran/recitations" />
            <ReaderAction icon={icons.search} label="بحث" to="/quran/search" />
            <ReaderAction
              icon={icons.bookmark}
              label={state.bookmarked ? "محفوظ" : "حفظ"}
              active={state.bookmarked}
              onClick={() => update({ bookmarked: !state.bookmarked })}
            />
          </div>
        </div>

        {/* Secondary tools */}
        <div className="mt-4 grid grid-cols-2 gap-3 px-4 stagger">
          <ToolCard
            iconKey="settings"
            title="إعدادات القراءة"
            hint="الخط، الحجم، السطوع"
            to="/quran/reader-settings"
          />
          <ToolCard
            iconKey="bookmark"
            title="العلامات"
            hint="آياتك المحفوظة"
            to="/quran/bookmarks"
          />
        </div>

        <p className="mt-6 px-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          اختر السورة والجزء لتخصيص تجربة قراءتك. سيتم ربط الآيات في المرحلة القادمة.
        </p>
      </div>

      {/* -------- Surah picker modal -------- */}
      <Dialog open={surahOpen} onOpenChange={setSurahOpen}>
        <DialogContent className="max-w-md rounded-3xl border-border/60 bg-card/95 p-0 backdrop-blur-2xl sm:rounded-3xl" dir="rtl">
          <DialogHeader className="px-5 pt-5 text-right">
            <DialogTitle className="font-display text-xl">اختر السورة</DialogTitle>
            <p className="text-[11px] text-muted-foreground">١١٤ سورة · القرآن الكريم</p>
          </DialogHeader>

          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-2">
              <Icon d={icons.search} size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم السورة أو رقمها"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                dir="rtl"
              />
            </div>
          </div>

          <div className="mt-3 max-h-[65vh] overflow-y-auto px-3 pb-4">
            <ul className="grid gap-1.5">
              {filteredSurahs.map((s) => {
                const active = s.number === state.surah;
                return (
                  <li key={s.number}>
                    <button
                      onClick={() => {
                        update({ surah: s.number });
                        setSurahOpen(false);
                        setQuery("");
                      }}
                      className={`group flex w-full items-center gap-3 rounded-2xl border p-2.5 text-right transition active:scale-[0.98] ${
                        active
                          ? "border-primary/50 bg-primary/10 shadow-soft"
                          : "border-border/50 bg-background/60 hover:border-border hover:shadow-soft"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[11px] font-medium tabular-nums ${
                          active
                            ? "border-primary/40 bg-primary text-primary-foreground"
                            : "border-gold/30 bg-gold/10 text-gold"
                        }`}
                      >
                        {toArabicDigits(s.number)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-base font-medium">
                          {s.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.type} · {toArabicDigits(s.verses)} آية
                        </div>
                      </div>
                      {active && (
                        <span className="text-primary">
                          <Icon d={icons.check} size={16} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {filteredSurahs.length === 0 && (
                <li className="py-10 text-center text-sm text-muted-foreground">
                  لا توجد نتائج مطابقة
                </li>
              )}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      {/* -------- Juz picker modal -------- */}
      <Dialog open={juzOpen} onOpenChange={setJuzOpen}>
        <DialogContent className="max-w-md rounded-3xl border-border/60 bg-card/95 p-0 backdrop-blur-2xl sm:rounded-3xl" dir="rtl">
          <DialogHeader className="px-5 pt-5 text-right">
            <DialogTitle className="font-display text-xl">اختر الجزء</DialogTitle>
            <p className="text-[11px] text-muted-foreground">٣٠ جزءًا · القرآن الكريم</p>
          </DialogHeader>

          <div className="mt-3 max-h-[65vh] overflow-y-auto px-4 pb-5">
            <div className="grid grid-cols-3 gap-2">
              {JUZ_LIST.map((j) => {
                const active = j.number === state.juz;
                return (
                  <button
                    key={j.number}
                    onClick={() => {
                      update({ juz: j.number });
                      setJuzOpen(false);
                    }}
                    className={`flex flex-col items-center rounded-2xl border p-3 text-center transition active:scale-95 ${
                      active
                        ? "border-primary/50 bg-primary/10 shadow-soft"
                        : "border-border/50 bg-background/60 hover:-translate-y-0.5 hover:shadow-soft"
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                      الجزء
                    </span>
                    <span
                      className={`font-display text-2xl font-medium tabular-nums ${
                        active ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {toArabicDigits(j.number)}
                    </span>
                    <span className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                      {j.startsAt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Sub-components ---------- */

const MORE_ACTIONS: { label: string; icon: string; to: string }[] = [
  { label: "مشاركة", icon: icons.share, to: "/quran/share" },
  { label: "الليلي", icon: icons.moon, to: "/quran/reader-settings" },
  { label: "إعدادات", icon: icons.settings, to: "/quran/reader-settings" },
];

function SelectorPill({
  label,
  value,
  iconKey,
  onClick,
}: {
  label: string;
  value: string;
  iconKey: keyof typeof icons;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-3 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-110">
        <Icon d={icons[iconKey]} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 truncate font-display text-sm font-medium">{value}</div>
      </div>
      <span className="rotate-90 text-muted-foreground transition group-hover:translate-y-0.5">
        <Icon d={icons.chevron} size={14} />
      </span>
    </button>
  );
}

function ReaderAction({
  icon,
  label,
  active,
  onClick,
  to,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const className = `flex flex-col items-center gap-1 rounded-full py-2 transition active:scale-95 ${
    active
      ? "gradient-primary text-primary-foreground shadow-glow"
      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
  }`;
  const inner = (
    <>
      <Icon d={icon} size={16} />
      <span className="text-[9px] font-medium">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

function ToolCard({
  iconKey,
  title,
  hint,
  to,
}: {
  iconKey: keyof typeof icons;
  title: string;
  hint: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
        <Icon d={icons[iconKey]} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</div>
      </div>
      <span className="rotate-180 text-muted-foreground">
        <Icon d={icons.chevron} size={14} />
      </span>
    </Link>
  );
}
