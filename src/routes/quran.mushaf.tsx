import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SurahRenderer } from "@/components/manar/surah-renderer";
import { MushafPageRenderer } from "@/components/manar/mushaf-page-renderer";
import { useSurahText } from "@/hooks/use-surah-text";
import { useMushafPage } from "@/hooks/use-mushaf-page";
import {
  clampPage,
  MUSHAF_PAGE_COUNT,
  quranPageService,
  surahIdsOnPage,
} from "@/lib/quran/page-service";
import { Arabesque, Icon, icons } from "@/components/manar/shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { quranRepository, toArabicDigits, REVELATION_LABEL_AR, formatRangeAr } from "@/lib/quran";
import { formatRelativeArabic, readReaderState, useReaderState } from "@/lib/quran-reader-state";
import { isBookmarked, toggleBookmark, useBookmarks } from "@/lib/quran/bookmarks";
import { recordRead } from "@/lib/quran/reading-history";
import {
  juzOf,
  MIN_PAGE_DWELL_MS,
  notePagesRead,
  PageDwellTracker,
  pageStart,
} from "@/lib/quran/reading-tracker";
import { SURAH_META } from "@/lib/quran/metadata";
import { buildShareText, shareCardText } from "@/lib/quran/share-card";
import { searchSurahNames } from "@/lib/quran/search-service";
import type { AyahText } from "@/lib/quran/text-types";

