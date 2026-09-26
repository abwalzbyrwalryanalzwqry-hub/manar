import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAnnouncer } from "@/components/manar/live-announcer";
import { counterAnnouncement } from "@/lib/azkar/a11y";
import { DataError } from "@/components/manar/data-error";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Arabesque,
  EmptyState,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  Skeleton,
} from "@/components/manar/shell";
import { useAzkarBook } from "@/hooks/use-azkar";
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from "@/hooks/use-keep-awake";
import { useDayKey } from "@/hooks/use-day-key";
import { onResume } from "@/lib/native-shell";
import { nextIndexAfter } from "@/lib/azkar/hub";
import { AzkarDisplayPanel, DisplayToggleButton } from "@/components/manar/azkar-display-controls";
import { haptic, hapticFor, isCountableTap, textSizePx, useAzkarPrefs } from "@/lib/azkar/prefs";
import { useAzkarProgress } from "@/lib/azkar/progress";
import { azkarTimeNow } from "@/lib/azkar/time";
import type { Zikr, ZikrTime } from "@/lib/azkar/types";
import {
  azkarForTime,
  hasTimeVariants,
  isDailyOnce,
  progressKey,
  segmentState,
  zikrText,
} from "@/lib/azkar/variant";
import { formatArTime, toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/azkar/$chapter")({
  validateSearch: (search: Record<string, unknown>): { zikr?: number; time?: ZikrTime } => ({
    zikr:
      search.zikr != null && !Number.isNaN(Number(search.zikr)) ? Number(search.zikr) : undefined,
    /* تذكيرا الصباح والمساء يفتحان الباب على وقتهما مباشرة. */
    time: search.time === "morning" || search.time === "evening" ? search.time : undefined,
  }),
  head: () => ({
    meta: [
      { title: "جلسة الأذكار — منار" },
      {
        name: "description",
        content:
          "جلسة أذكار متسلسلة من حصن المسلم: ذكر واحد في كل شاشة مع عدّاد تكرار وانتقال تلقائي.",
      },
      { property: "og:title", content: "جلسة الأذكار — منار" },
      {
        property: "og:description",
        content: "اقرأ أذكار الباب ذكرًا بعد ذكر مع عدّاد تكرار وحفظ تلقائي للتقدّم.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AzkarSessionRoute,
});

/**
 * يعيد تركيب الجلسة عند تغيّر الباب أو الذكر أو الوقت في الرابط — مثل فتح
 * إشعار «أذكار المساء» والجلسة مفتوحة على الصباح — فتُطبَّق المعاملات الجديدة.
 */
function AzkarSessionRoute() {
  const { chapter } = Route.useParams();
  const { zikr, time } = Route.useSearch();
  return <AzkarSession key={`${chapter}|${zikr ?? ""}|${time ?? ""}`} />;
}

/** مهلة قصيرة بعد إتمام الذكر ليُرى الإتمام قبل الانتقال (الضغطات أثناءها تُهمل). */
const ADVANCE_DELAY_MS = 450;

function AzkarSession() {
  const { chapter: chapterParam } = Route.useParams();
  const { zikr: zikrParam, time: timeParam } = Route.useSearch();
  const id = Number(chapterParam);
  const navigate = useNavigate();
  const { book, loading, error, retry } = useAzkarBook();
  const { progress, tap, undo, resetMany, toggleBookmark, setLast } = useAzkarProgress();

  const chapter = useMemo(() => book?.chapters.find((c) => c.id === id), [book, id]);
  /** صباح/مساء — فقط للأبواب التي تختلف أذكارها بالوقت (باب ٢٧). */
  const timed = chapter ? hasTimeVariants(chapter) : false;
  /* بلا وقت في الرابط: الصباح من الفجر إلى العصر، والمساء بعده (بمواقيت الموقع). */
  const [time, setTime] = useState<ZikrTime>(() => timeParam ?? azkarTimeNow());
  const activeTime: ZikrTime | null = timed ? time : null;
  const azkar = useMemo(
    () => (chapter ? azkarForTime(chapter, activeTime) : []),
    [chapter, activeTime],
  );
  /** عدّاد الذكر في الوقت المعروض — للمساء عدّاد مستقل عن الصباح. */
  const countOf = useCallback(
    (z: Zikr) => progress.counters[progressKey(z.id, activeTime)] ?? 0,
    [progress.counters, activeTime],
  );

  const [index, setIndex] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { prefs, update: updatePrefs } = useAzkarPrefs();
  const [showDisplay, setShowDisplay] = useState(false);
  const fontPx = textSizePx(prefs);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const advancing = useRef(false);
  const savedTimer = useRef<number | null>(null);
  const advanceTimer = useRef<number | null>(null);
  /** الذكر المعروض الآن — يقرؤه مؤقت الانتقال التلقائي بدل فهرس قديم. */
  const shownId = useRef<number | null>(null);
  /** أحدث دالة انتقال — المؤقت يقرؤها فيرى العدّادات بعد الضغطة لا قبلها. */
  const advanceRef = useRef<(from: number) => void>(() => {});

  const backTo = chapter ? `/azkar/group/${chapter.group}` : "/azkar";

  /** Resume logic — runs once when the chapter is available. */
  useEffect(() => {
    if (initialized || !chapter || !azkar.length) return;
    if (zikrParam != null) {
      const i = azkar.findIndex((z) => z.id === zikrParam);
      if (i >= 0) {
        setIndex(i);
        setInitialized(true);
        return;
      }
    }
    const partial = azkar.findIndex((z) => {
      const c = countOf(z);
      return c > 0 && c < z.repeat;
    });
    if (partial >= 0) {
      setIndex(partial);
    } else {
      const firstIncomplete = azkar.findIndex((z) => countOf(z) < z.repeat);
      if (firstIncomplete < 0) setFinished(true);
      setIndex(Math.max(0, firstIncomplete));
    }
    setInitialized(true);
  }, [initialized, chapter, azkar, countOf, zikrParam]);

  const current: Zikr | undefined = azkar[index];
  const count = current ? Math.min(countOf(current), current.repeat) : 0;
  shownId.current = current?.id ?? null;
  const currentText = current ? zikrText(current, activeTime) : "";
  const seg = current ? segmentState(current, count) : null;
  const doneCount = azkar.filter((z) => countOf(z) >= z.repeat).length;
  const started = azkar.some((z) => countOf(z) > 0);

  /* الشاشة تبقى مضاءة ما دامت الجلسة جارية. */
  useKeepAwake(Boolean(chapter && current && !finished), { idleMs: KEEP_AWAKE_IDLE_MS });

  useEffect(() => {
    if (chapter && current) setLast(chapter.id, current.id, activeTime);
  }, [chapter, current, activeTime, setLast]);

  /** Reset vertical scroll when the active zikr changes. */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  /** يلغي انتقالًا تلقائيًا معلّقًا (عند التنقل اليدوي أو تبديل الوقت أو المغادرة). */
  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    advancing.current = false;
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= azkar.length) return;
      cancelAdvance();
      setIndex(next);
    },
    [azkar.length, cancelAdvance],
  );

  /** Finish the chapter: show the completion state (progress stays saved). */
  const finish = useCallback(() => {
    setFinished(true);
  }, []);

  /**
   * الانتقال بعد الذكر `from`: التالي، أو في آخر الباب أول ذكر ناقص. شاشة
   * الإتمام لا تظهر إلا إن اكتمل الباب فعلًا.
   */
  const advanceFrom = useCallback(
    (from: number) => {
      const next = nextIndexAfter(azkar, (z) => countOf(z as Zikr), from);
      /* لا ذكر آخر ناقص (أو الناقص هو المعروض نفسه): شاشة النهاية بالعدد الفعلي. */
      if (next < 0 || next === from) finish();
      else setIndex(next);
    },
    [azkar, countOf, finish],
  );
  advanceRef.current = advanceFrom;

  /** Leaves the session immediately, keeping every counter untouched. */
  const exitSession = useCallback(() => {
    navigate({ to: "/azkar/group/$group", params: { group: chapter?.group ?? "" } });
  }, [navigate, chapter]);

  /** Flash the auto-save confirmation. */
  const flashSaved = useCallback(() => {
    setSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1400);
  }, []);

  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  const { announce, node: liveRegion } = useAnnouncer();
  const onTap = useCallback(() => {
    if (!current) return;
    /* نقرة أثناء مهلة الانتقال: انتقل الآن بدل الانتظار (ولا تُعدّ على المكتمل). */
    if (advancing.current) {
      cancelAdvance();
      advanceFrom(index);
      return;
    }
    /* ذكر مكتمل: الضغط ينقل إلى ما بعده دون إعادة إعلان الإتمام أو الحفظ. */
    if (count >= current.repeat) {
      cancelAdvance();
      advanceFrom(index);
      return;
    }
    const next = Math.min(current.repeat, count + 1);
    haptic(prefs, hapticFor(count, current.repeat, current.segments));
    announce(counterAnnouncement(count, current.repeat, current.segments));
    tap(progressKey(current.id, activeTime), current.repeat);
    flashSaved();
    if (next >= current.repeat) {
      advancing.current = true;
      const doneId = current.id;
      // hold briefly so the user sees the saved confirmation before moving on
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null;
        advancing.current = false;
        /* إن غادر المستخدم هذا الذكر خلال المهلة فلا ننقله من موضعه الجديد. */
        if (shownId.current !== doneId) return;
        const at = azkar.findIndex((z) => z.id === doneId);
        if (at >= 0) advanceRef.current(at);
      }, ADVANCE_DELAY_MS);
    }
  }, [
    current,
    count,
    index,
    prefs,
    announce,
    tap,
    activeTime,
    flashSaved,
    azkar,
    advanceFrom,
    cancelAdvance,
  ]);

  /** تراجع عن آخر عدّة في الذكر المعروض (ويلغي انتقالًا تلقائيًا معلّقًا). */
  const onUndo = useCallback(() => {
    if (!current || count <= 0) return;
    cancelAdvance();
    undo(progressKey(current.id, activeTime));
    announce(`تراجع، ${toArabicDigits(count - 1)} من ${toArabicDigits(current.repeat)}`);
    flashSaved();
  }, [current, count, cancelAdvance, undo, activeTime, announce, flashSaved]);

  /** الضغط على نص الذكر يعدّ (إن فُعّل)، إلا على الأزرار والحواشي أو أثناء تحديد نص. */
  const onTextTap = (e: React.MouseEvent) => {
    if (!prefs.tapAnywhere || !isCountableTap(e.target)) return;
    onTap();
  };

  // ---- intentional horizontal swipe with direction locking ----
  const touch = useRef<{ x: number; y: number; lock: "none" | "x" | "y" } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, lock: "none" };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.lock === "none" && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      s.lock = Math.abs(dx) > Math.abs(dy) * 1.5 ? "x" : "y";
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || s.lock !== "x") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) < 70) return; // accidental swipe — ignore
    // RTL: swipe left → next, swipe right → previous
    if (dx < 0) goTo(index + 1);
    else goTo(index - 1);
  };

  const restart = () => {
    cancelAdvance();
    resetMany(azkar.map((z) => progressKey(z.id, activeTime)));
    flashSaved();
    setConfirmReset(false);
    setFinished(false);
    setIndex(0);
  };

  /* تجدّد الجلسة: بقيت الشاشة مفتوحة حتى يومٍ جديد (العدّادات صُفّرت في
   * وحدة التقدّم)، أو عاد المستخدم بعد أن انتقل الوقت من الصباح إلى المساء —
   * فتُعاد الجلسة من أولها بدل أن تبقى ثابتة على شاشة الإتمام أو وقتٍ مضى. */
  const day = useDayKey();
  const lastDay = useRef(day);
  const manualTime = useRef(Boolean(timeParam));
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    if (lastDay.current === day) return;
    lastDay.current = day;
    cancelAdvance();
    if (!timeParam) {
      manualTime.current = false;
      setTime(azkarTimeNow());
    }
    setFinished(false);
    setIndex(0);
    setInitialized(false);
  }, [day, timeParam, cancelAdvance]);

  useEffect(() => {
    if (!timed) return;
    const check = () => {
      if (document.visibilityState !== "visible" || manualTime.current) return;
      const now = azkarTimeNow();
      if (timeRef.current === now) return;
      cancelAdvance();
      setTime(now);
      setFinished(false);
      setIndex(0);
      setInitialized(false);
    };
    document.addEventListener("visibilitychange", check);
    const off = onResume(check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      off();
    };
  }, [timed, cancelAdvance]);

  const switchTime = (next: ZikrTime) => {
    if (next === time) return;
    manualTime.current = true;
    cancelAdvance();
    setTime(next);
    setFinished(false);
    setIndex(0);
    setInitialized(false);
  };

  const share = async () => {
    if (!current || !chapter) return;
    /* نص الذكر وإرشاده ومصدره فقط — بلا إحصائيات تقدّم لا تعني من يستلمه. */
    const text =
      `${current.lead ? `${current.lead}\n` : ""}${currentText}` +
      `${current.note ? `\n${current.note}` : current.repeat > 1 ? `\n(${toArabicDigits(current.repeat)} مرات)` : ""}` +
      `\n\n— ${chapter.title} · حصن المسلم · تطبيق منار`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* ignore cancel */
    }
  };

  const remainingCount = azkar.length - doneCount;
  const updatedLabel = progress.updatedAt ? formatArTime(new Date(progress.updatedAt)) : null;

  return (
    <Screen>
      <ScreenHeader
        title={chapter?.title ?? "جلسة الأذكار"}
        subtitle={
          chapter
            ? `الباب ${toArabicDigits(chapter.id)} · أتممت ${toArabicDigits(doneCount)} من ${toArabicDigits(azkar.length)}`
            : "من أذكار الكتاب والسنة"
        }
        backTo={backTo}
      />

      {loading && (
        <div className="px-4">
          <Skeleton className="h-[26rem] rounded-[32px]" />
        </div>
      )}
      {error && <DataError message={error} onRetry={retry} title="تعذّر تحميل الأذكار" />}
      {book && !chapter && (
        <div className="px-5">
          <EmptyState
            icon={icons.azkar}
            title="الباب غير موجود"
            hint="ربما تغيّر الرابط. ارجع إلى الأذكار واختر الباب من القائمة."
          />
          <Link
            to="/azkar"
            className="gradient-primary block rounded-2xl py-3 text-center text-sm text-primary-foreground"
          >
            الرجوع إلى الأذكار
          </Link>
        </div>
      )}

      {chapter && timed && (
        <div className="mb-3 px-4">
          <div
            role="tablist"
            aria-label="وقت الأذكار"
            className="flex rounded-full border border-border/60 bg-card/70 p-1 text-xs"
          >
            {(
              [
                ["morning", "أذكار الصباح"],
                ["evening", "أذكار المساء"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={time === value}
                onClick={() => switchTime(value)}
                className={`flex-1 rounded-full py-2 transition ${
                  time === value
                    ? "gradient-primary font-medium text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* session status bar: last started zikr + last save time */}
      {chapter && (
        <div className="mb-3 px-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon d={icons.bookmark} size={13} />
              {!started ? (
                <span>لم تبدأ هذا الباب بعد</span>
              ) : remainingCount > 0 ? (
                <span>
                  بقي {toArabicDigits(remainingCount)} من {toArabicDigits(azkar.length)}
                </span>
              ) : (
                <span>اكتمل الباب اليوم</span>
              )}
            </span>
            <span
              className={`flex items-center gap-1.5 tabular-nums transition-colors ${
                saved ? "text-primary" : ""
              }`}
            >
              <Icon d={icons.check} size={13} />
              {saved
                ? "تم حفظ التقدّم"
                : updatedLabel
                  ? `آخر تحديث ${updatedLabel}`
                  : "الحفظ تلقائي"}
            </span>
          </div>
        </div>
      )}

      {chapter && finished && (
        <div className="px-4 animate-fade-up">
          <div className="glass relative overflow-hidden rounded-[32px] p-8 text-center">
            <Arabesque className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 text-gold/20" />
            <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon d={icons.check} size={26} />
            </span>
            <div className="relative mt-4 font-display text-xl">
              {remainingCount > 0 ? "وصلت إلى آخر الباب" : "تمّت أذكار هذا الباب"}
            </div>
            <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground">
              {remainingCount > 0
                ? `أتممت ${toArabicDigits(doneCount)} من ${toArabicDigits(azkar.length)} ذكرًا، وبقي ${toArabicDigits(remainingCount)}. تقدّمك محفوظ.`
                : `أتممت ${toArabicDigits(azkar.length)} ذكرًا · تقبّل الله منك. تم حفظ تقدّمك تلقائيًا.`}
            </p>
            <div className="relative mt-6 flex flex-col gap-2">
              {remainingCount > 0 && (
                <button
                  onClick={() => {
                    const i = azkar.findIndex((z) => countOf(z) < z.repeat);
                    setFinished(false);
                    setIndex(Math.max(0, i));
                  }}
                  className="rounded-full gradient-primary py-2.5 text-xs font-medium text-primary-foreground"
                >
                  أكمل الأذكار الناقصة
                </button>
              )}
              <button
                onClick={exitSession}
                className={`rounded-full py-2.5 text-xs font-medium ${
                  remainingCount > 0
                    ? "border border-border bg-card"
                    : "gradient-primary text-primary-foreground"
                }`}
              >
                العودة إلى قائمة الباب
              </button>
              <button
                onClick={() => setConfirmReset(true)}
                className="rounded-full border border-border bg-card py-2.5 text-xs font-medium"
              >
                إعادة الأذكار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* elegant reset confirmation */}
      {confirmReset && chapter && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 px-4 pb-6 backdrop-blur-sm animate-fade-up">
          <div className="glass relative w-full max-w-sm overflow-hidden rounded-[28px] p-6 text-center">
            <Arabesque className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 text-gold/20" />
            <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-gold">
              <Icon d={icons.check} size={22} />
            </span>
            <div className="relative mt-4 font-display text-lg">إعادة أذكار هذا الباب؟</div>
            <p className="relative mt-2 text-[12px] leading-relaxed text-muted-foreground">
              سيتم تصفير عدّادات {toArabicDigits(azkar.length)} ذكرًا في «{chapter.title}» فقط،
              والبدء من الذكر الأول.
              <br />
              لن يتأثّر تقدّمك في أي باب آخر، ولا الأذكار المحفوظة.
            </p>
            <div className="relative mt-5 flex gap-2">
              <button
                onClick={restart}
                className="flex-1 rounded-full gradient-primary py-2.5 text-xs font-medium text-primary-foreground"
              >
                نعم، أعِد هذا الباب
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-full border border-border bg-card py-2.5 text-xs text-muted-foreground"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {chapter && current && !finished && (
        <div
          className="px-4"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            key={current.id}
            className="glass-flat relative overflow-hidden rounded-[32px] p-5 animate-fade-up"
          >
            <Arabesque className="pointer-events-none absolute -bottom-14 -left-14 h-40 w-40 text-primary/10" />

            <div className="relative flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                الذكر {toArabicDigits(index + 1)} من {toArabicDigits(azkar.length)}
              </span>
              <span className="flex items-center gap-2">
                <DisplayToggleButton open={showDisplay} onClick={() => setShowDisplay((v) => !v)} />
                <button
                  onClick={() => toggleBookmark(current.id)}
                  aria-label="حفظ الذكر"
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card ${
                    progress.bookmarks.includes(current.id) ? "text-gold" : "text-muted-foreground"
                  }`}
                >
                  <Icon d={icons.bookmark} size={15} />
                </button>
              </span>
            </div>

            {showDisplay && <AzkarDisplayPanel prefs={prefs} update={updatePrefs} />}

            {/* chapter progress */}
            <div className="relative mt-3 flex gap-1">
              {azkar.map((z, i) => (
                <span
                  key={z.id}
                  className={`h-1 flex-1 rounded-full ${
                    countOf(z) >= z.repeat ? "bg-gold" : i === index ? "bg-primary" : "bg-border/70"
                  }`}
                />
              ))}
            </div>

            {/* current zikr — the only scrollable area */}
            <div
              ref={scrollRef}
              onClick={onTextTap}
              className={`tap-text relative mt-4 max-h-[46vh] overflow-y-auto pl-1 overscroll-contain ${
                prefs.tapAnywhere ? "cursor-pointer select-none" : ""
              }`}
            >
              {current.lead && (
                <p className="mb-2 text-right text-[13px] leading-relaxed text-muted-foreground">
                  {current.lead}
                </p>
              )}

              {current.segments && seg ? (
                <ol className="space-y-2">
                  {current.segments.map((s, i) => (
                    <li
                      key={i}
                      className={`flex items-baseline justify-between gap-3 rounded-2xl px-3 py-1.5 transition ${
                        i === seg.index
                          ? "bg-secondary/70 text-foreground"
                          : i < seg.index
                            ? "text-muted-foreground line-through decoration-gold/50"
                            : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className="text-right font-display leading-[2]"
                        style={{ fontSize: fontPx - 1 }}
                      >
                        {s.text}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums">
                        ×{toArabicDigits(s.repeat)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p
                  className={
                    current.quran
                      ? "text-right font-quran leading-[2.4]"
                      : "text-right font-display leading-[2.15]"
                  }
                  style={{ fontSize: current.quran ? fontPx - 0.4 : fontPx }}
                >
                  {currentText}
                </p>
              )}

              {current.note && (
                <p className="mt-2 text-right text-[13px] leading-relaxed text-muted-foreground">
                  {current.note}
                </p>
              )}
              {timed && isDailyOnce(current.id) && (
                <p className="mt-1 text-right text-[11px] leading-relaxed text-muted-foreground">
                  عدّاد يومي واحد: ما تقوله صباحًا يُحتسب مساءً.
                </p>
              )}

              {chapter.references.length > 0 && (
                <div
                  data-no-tap
                  className="mt-5 cursor-auto select-text rounded-2xl border border-border/60 bg-background/50 p-3"
                >
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    حواشي الكتاب القريبة من هذا الباب
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                    {chapter.references.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* counter */}
            <div className="relative mt-5 flex flex-col items-center">
              {liveRegion}
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                التكرار
              </span>
              <button
                onClick={onTap}
                aria-label={`زيادة العدّاد، ${toArabicDigits(count)} من ${toArabicDigits(current.repeat)}`}
                className="counter-tap mt-2 flex h-24 w-24 flex-col items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow transition-transform duration-100 active:scale-95"
              >
                <span key={count} className="animate-count-pop font-display text-2xl tabular-nums">
                  {toArabicDigits(seg ? seg.count : count)}
                </span>
                <span className="text-[11px] tabular-nums opacity-80">
                  من {toArabicDigits(seg ? seg.segment.repeat : current.repeat)}
                </span>
              </button>
              {seg && current.segments && (
                <span className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
                  المقطع {toArabicDigits(seg.index + 1)} من{" "}
                  {toArabicDigits(current.segments.length)}
                  {" · "}الإجمالي {toArabicDigits(count)} من {toArabicDigits(current.repeat)}
                </span>
              )}
              <span className="mt-2 text-[10px] text-muted-foreground">
                {prefs.tapAnywhere ? "اضغط على النص أو الزر للعدّ" : "اضغط للعدّ"} · ينتقل تلقائيًا
                عند الإتمام
              </span>
              <button
                onClick={onUndo}
                disabled={count <= 0}
                aria-label="تراجع عن آخر عدّة"
                className="mt-2 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground disabled:opacity-40"
              >
                <Icon d={icons.minus} size={12} />
                تراجع
              </button>
            </div>

            {/* manual navigation */}
            <div className="relative mt-5 flex items-center justify-between">
              <button
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground disabled:opacity-40"
              >
                <span className="rotate-180">
                  <Icon d={icons.back} size={14} />
                </span>
                السابق
              </button>
              <button
                onClick={share}
                aria-label="مشاركة الذكر"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
              >
                <Icon d={icons.share} size={15} />
              </button>
              <button
                onClick={() => (index + 1 < azkar.length ? goTo(index + 1) : advanceFrom(index))}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground"
              >
                التالي
                <Icon d={icons.back} size={14} />
              </button>
            </div>

            {/* stop session — keeps every counter as-is */}
            <button
              onClick={exitSession}
              className="relative mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-border/70 bg-background/50 py-2.5 text-[11px] text-muted-foreground transition active:scale-[0.98]"
            >
              <Icon d={icons.back} size={13} />
              إيقاف الجلسة والعودة إلى قائمة الباب (يُحفظ التقدّم)
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}
