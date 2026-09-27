import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { formatPercent } from "@/lib/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SurahRenderer } from "@/components/manar/surah-renderer";
import { MushafPageRenderer } from "@/components/manar/mushaf-page-renderer";
import { useSurahText } from "@/hooks/use-surah-text";
import { useMushafPage } from "@/hooks/use-mushaf-page";
import { useKeepAwake } from "@/hooks/use-keep-awake";
import { useImmersive } from "@/hooks/use-immersive";
import { useRecitationPlayer } from "@/hooks/use-recitation-player";
import { RecitationBar } from "@/components/manar/recitation-bar";
import { PAPER_OPTIONS, paperClass, useReadingPrefs } from "@/lib/quran/reading-prefs";
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
  pageOfAyah,
  pageStart,
} from "@/lib/quran/reading-tracker";
import { SURAH_META } from "@/lib/quran/metadata";
import { buildShareText, shareCardText } from "@/lib/quran/share-card";
import { searchSurahNames } from "@/lib/quran/search-service";
import { MAQASID_SOURCE, surahMaqasid } from "@/lib/quran/surah-maqasid";
import type { AyahText } from "@/lib/quran/text-types";

/** أيقونتا ملء الشاشة والخروج منه. */
const ICON_FULL = "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5";
const ICON_EXIT_FULL = "M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5";

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
  const { prefs: readingPrefs, update: updatePrefs } = useReadingPrefs();
  useKeepAwake(readingPrefs.keepAwake);
  const { immersive, enter: enterImmersive, exit: exitImmersive } = useImmersive();
  const paperLabel =
    PAPER_OPTIONS.find((o) => o.key === readingPrefs.paper)?.label ?? PAPER_OPTIONS[0].label;
  const cyclePaper = () => {
    const i = PAPER_OPTIONS.findIndex((o) => o.key === readingPrefs.paper);
    updatePrefs({ paper: PAPER_OPTIONS[(i + 1) % PAPER_OPTIONS.length].key });
  };
  const player = useRecitationPlayer();
  const [rangeFor, setRangeFor] = useState<{ surah: number; from: number } | null>(null);
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
  // «من مقاصد السورة» لكل السور (كانت «النبذة» لثلاث سور فقط من بيانات تجريبية).
  const maqasid = surahMaqasid(activeSurah.id);

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

  // تبديل ملء الشاشة يزيح النص؛ نعيد الآية الظاهرة إلى أعلى الشاشة.
  const hereRef = useRef(here);
  hereRef.current = here;
  const immersiveMounted = useRef(false);
  useEffect(() => {
    if (!immersiveMounted.current) {
      immersiveMounted.current = true;
      return;
    }
    const n = hereRef.current?.n;
    if (!isSurahMode || !n) return;
    const raf = requestAnimationFrame(() =>
      document
        .querySelector(`[aria-label="منطقة قراءة الآيات"] [data-ayah="${n}"]`)
        ?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(raf);
  }, [immersive, isSurahMode]);

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

  // ---- التلاوة داخل القارئ: القارئ يتبع الآية المتلوّة ----
  const track = player.track;
  const playingAyah = track && track.surah === activeSurah.id ? track.ayah : null;
  const playingKey = track ? `${track.surah}:${track.ayah}` : undefined;
  const followRef = useRef({ isSurahMode, page: pageNumber, surah: activeSurah.id });
  followRef.current = { isSurahMode, page: pageNumber, surah: activeSurah.id };
  useEffect(() => {
    if (!track) return;
    const f = followRef.current;
    if (f.isSurahMode) {
      // التلاوة المتصلة انتقلت إلى السورة التالية: ينتقل القارئ معها.
      if (track.surah !== f.surah) update({ surah: track.surah, ayah: track.ayah });
    } else {
      const p = pageOfAyah(track.surah, track.ayah);
      if (p !== f.page) update({ page: p });
    }
  }, [track, update]);

  /** زر «الصوت»: يتلو من الآية الظاهرة، أو يوقف/يستأنف التلاوة الجارية. */
  const onAudio = () => {
    if (track) player.toggle();
    else if (isSurahMode) player.play(activeSurah.id, here?.n ?? 1);
    else {
      const start = pageStart(pageNumber);
      player.play(start.surah, start.ayah);
    }
  };

  return (
    <div
      dir="rtl"
      className={`relative min-h-screen bg-background text-foreground ${paperClass(readingPrefs.paper)}`}
      data-immersive={immersive || undefined}
    >
      {/* Ambient Islamic backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <Arabesque className="absolute -top-24 -right-24 h-[420px] w-[420px] text-primary/10" />
        <Arabesque className="absolute -bottom-24 -left-24 h-[420px] w-[420px] text-gold/15" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
      </div>

      <div
        className={`relative mx-auto max-w-md ${
          track
            ? isSurahMode && !immersive
              ? "pb-44"
              : "pb-28"
            : isSurahMode && !immersive
              ? "pb-28"
              : "pb-10"
        }`}
      >
        {/* ملء الشاشة: زر خروج صغير فقط، والنص وحده */}
        {immersive && (
          <button
            onClick={exitImmersive}
            className={`fixed left-4 z-40 flex h-9 ${track ? "top-4" : "bottom-4"} items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur-xl transition active:scale-95`}
            aria-label="الخروج من ملء الشاشة"
          >
            <Icon d={ICON_EXIT_FULL} size={14} />
            خروج
          </button>
        )}

        {!immersive && (
          <>
            {/* Premium app bar */}
            <header className="sticky top-0 z-30 animate-fade-up" data-reader-header>
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
                  <div className="grid grid-cols-4 gap-2">
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
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setShowMore(false);
                        enterImmersive();
                      }}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/60 p-3 text-[11px] font-medium text-foreground/90 transition active:scale-95"
                    >
                      <Icon d={ICON_FULL} size={15} />
                      ملء الشاشة
                    </button>
                    <button
                      onClick={cyclePaper}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/60 p-3 text-[11px] font-medium text-foreground/90 transition active:scale-95"
                      aria-label={`لون الورق: ${paperLabel}. انقر للتغيير`}
                    >
                      <Icon d={readingPrefs.paper === "night" ? icons.moon : icons.sun} size={15} />
                      الورق: {readingPrefs.paper === "auto" ? "تلقائي" : paperLabel}
                    </button>
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
          </>
        )}

        {isSurahMode && (
          <>
            {!immersive && (
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

                {/* شريط تقدم مختصر بدل البطاقة الكبيرة: النص يبدأ مبكراً */}
                <div className="mt-3 px-5" aria-label="التقدم في السورة">
                  <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
                    <span>
                      الآية {toArabicDigits(hereAyah)} من {toArabicDigits(activeSurah.ayatCount)}
                      {here ? ` · صفحة ${toArabicDigits(here.p)}` : ""}
                    </span>
                    <span>
                      <RelativeTime at={state.updatedAt} /> · {formatPercent(progressPercent)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="gradient-gold h-full transition-all duration-700"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Scrollable reading container — authentic Uthmani text */}
            <MushafReadingArea
              surahId={activeSurah.id}
              surahNameAr={activeSurah.nameAr}
              activeAyah={targetAyah}
              playingAyah={playingAyah}
              onAyahTap={(a) => setSheet({ surah: activeSurah.id, ayah: a })}
              onPosition={onPosition}
              onSettled={onSettled}
              immersive={immersive}
            />
            {!immersive && (
              <details className="group mt-5 px-4" key={`about-${activeSurah.id}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-[13px] font-medium shadow-soft backdrop-blur-xl [&::-webkit-details-marker]:hidden">
                  <span>عن سورة {activeSurah.nameAr}</span>
                  <span className="text-muted-foreground transition group-open:rotate-180">
                    <Icon d={icons.chevron} size={16} />
                  </span>
                </summary>
                <div className="-mx-4">
                  {/* بطاقة السورة: مطوية بعد النص */}
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
                        <MetaStat
                          label="عدد الآيات"
                          value={toArabicDigits(activeSurah.ayatCount)}
                        />
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

                      {maqasid && (
                        <div className="relative mt-4 rounded-2xl border border-border/40 bg-background/50 p-3.5">
                          <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-gold">
                            من مقاصد السورة
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">
                            {maqasid}
                          </p>
                          <a
                            href={MAQASID_SOURCE.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1.5 block text-[10px] text-muted-foreground underline decoration-dotted"
                          >
                            {MAQASID_SOURCE.nameAr} — {MAQASID_SOURCE.authorAr}
                          </a>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </details>
            )}
          </>
        )}

        {!isSurahMode && (
          <MushafPagesMode
            page={pageNumber}
            onChange={(p) => update({ page: clampPage(p) })}
            onAyahTap={(surah, ayah) => setSheet({ surah, ayah })}
            selectedKey={sheet ? `${sheet.surah}:${sheet.ayah.n}` : playingKey}
            immersive={immersive}
            audioState={track ? player.status : "idle"}
            onAudio={onAudio}
          />
        )}
        {isSurahMode && !immersive && (
          <>
            {/* شريط الأدوات ثابت أسفل الشاشة: في المتناول أينما كان القارئ في السورة */}
            <div className="fixed inset-x-0 bottom-3 z-30 mx-auto max-w-md px-4">
              <div className="grid grid-cols-5 gap-1 rounded-full border border-border/60 bg-card/90 p-1.5 shadow-elegant backdrop-blur-2xl">
                <ReaderAction icon={icons.bookmark} label="آخر قراءة" to="/quran/last-read" />
                <ReaderAction icon={icons.info} label="التفسير" to="/quran/tafsir" />
                <ReaderAction
                  icon={player.status === "playing" ? icons.pause : icons.play}
                  label={player.status === "playing" ? "إيقاف" : "تلاوة"}
                  active={Boolean(track)}
                  ariaLabel={
                    player.status === "playing"
                      ? "إيقاف التلاوة مؤقتاً"
                      : track
                        ? "استئناف التلاوة"
                        : `تلاوة من الآية ${toArabicDigits(here?.n ?? 1)}`
                  }
                  onClick={onAudio}
                />
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

      {/* -------- التلاوة داخل القارئ -------- */}
      {track && (
        <div
          className={`fixed inset-x-0 z-30 mx-auto max-w-md px-4 ${
            isSurahMode && !immersive ? "bottom-[4.6rem]" : "bottom-3"
          }`}
        >
          <RecitationBar
            variant="reader"
            onRange={() =>
              player.range
                ? player.clearRange()
                : setRangeFor({ surah: track.surah, from: track.ayah })
            }
          />
        </div>
      )}
      <RangeDialog
        target={rangeFor}
        onClose={() => setRangeFor(null)}
        onStart={(surah, from, to, times) => {
          setRangeFor(null);
          player.playRange(surah, from, to, times);
        }}
      />

      {/* -------- Per-ayah actions -------- */}
      <AyahActionSheet
        surah={sheet?.surah ?? activeSurah.id}
        surahNameAr={SURAH_META[(sheet?.surah ?? activeSurah.id) - 1].nameAr}
        ayah={sheet?.ayah ?? null}
        onClose={() => setSheet(null)}
        onPlay={(surah, ayah) => {
          setSheet(null);
          player.play(surah, ayah);
        }}
        onRepeat={(surah, ayah) => {
          setSheet(null);
          setRangeFor({ surah, from: ayah });
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

/* ---------- تكرار مقطع (للحفظ والمراجعة) ---------- */

const RANGE_TIMES: { value: number; label: string }[] = [
  { value: 1, label: "مرة" },
  { value: 3, label: "٣" },
  { value: 5, label: "٥" },
  { value: 10, label: "١٠" },
  { value: 0, label: "بلا حدّ" },
];

function RangeDialog({
  target,
  onClose,
  onStart,
}: {
  target: { surah: number; from: number } | null;
  onClose: () => void;
  onStart: (surah: number, from: number, to: number, times: number) => void;
}) {
  const max = target ? SURAH_META[target.surah - 1].ayatCount : 1;
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [times, setTimes] = useState(3);
  useEffect(() => {
    if (!target) return;
    setFrom(target.from);
    setTo(Math.min(max, target.from + 4));
  }, [target, max]);
  const clamp = (n: number) => Math.min(max, Math.max(1, Math.trunc(n) || 1));
  const field = (label: string, value: number, set: (n: number) => void) => (
    <label className="grid gap-1 text-[11px] text-muted-foreground">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        onChange={(e) => set(clamp(Number(e.target.value)))}
        className="w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5 text-center text-base text-foreground tabular-nums outline-none focus:border-primary/50"
        dir="ltr"
      />
    </label>
  );
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-sm rounded-3xl border-border/60 bg-card/95 backdrop-blur-2xl sm:rounded-3xl"
        dir="rtl"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="font-display text-xl">تكرار مقطع</DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            {target ? `سورة ${SURAH_META[target.surah - 1].nameAr} · ` : ""}
            {toArabicDigits(max)} آية — للحفظ والمراجعة
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field("من الآية", from, setFrom)}
          {field("إلى الآية", to, setTo)}
        </div>
        <div className="grid gap-1.5">
          <div className="text-[11px] text-muted-foreground">عدد مرات تكرار المقطع</div>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="عدد مرات التكرار">
            {RANGE_TIMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={times === t.value}
                onClick={() => setTimes(t.value)}
                className={`rounded-xl border py-2 text-[12px] font-medium transition active:scale-95 ${
                  times === t.value
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 bg-background/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => target && onStart(target.surah, from, to, times)}
          className="gradient-primary rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow transition active:scale-[0.98]"
        >
          ابدأ التكرار
        </button>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Per-ayah action sheet ---------- */

function AyahActionSheet({
  surah,
  surahNameAr,
  ayah,
  onClose,
  onPlay,
  onRepeat,
  onTafsir,
  onShare,
}: {
  surah: number;
  surahNameAr: string;
  ayah: AyahText | null;
  onClose: () => void;
  onPlay: (surah: number, ayah: number) => void;
  onRepeat: (surah: number, ayah: number) => void;
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

            <div className="grid grid-cols-5 gap-2">
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
              <SheetAction
                icon={icons.repeat}
                label="تكرار"
                onClick={() => onRepeat(surah, ayah.n)}
              />
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
  playingAyah,
  onAyahTap,
  onPosition,
  onSettled,
  immersive = false,
}: {
  surahId: number;
  surahNameAr: string;
  activeAyah?: number | null;
  playingAyah?: number | null;
  immersive?: boolean;
  onAyahTap?: (ayah: AyahText) => void;
  /** الآية الظاهرة أعلى منطقة القراءة، مع كل تمرير. */
  onPosition?: (ayah: AyahText) => void;
  /** الموضع بعد استقرار التمرير (يُحفظ). */
  onSettled?: (ayah: AyahText) => void;
}) {
  const state = useSurahText(surahId);
  const scrollRef = useRef<HTMLElement>(null);
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

    // النص يتدفق في الصفحة نفسها (لا صندوق تمرير داخلي): الحد الأعلى أسفل الترويسة الثابتة.
    const topAyah = (): AyahText | null => {
      const header = document.querySelector("[data-reader-header]");
      const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + 24;
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
      const atEnd = el.getBoundingClientRect().bottom <= window.innerHeight + 8;
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [ayahs, surahId, onPosition, save]);
  return (
    <section
      className={immersive ? "px-1 pt-3 pb-16" : "mt-4 px-3 animate-fade-up"}
      aria-label="منطقة قراءة الآيات"
      ref={scrollRef}
    >
      <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/60 shadow-elegant backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-3 rounded-[26px] border border-gold/25" />
        <div className="pointer-events-none absolute inset-5 rounded-[22px] border border-gold/10" />
        {["top-4 right-4", "top-4 left-4", "bottom-4 right-4", "bottom-4 left-4"].map((pos) => (
          <span
            key={pos}
            className={`pointer-events-none absolute ${pos} h-4 w-4 rotate-45 border border-gold/40`}
          />
        ))}

        <div className="relative min-h-[380px] px-6 py-8" dir="rtl">
          <SurahRenderer
            surahId={surahId}
            surahNameAr={surahNameAr}
            state={state}
            onRetry={state.retry}
            activeAyah={activeAyah}
            playingAyah={playingAyah}
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
  selectedKey,
  immersive = false,
  audioState = "idle",
  onAudio,
}: {
  page: number;
  onChange: (page: number) => void;
  onAyahTap: (surah: number, ayah: AyahText) => void;
  selectedKey?: string;
  immersive?: boolean;
  /** حالة التلاوة لزر التشغيل في شريط التنقل. */
  audioState?: string;
  onAudio?: () => void;
}) {
  const state = useMushafPage(page);
  const { items: bookmarks } = useBookmarks();
  const markedKeys = useMemo(
    () => new Set(bookmarks.map((b) => `${b.surah}:${b.ayah}`)),
    [bookmarks],
  );
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
    <section className={immersive ? "px-1 pt-3 pb-16" : "mt-3 px-2"} aria-label="وضع المصحف">
      {/* سطح الصفحة المطبوعة: ١٥ سطراً بعرض الشاشة */}
      <div
        className="relative select-none overflow-hidden rounded-[26px] border border-border/60 bg-card/85 shadow-elegant backdrop-blur-2xl"
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
          className="relative px-4 pt-4 pb-3"
          dir="rtl"
          style={{
            transform: `translateX(${drag}px)`,
            transition: drag === 0 ? "transform 200ms ease-out" : "none",
          }}
        >
          <MushafPageRenderer
            page={page}
            state={state}
            onRetry={state.retry}
            onAyahTap={onAyahTap}
            selectedKey={selectedKey}
            markedKeys={markedKeys}
          />
        </div>
      </div>

      {/* Page navigation — previous is on the right, next on the left */}
      <div
        className={`mt-3 ${immersive ? "hidden" : "grid"} grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2`}
      >
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
          onClick={onAudio}
          className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-soft transition active:scale-95 ${
            audioState === "idle"
              ? "border-border bg-card/70 text-foreground"
              : "border-primary/40 bg-primary/15 text-primary"
          }`}
          aria-label={
            audioState === "playing"
              ? "إيقاف التلاوة مؤقتاً"
              : audioState === "idle"
                ? "تلاوة الصفحة"
                : "استئناف التلاوة"
          }
        >
          <Icon d={audioState === "playing" ? icons.pause : icons.play} size={17} />
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
  { label: "المصادر", icon: icons.info, to: "/sources" },
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