/** Deep links: /quran/mushaf?surah=2&ayah=255 or ?page=300&mode=mushaf */
export const Route = createFileRoute("/quran/mushaf")({
  head: () => ({ meta: [{ title: "المصحف — منار" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { surah?: number; ayah?: number; page?: number; mode?: "surah" | "mushaf" } => {
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
    };
    const mode =
      search.mode === "mushaf" ? "mushaf" : search.mode === "surah" ? "surah" : undefined;
    return {
      surah: num(search.surah),
      ayah: num(search.ayah),
      page: num(search.page),
      mode,
    };
  },
  component: MushafReader,
});

const SURAH_LIST = quranRepository.listSurahs();
const JUZ_LIST_META = quranRepository.listJuz();

function MushafReader() {
  const navigate = useNavigate();
  const params = Route.useSearch();
  const [state, update] = useReaderState();
  const [targetAyah, setTargetAyah] = useState<number | null>(params.ayah ?? null);
  const [sheet, setSheet] = useState<{ surah: number; ayah: AyahText } | null>(null);
  /** الآية الظاهرة الآن في وضع السورة (تتبع التمرير). */
  const [position, setPosition] = useState<{ surah: number; ayah: AyahText } | null>(null);
  useBookmarks(); // يعيد العرض عند تغيّر العلامات (زر الحفظ)
  const appliedRef = useRef(false);

  // Apply incoming deep-link parameters once.
  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const patch: Parameters<typeof update>[0] = {};
    if (params.surah && params.surah >= 1 && params.surah <= 114) {
      patch.surah = params.surah;
      patch.mode = params.mode ?? "surah";
    }
    if (params.page) {
      patch.page = clampPage(params.page);
      patch.mode = params.mode ?? "mushaf";
    }
    if (params.mode) patch.mode = params.mode;
    if (Object.keys(patch).length) update(patch);
    if (params.ayah) setTargetAyah(params.ayah);
    // بلا رابط مباشر: نستأنف من الآية التي وقف عندها القارئ.
    else if (!params.surah && !params.page) {
      const saved = readReaderState();
      if (saved.mode !== "mushaf" && saved.ayah && saved.ayah > 1) setTargetAyah(saved.ayah);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const activeSurah = quranRepository.getSurah(state.surah) ?? quranRepository.getSurah(1)!;
  const activeJuz = quranRepository.getJuz(state.juz) ?? quranRepository.getJuz(1)!;
  const detail = quranRepository.getSurahDetail(activeSurah.id);

  // In Mushaf mode the header follows the page being read, like a printed Mushaf.
  const headerSurah = useMemo(() => {
    if (state.mode !== "mushaf") return activeSurah;
    const p = state.page ?? 1;
    const ids = surahIdsOnPage(p);
    return quranRepository.getSurah(ids[ids.length - 1]) ?? activeSurah;
  }, [state.mode, state.page, activeSurah]);

  const filteredSurahs = useMemo(() => {
    const q = query.trim();
    if (!q) return SURAH_LIST;
    // مطابقة مطبّعة: «الانعام» تجد «الأنعام»، و«٦» تجد السورة السادسة.
    const ids = new Set(searchSurahNames(q, 114).map((s) => s.id));
    return SURAH_LIST.filter((s) => ids.has(s.id));
  }, [query]);

  const revelationLabel = REVELATION_LABEL_AR[activeSurah.revelation];
  const isSurahMode = state.mode !== "mushaf";
  const pageNumber = clampPage(state.page || 1);
  // الموضع الحقيقي داخل السورة (لا رقم الجزء ÷ ٣٠).
  const here = position?.surah === activeSurah.id ? position.ayah : null;
  const hereAyah = here?.n ?? 1;
  const hereJuz = quranRepository.getJuz(here?.j ?? activeJuz.id) ?? activeJuz;
  const progressPercent = Math.round((hereAyah / activeSurah.ayatCount) * 100);
  const savedHere = here ? isBookmarked(activeSurah.id, here.n) : false;

  /** تبديل الوضع مع الحفاظ على الموضع: الصفحة ↔ السورة والآية. */
  const switchMode = (m: "surah" | "mushaf") => {
    if (m === state.mode) return;
    if (m === "mushaf") {
      update({ mode: m, page: here?.p ?? activeSurah.pages.start });
    } else {
      const start = pageStart(pageNumber);
      update({ mode: m, surah: start.surah, ayah: start.ayah });
      setTargetAyah(start.ayah);
    }
  };

  const onPosition = useCallback(
    (a: AyahText) => setPosition({ surah: activeSurah.id, ayah: a }),
    [activeSurah.id],
  );
  const onSettled = useCallback(
    (a: AyahText) => {
      update({ ayah: a.n, juz: a.j });
    },
    [update],
  );

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
                {headerSurah.nameAr}
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {headerSurah.nameEn} · قارئ منار
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
                    <span className="text-[10px] font-medium text-foreground/90">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Reading mode switch — السورة / المصحف */}
        <div className="mt-4 px-4">
          <div className="glass grid grid-cols-2 gap-1 rounded-full border border-border/60 p-1.5 shadow-soft">
            {(["surah", "mushaf"] as const).map((m) => {
              const active = state.mode === m;
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`rounded-full py-2 text-[12px] font-medium transition active:scale-95 ${
                    active
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  {m === "surah" ? "السورة" : "المصحف"}
                </button>
              );
            })}
          </div>
        </div>

        {isSurahMode && (
          <>
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
                value={toArabicDigits(hereJuz.id)}
                iconKey="bookmark"
                onClick={() => setJuzOpen(true)}
              />
            </div>

            {/* Dynamic reading progress card — driven by repository */}
            <div key={`progress-${activeSurah.id}`} className="mt-4 px-4 animate-fade-up">
              <div className="glass rounded-3xl border border-border/60 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2">
                    <span className="text-[9px] uppercase tracking-[0.25em] text-gold">الجزء</span>
                    <span className="font-display text-xl font-medium tabular-nums text-foreground">
                      {toArabicDigits(hereJuz.id)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-foreground/80">آخر قراءة</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        <RelativeTime at={state.updatedAt} />
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
                      <span className="tabular-nums">
                        الآية {toArabicDigits(hereAyah)} من {toArabicDigits(activeSurah.ayatCount)}
                        {here ? ` · صفحة ${toArabicDigits(here.p)}` : ""}
                      </span>
                      <span className="tabular-nums">{toArabicDigits(progressPercent)}٪</span>
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
                  <MetaStat label="تبدأ في صفحة" value={toArabicDigits(activeSurah.pages.start)} />
                  <MetaStat label="تنتهي في صفحة" value={toArabicDigits(activeSurah.pages.end)} />
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

            {/* Scrollable reading container — authentic Uthmani text */}
            <MushafReadingArea
              surahId={activeSurah.id}
              surahNameAr={activeSurah.nameAr}
              activeAyah={targetAyah}
              onAyahTap={(a) => setSheet({ surah: activeSurah.id, ayah: a })}
              onPosition={onPosition}
              onSettled={onSettled}
            />
          </>
        )}

        {!isSurahMode && (
          <MushafPagesMode
            page={pageNumber}
            onChange={(p) => update({ page: clampPage(p) })}
            onAyahTap={(surah, ayah) => setSheet({ surah, ayah })}
          />
        )}
        {isSurahMode && (
          <>
            {/* Primary action bar */}
            <div className="mt-5 px-4">
              <div className="glass grid grid-cols-5 gap-1 rounded-full border border-border/60 p-1.5 shadow-soft">
                <ReaderAction icon={icons.bookmark} label="آخر قراءة" to="/quran/last-read" />
                <ReaderAction icon={icons.info} label="التفسير" to="/quran/tafsir" />
                <ReaderAction icon={icons.play} label="الصوت" to="/quran/recitations" />
                <ReaderAction icon={icons.search} label="بحث" to="/quran/search" />
                <ReaderAction
                  icon={icons.bookmark}
                  label={savedHere ? "محفوظة" : "حفظ"}
                  active={savedHere}
                  disabled={!here}
                  ariaLabel={
                    here
                      ? `${savedHere ? "إزالة علامة" : "حفظ علامة على"} الآية ${here.n}`
                      : "حفظ الآية الظاهرة"
                  }
                  onClick={() => {
                    if (!here) return;
                    toggleBookmark({
                      surah: activeSurah.id,
                      ayah: here.n,
                      page: here.p,
                      juz: here.j,
                      text: here.t,
                      tag: "tadabbur",
                    });
                  }}
                />
              </div>
            </div>

            {/* Secondary tools */}
            <div className="mt-4 grid grid-cols-2 gap-3 px-4 stagger">
              <ToolCard
                iconKey="settings"
                title="إعدادات القراءة"
                hint="الخط والحجم"
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
              انقر أي آية لتفسيرها أو حفظها أو الاستماع إليها. زر «حفظ» يضع علامة على الآية الظاهرة
              أعلى القراءة.
            </p>
          </>
        )}
      </div>

      {/* -------- Surah picker modal -------- */}
      <Dialog open={surahOpen} onOpenChange={setSurahOpen}>
        <DialogContent
          className="max-w-md rounded-3xl border-border/60 bg-card/95 p-0 backdrop-blur-2xl sm:rounded-3xl"
          dir="rtl"
        >
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
                        // في وضع المصحف ننتقل إلى صفحة بداية السورة.
                        update(
                          isSurahMode
                            ? { surah: s.id, ayah: 1, juz: s.juz.start }
                            : { surah: s.id, page: s.pages.start },
                        );
                        setTargetAyah(null);
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
        <DialogContent
          className="max-w-md rounded-3xl border-border/60 bg-card/95 p-0 backdrop-blur-2xl sm:rounded-3xl"
          dir="rtl"
        >
          <DialogHeader className="px-5 pt-5 text-right">
            <DialogTitle className="font-display text-xl">اختر الجزء</DialogTitle>
            <p className="text-[11px] text-muted-foreground">٣٠ جزءًا · القرآن الكريم</p>
          </DialogHeader>

          <div className="mt-3 max-h-[65vh] overflow-y-auto px-4 pb-5">
            <div className="grid grid-cols-3 gap-2">
              {JUZ_LIST_META.map((j) => {
                const active = j.id === hereJuz.id;
                const startSurah = SURAH_LIST[j.start.surah - 1];
                return (
                  <button
                    key={j.id}
                    onClick={() => {
                      // ينقل فعلاً إلى بداية الجزء.
                      update({ juz: j.id, surah: j.start.surah, ayah: j.start.ayah });
                      setTargetAyah(j.start.ayah);
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

      {/* -------- Per-ayah actions -------- */}
      <AyahActionSheet
        surah={sheet?.surah ?? activeSurah.id}
        surahNameAr={SURAH_META[(sheet?.surah ?? activeSurah.id) - 1].nameAr}
        ayah={sheet?.ayah ?? null}
        onClose={() => setSheet(null)}
        onPlay={(surah, ayah) => {
          setSheet(null);
          navigate({ to: "/quran/recitations", search: { surah, ayah } });
        }}
        onTafsir={(surah, ayah) => {
          setSheet(null);
          navigate({ to: "/quran/tafsir", search: { surah, ayah } });
        }}
        onShare={(surah, ayah) => {
          setSheet(null);
          navigate({ to: "/quran/share", search: { surah, ayah } });
        }}
      />
    </div>
  );
}

/* ---------- Per-ayah action sheet ---------- */

function AyahActionSheet({
  surah,
  surahNameAr,
  ayah,
  onClose,
  onPlay,
  onTafsir,
  onShare,
}: {
  surah: number;
  surahNameAr: string;
  ayah: AyahText | null;
  onClose: () => void;
  onPlay: (surah: number, ayah: number) => void;
  onTafsir: (surah: number, ayah: number) => void;
  onShare: (surah: number, ayah: number) => void;
}) {
  useBookmarks(); // re-render when the bookmark set changes
  const [copied, setCopied] = useState(false);
  const saved = ayah ? isBookmarked(surah, ayah.n) : false;

  useEffect(() => {
    setCopied(false);
  }, [surah, ayah?.n]);

  return (
    <Dialog open={!!ayah} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md rounded-3xl border-border/60 bg-card/95 backdrop-blur-2xl sm:rounded-3xl"
        dir="rtl"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="font-display text-lg">
            سورة {surahNameAr} · الآية {toArabicDigits(ayah?.n ?? 1)}
          </DialogTitle>
        </DialogHeader>

        {ayah && (
          <>
            <p className="max-h-40 overflow-y-auto rounded-2xl border border-gold/20 bg-background/60 p-3 text-center font-quran text-[17px] leading-[2.1]">
              {ayah.t}
            </p>

            <div className="grid grid-cols-4 gap-2">
              <SheetAction
                icon={icons.bookmark}
                label={saved ? "محفوظة" : "حفظ"}
                active={saved}
                onClick={() =>
                  toggleBookmark({
                    surah,
                    ayah: ayah.n,
                    page: ayah.p,
                    juz: ayah.j,
                    text: ayah.t,
                    tag: "tadabbur",
                  })
                }
              />
              <SheetAction
                icon={icons.info}
                label="التفسير"
                onClick={() => onTafsir(surah, ayah.n)}
              />
              <SheetAction
                icon={icons.share}
                label="مشاركة"
                onClick={() => onShare(surah, ayah.n)}
              />
              <SheetAction icon={icons.play} label="تلاوة" onClick={() => onPlay(surah, ayah.n)} />
            </div>

            <button
              onClick={async () => {
                await shareCardText(
                  buildShareText({
                    text: ayah.t,
                    surahNameAr,
                    ayahFrom: ayah.n,
                    ayahTo: ayah.n,
                  }),
                );
                setCopied(true);
              }}
              className="rounded-2xl border border-border/60 bg-background/70 py-2.5 text-[12px] font-medium transition active:scale-[0.98]"
            >
              {copied ? "تم نسخ الآية" : "نسخ نص الآية"}
            </button>

            <div className="text-center text-[10px] text-muted-foreground tabular-nums">
              صفحة {toArabicDigits(ayah.p)} · الجزء {toArabicDigits(ayah.j)}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  active,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition active:scale-95 ${
        active
          ? "border-gold/50 bg-gold/15 text-gold"
          : "border-border/50 bg-background/60 text-foreground/85 hover:shadow-soft"
      }`}
    >
      <Icon d={icon} size={18} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

/* ---------- Reading area (loads Uthmani text via service) ---------- */

/** مهلة استقرار التمرير قبل حفظ الموضع. */
const SETTLE_MS = 1200;
/** نتجاهل التمرير الآلي إلى الآية المستهدفة عند الفتح. */
const AUTO_SCROLL_MS = 1500;

function MushafReadingArea({
  surahId,
  surahNameAr,
  activeAyah,
  onAyahTap,
  onPosition,
  onSettled,
}: {
  surahId: number;
  surahNameAr: string;
  activeAyah?: number | null;
  onAyahTap?: (ayah: AyahText) => void;
  /** الآية الظاهرة أعلى منطقة القراءة، مع كل تمرير. */
  onPosition?: (ayah: AyahText) => void;
  /** الموضع بعد استقرار التمرير (يُحفظ). */
  onSettled?: (ayah: AyahText) => void;
}) {
  const state = useSurahText(surahId);
  const [reloadKey, setReloadKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef(new PageDwellTracker());
  const ignoreUntilRef = useRef(0);

  const ayahs = state.status === "ready" ? state.data.ayahs : null;

  const save = useCallback(
    (a: AyahText) => {
      recordRead({ surah: surahId, ayah: a.n, page: a.p, juz: a.j, mode: "surah" });
      onSettled?.(a);
    },
    [surahId, onSettled],
  );

  // Record the reading session once the text is on screen.
  useEffect(() => {
    if (!ayahs) return;
    const target = ayahs.find((a) => a.n === (activeAyah ?? 1)) ?? ayahs[0];
    if (!target) return;
    ignoreUntilRef.current = Date.now() + AUTO_SCROLL_MS;
    trackerRef.current.reset();
    trackerRef.current.visit(target.p, Date.now());
    onPosition?.(target);
    save(target);
  }, [activeAyah, ayahs, surahId, onPosition, save]);

  // تتبع موضع القراءة الفعلي مع التمرير.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ayahs) return;
    let frame = 0;
    let settle = 0;
    let last: AyahText | null = null;
    const byN = new Map(ayahs.map((a) => [a.n, a]));

    const topAyah = (): AyahText | null => {
      const top = el.getBoundingClientRect().top + 24;
      const nodes = el.querySelectorAll<HTMLElement>("[data-ayah]");
      for (const node of nodes) {
        if (node.getBoundingClientRect().bottom > top) {
          return byN.get(Number(node.dataset.ayah)) ?? null;
        }
      }
      return null;
    };

    const measure = () => {
      frame = 0;
      if (Date.now() < ignoreUntilRef.current) return;
      const a = topAyah();
      if (!a) return;
      const now = Date.now();
      const tracker = trackerRef.current;
      notePagesRead(tracker.visit(a.p, now));
      // نهاية السورة: الصفحة الأخيرة تُعدّ مقروءة إن لم تتبعها سورة أخرى على الصفحة نفسها.
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (atEnd) {
        const lastAyah = ayahs[ayahs.length - 1];
        const endsHere = lastAyah.p === 604 || pageStart(lastAyah.p + 1).surah > surahId;
        if (endsHere) notePagesRead(tracker.finish(now));
      }
      if (a !== last) {
        last = a;
        onPosition?.(a);
      }
      window.clearTimeout(settle);
      settle = window.setTimeout(() => last && save(last), SETTLE_MS);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [ayahs, surahId, onPosition, save]);
  return (
    <section className="mt-5 px-4 animate-fade-up" aria-label="منطقة قراءة الآيات" key={reloadKey}>
      <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/60 shadow-elegant backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-3 rounded-[26px] border border-gold/25" />
        <div className="pointer-events-none absolute inset-5 rounded-[22px] border border-gold/10" />
        {["top-4 right-4", "top-4 left-4", "bottom-4 right-4", "bottom-4 left-4"].map((pos) => (
          <span
            key={pos}
            className={`pointer-events-none absolute ${pos} h-4 w-4 rotate-45 border border-gold/40`}
          />
        ))}

        <div
          className="relative max-h-[68vh] min-h-[380px] overflow-y-auto overscroll-contain px-6 py-8 scroll-smooth"
          dir="rtl"
          data-quran-reader-scroll
          ref={scrollRef}
        >
          <SurahRenderer
            surahId={surahId}
            surahNameAr={surahNameAr}
            state={state}
            onRetry={() => setReloadKey((k) => k + 1)}
            activeAyah={activeAyah}
            onAyahTap={onAyahTap}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- Mushaf pages mode (1..604) ---------- */

function MushafPagesMode({
  page,
  onChange,
  onAyahTap,
}: {
  page: number;
  onChange: (page: number) => void;
  onAyahTap: (surah: number, ayah: AyahText) => void;
}) {
  const state = useMushafPage(page);
  const trackerRef = useRef(new PageDwellTracker());

  // الصفحة المقروءة: الانتقال إلى التالية بعد مكوث كافٍ، أو المكوث على الأخيرة.
  useEffect(() => {
    notePagesRead(trackerRef.current.visit(page, Date.now()));
    if (page !== MUSHAF_PAGE_COUNT) return;
    const t = window.setTimeout(
      () => notePagesRead(trackerRef.current.finish(Date.now())),
      MIN_PAGE_DWELL_MS,
    );
    return () => window.clearTimeout(t);
  }, [page]);

  // موضع القارئ في وضع المصحف يُسجَّل بعد استقرار قصير على الصفحة.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const start = pageStart(page);
      recordRead({ ...start, page, juz: juzOf(start.surah, start.ayah), mode: "mushaf" });
    }, SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [page]);
  const [reloadKey, setReloadKey] = useState(0);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState(String(page));
  const [drag, setDrag] = useState(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (delta: number) => {
      const next = clampPage(page + delta);
      if (next !== page) onChange(next);
    },
    [page, onChange],
  );

  useEffect(() => {
    quranPageService.prefetch([page - 2, page - 1, page + 1, page + 2, page + 3]);
  }, [page]);

  return (
    <section className="mt-3 px-3" aria-label="وضع المصحف">
      {/* Printed page surface — full screen, never scrolls, never clipped */}
      <div
        className="relative select-none overflow-hidden rounded-[26px] border border-border/60 bg-card/85 shadow-elegant backdrop-blur-2xl"
        key={reloadKey}
        style={{ touchAction: "pan-y pinch-zoom" }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchRef.current = { x: t.clientX, y: t.clientY };
          setDrag(0);
        }}
        onTouchMove={(e) => {
          const start = touchRef.current;
          if (!start) return;
          const t = e.touches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) > Math.abs(dy)) setDrag(Math.max(-80, Math.min(80, dx)));
        }}
        onTouchEnd={(e) => {
          const start = touchRef.current;
          touchRef.current = null;
          setDrag(0);
          if (!start) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          // كالمصحف الورقي: السحب نحو اليمين يقلب إلى الصفحة التالية.
          go(dx > 0 ? 1 : -1);
        }}
      >
        <div className="pointer-events-none absolute inset-2.5 rounded-[20px] border border-gold/25" />

        <div
          className="relative h-[calc(100dvh-172px)] min-h-[420px] overflow-hidden px-5 pt-4 pb-3"
          dir="rtl"
          style={{
            transform: `translateX(${drag}px)`,
            transition: drag === 0 ? "transform 200ms ease-out" : "none",
          }}
        >
          <MushafPageRenderer
            page={page}
            state={state}
            onRetry={() => setReloadKey((k) => k + 1)}
            onAyahTap={onAyahTap}
          />
        </div>
      </div>

      {/* Page navigation — previous is on the right, next on the left */}
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button
          onClick={() => go(-1)}
          disabled={page <= 1}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/70 text-foreground shadow-soft transition disabled:opacity-40 active:scale-95"
          aria-label="الصفحة السابقة"
        >
          <Icon d={icons.chevron} size={18} />
        </button>
        <button
          onClick={() => {
            setJumpValue(String(page));
            setJumpOpen(true);
          }}
          className="rounded-full border border-border/60 bg-card/70 py-2.5 text-[12px] font-medium tabular-nums shadow-soft transition active:scale-[0.98]"
        >
          صفحة {toArabicDigits(page)} من {toArabicDigits(MUSHAF_PAGE_COUNT)}
        </button>
        <button
          onClick={() => go(1)}
          disabled={page >= MUSHAF_PAGE_COUNT}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/70 text-foreground shadow-soft transition disabled:opacity-40 active:scale-95"
          aria-label="الصفحة التالية"
        >
          <span className="rotate-180">
            <Icon d={icons.chevron} size={18} />
          </span>
        </button>
      </div>

      <Dialog open={jumpOpen} onOpenChange={setJumpOpen}>
        <DialogContent
          className="max-w-sm rounded-3xl border-border/60 bg-card/95 backdrop-blur-2xl sm:rounded-3xl"
          dir="rtl"
        >
          <DialogHeader className="text-right">
            <DialogTitle className="font-display text-xl">الانتقال إلى صفحة</DialogTitle>
            <p className="text-[11px] text-muted-foreground">أدخل رقمًا بين ١ و ٦٠٤</p>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(jumpValue);
              if (Number.isFinite(n)) onChange(clampPage(n));
              setJumpOpen(false);
            }}
            className="grid gap-3"
          >
            <input
              type="number"
              min={1}
              max={MUSHAF_PAGE_COUNT}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              className="w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-center text-lg tabular-nums outline-none focus:border-primary/50"
              dir="ltr"
            />
            <button
              type="submit"
              className="gradient-primary rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow transition active:scale-[0.98]"
            >
              انتقال
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ---------- Sub-components ---------- */

const MORE_ACTIONS: { label: string; icon: string; to: string }[] = [
  { label: "مشاركة", icon: icons.share, to: "/quran/share" },
  { label: "العلامات", icon: icons.bookmark, to: "/quran/bookmarks" },
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
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
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
  disabled,
  ariaLabel,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const className = `flex flex-col items-center gap-1 rounded-full py-2 transition active:scale-95 disabled:opacity-40 ${
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
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
    >
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
        <div className="text-[13px] font-medium leading-tight">{title}</div>
        <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</div>
      </div>
      <span className="rotate-180 text-muted-foreground">
        <Icon d={icons.chevron} size={14} />
      </span>
    </Link>
  );
}

function Chip({ label, tone = "muted" }: { label: string; tone?: "muted" | "gold" | "primary" }) {
  const toneClass =
    tone === "gold"
      ? "border-gold/40 bg-gold/10 text-gold"
      : tone === "primary"
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border/60 bg-background/70 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl border border-border/50 p-3 text-right transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-medium tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

/** Client-only relative timestamp (avoids SSR/CSR text mismatch). */
function RelativeTime({ at }: { at: number }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(formatRelativeArabic(at));
  }, [at]);
  return <>{label ?? ""}</>;
}
