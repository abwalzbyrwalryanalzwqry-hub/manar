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
                {activeSurah.nameAr}
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {activeSurah.nameEn} · قارئ منار
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
            value={activeSurah.nameAr}
            iconKey="quran"
            onClick={() => setSurahOpen(true)}
          />
          <SelectorPill
            label="الجزء"
            value={toArabicDigits(activeJuz.id)}
            iconKey="bookmark"
            onClick={() => setJuzOpen(true)}
          />
        </div>

        {/* Dynamic reading progress card — driven by repository */}
        <div key={`progress-${activeSurah.id}-${activeJuz.id}`} className="mt-4 px-4 animate-fade-up">
          <div className="glass rounded-3xl border border-border/60 p-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2">
                <span className="text-[9px] uppercase tracking-[0.25em] text-gold">
                  الجزء
                </span>
                <span className="font-display text-xl font-medium tabular-nums text-foreground">
                  {toArabicDigits(activeJuz.id)}
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
                  سورة {activeSurah.nameAr}
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {revelationLabel} · {toArabicDigits(activeSurah.ayatCount)} آية
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="gradient-gold h-full transition-all duration-700"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    يبدأ عند: سورة {SURAH_LIST[activeJuz.start.surah - 1].nameAr} · آية {toArabicDigits(activeJuz.start.ayah)}
                  </span>
                  <span className="tabular-nums">
                    {toArabicDigits(progressPercent)}٪
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Surah metadata — driven by repository */}
        <section
          key={`meta-${activeSurah.id}`}
          className="mt-5 px-4 animate-fade-up"
          aria-label="بطاقة السورة"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-5 shadow-elegant backdrop-blur-2xl">
            <Arabesque className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 text-primary/10" />
            <Arabesque className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 text-gold/15" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-soft">
                <Icon d={icons.quran} size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {activeSurah.nameEn} · {activeSurah.meaningEn}
                </div>
                <h2 className="mt-0.5 font-display text-2xl font-medium leading-snug">
                  سورة {activeSurah.nameAr}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Chip
                    tone={activeSurah.revelation === "makki" ? "gold" : "primary"}
                    label={revelationLabel}
                  />
                  <Chip label={`ترتيبها ${toArabicDigits(activeSurah.id)}`} />
                  <Chip label={`نزولها ${toArabicDigits(activeSurah.revelationOrder)}`} />
                </div>
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-2.5">
              <MetaStat label="عدد الآيات" value={toArabicDigits(activeSurah.ayatCount)} />
              <MetaStat
                label="الجزء"
                value={formatRangeAr(activeSurah.juz.start, activeSurah.juz.end)}
              />
              <MetaStat
                label="الحزب"
                value={formatRangeAr(activeSurah.hizb.start, activeSurah.hizb.end)}
              />
              <MetaStat
                label="الصفحات"
                value={formatRangeAr(activeSurah.pages.start, activeSurah.pages.end)}
              />
              <MetaStat
                label="تبدأ في صفحة"
                value={toArabicDigits(activeSurah.pages.start)}
              />
              <MetaStat
                label="تنتهي في صفحة"
                value={toArabicDigits(activeSurah.pages.end)}
              />
            </div>

            {detail?.summaryAr && (
              <div className="relative mt-4 rounded-2xl border border-border/40 bg-background/50 p-3.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-gold">
                  نبذة
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">
                  {detail.summaryAr}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Scrollable reading container — awaiting verses in the next phase */}
        <section className="mt-5 px-4 animate-fade-up" aria-label="منطقة قراءة الآيات">
          <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/60 shadow-elegant backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-3 rounded-[26px] border border-gold/25" />
            <div className="pointer-events-none absolute inset-5 rounded-[22px] border border-gold/10" />
            {["top-4 right-4", "top-4 left-4", "bottom-4 right-4", "bottom-4 left-4"].map(
              (pos) => (
                <span
                  key={pos}
                  className={`pointer-events-none absolute ${pos} h-4 w-4 rotate-45 border border-gold/40`}
                />
              ),
            )}

            <div
              key={`reader-${activeSurah.id}`}
              className="relative max-h-[62vh] min-h-[360px] overflow-y-auto px-7 py-10"
              dir="rtl"
              data-quran-reader-scroll
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-gold">
                  المرحلة القادمة
                </span>
                <div className="font-display text-lg leading-relaxed text-foreground/70">
                  سورة {activeSurah.nameAr}
                </div>
                <div className="h-px w-16 bg-gold/40" />
                <p className="max-w-[20rem] text-[12px] leading-relaxed text-muted-foreground">
                  الحاوية جاهزة لاستقبال الآيات بالخط العثماني بإذن الله.
                </p>
              </div>
            </div>
          </div>
        </section>

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
                const active = s.id === state.surah;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        update({ surah: s.id });
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
                        {toArabicDigits(s.id)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-base font-medium">
                          {s.nameAr}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {REVELATION_LABEL_AR[s.revelation]} · {toArabicDigits(s.ayatCount)} آية
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
              {JUZ_LIST_META.map((j) => {
                const active = j.id === state.juz;
                const startSurah = SURAH_LIST[j.start.surah - 1];
                return (
                  <button
                    key={j.id}
                    onClick={() => {
                      update({ juz: j.id });
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
                      {toArabicDigits(j.id)}
                    </span>
                    <span className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                      {startSurah.nameAr} · {toArabicDigits(j.start.ayah)}
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
