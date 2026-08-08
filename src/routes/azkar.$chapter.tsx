import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arabesque, Icon, icons, Screen, ScreenHeader, Skeleton } from "@/components/manar/shell";
import { useAzkarBook } from "@/hooks/use-azkar";
import { useAzkarProgress } from "@/lib/azkar/progress";
import type { AzkarChapter, Zikr } from "@/lib/azkar/types";
import { formatArTime, toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/azkar/$chapter")({
  validateSearch: (search: Record<string, unknown>) => ({
    zikr: search.zikr != null && !Number.isNaN(Number(search.zikr)) ? Number(search.zikr) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "جلسة الأذكار — منار" },
      { name: "description", content: "جلسة أذكار متسلسلة من حصن المسلم: ذكر واحد في كل شاشة مع عدّاد تكرار وانتقال تلقائي." },
      { property: "og:title", content: "جلسة الأذكار — منار" },
      { property: "og:description", content: "اقرأ أذكار الباب ذكرًا بعد ذكر مع عدّاد تكرار وحفظ تلقائي للتقدّم." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AzkarSession,
});

function AzkarSession() {
  const { chapter: chapterParam } = Route.useParams();
  const { zikr: zikrParam } = Route.useSearch();
  const id = Number(chapterParam);
  const navigate = useNavigate();
  const { book, loading, error } = useAzkarBook();
  const { progress, tap, resetMany, toggleBookmark, setLast } = useAzkarProgress();

  const chapter = useMemo(() => book?.chapters.find((c) => c.id === id), [book, id]);
  const azkar = chapter?.azkar ?? [];

  const [index, setIndex] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const advancing = useRef(false);
  const savedTimer = useRef<number | null>(null);


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
      const c = progress.counters[z.id] ?? 0;
      return c > 0 && c < z.repeat;
    });
    if (partial >= 0) {
      setIndex(partial);
    } else {
      const firstIncomplete = azkar.findIndex((z) => (progress.counters[z.id] ?? 0) < z.repeat);
      if (firstIncomplete < 0) setFinished(true);
      setIndex(Math.max(0, firstIncomplete));
    }
    setInitialized(true);
  }, [initialized, chapter, azkar, progress.counters, zikrParam]);

  const current: Zikr | undefined = azkar[index];
  const count = current ? Math.min(progress.counters[current.id] ?? 0, current.repeat) : 0;
  const doneCount = azkar.filter((z) => (progress.counters[z.id] ?? 0) >= z.repeat).length;

  useEffect(() => {
    if (chapter && current) setLast(chapter.id, current.id);
  }, [chapter, current, setLast]);

  /** Reset vertical scroll when the active zikr changes. */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const goTo = useCallback(
    (next: number, direction: 1 | -1) => {
      if (next < 0 || next >= azkar.length) return;
      setDir(direction);
      setIndex(next);
    },
    [azkar.length],
  );

  /** Finish the chapter: show the completion state (progress stays saved). */
  const finish = useCallback(() => {
    setFinished(true);
  }, []);

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
    },
    [],
  );

  const onTap = useCallback(() => {
    if (!current || advancing.current) return;
    const next = Math.min(current.repeat, count + 1);
    tap(current.id, current.repeat);
    flashSaved();
    setPulse(true);
    window.setTimeout(() => setPulse(false), 260);
    if (next >= current.repeat) {
      advancing.current = true;
      // hold briefly so the user sees the saved confirmation before moving on
      window.setTimeout(() => {
        advancing.current = false;
        if (index + 1 < azkar.length) goTo(index + 1, 1);
        else finish();
      }, 900);
    }
  }, [current, count, tap, flashSaved, index, azkar.length, goTo, finish]);


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
    if (dx < 0) goTo(index + 1, 1);
    else goTo(index - 1, -1);
  };

  const restart = () => {
    resetMany(azkar.map((z) => z.id));
    flashSaved();
    setConfirmReset(false);
    setFinished(false);
    setIndex(0);
  };

  const share = async () => {
    if (!current || !chapter) return;
    const text =
      `${chapter.title} — الباب ${toArabicDigits(chapter.id)}\n` +
      `الذكر ${toArabicDigits(index + 1)} من ${toArabicDigits(azkar.length)} · التكرار المطلوب: ${toArabicDigits(current.repeat)}\n` +
      `المُنجَز: ${toArabicDigits(count)} من ${toArabicDigits(current.repeat)}` +
      `${count >= current.repeat ? " ✓ مكتمل" : ""}\n` +
      `تقدّم الباب: ${toArabicDigits(doneCount)} من ${toArabicDigits(azkar.length)}\n\n` +
      `${current.text}\n\n— حصن المسلم · تطبيق منار`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* ignore cancel */
    }
  };

  /** Last started zikr inside this chapter + last save time. */
  const lastHere = progress.last?.chapter === chapter?.id ? progress.last : null;
  const lastStartedNo = lastHere ? azkar.findIndex((z) => z.id === lastHere.zikr) + 1 : 0;
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
      {error && <p className="px-5 text-sm text-muted-foreground">{error}</p>}

      {/* session status bar: last started zikr + last save time */}
      {chapter && (
        <div className="mb-3 px-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon d={icons.bookmark} size={13} />
              {lastStartedNo > 0 ? (
                <span>
                  بدأت بالذكر {toArabicDigits(lastStartedNo)} من {toArabicDigits(azkar.length)}
                </span>
              ) : (
                <span>لم تبدأ هذا الباب بعد</span>
              )}
            </span>
            <span
              className={`flex items-center gap-1.5 tabular-nums transition-colors ${
                saved ? "text-primary" : ""
              }`}
            >
              <Icon d={icons.check} size={13} />
              {saved ? "تم حفظ التقدّم" : updatedLabel ? `آخر تحديث ${updatedLabel}` : "الحفظ تلقائي"}
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
            <div className="relative mt-4 font-display text-xl">تمّت أذكار هذا الباب</div>
            <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground">
              أتممت {toArabicDigits(azkar.length)} ذكرًا · تقبّل الله منك. تم حفظ تقدّمك تلقائيًا.
            </p>
            <div className="relative mt-6 flex flex-col gap-2">
              <button
                onClick={exitSession}
                className="rounded-full gradient-primary py-2.5 text-xs font-medium text-primary-foreground"
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
              سيتم تصفير عدّادات {toArabicDigits(azkar.length)} ذكرًا في «{chapter.title}» فقط، والبدء من الذكر الأول.
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
        <div className="px-4" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div
            key={current.id}
            className={`glass relative overflow-hidden rounded-[32px] p-5 ${dir === 1 ? "animate-fade-up" : "animate-fade-up"}`}
          >
            <Arabesque className="pointer-events-none absolute -bottom-14 -left-14 h-40 w-40 text-primary/10" />

            <div className="relative flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                الذكر {toArabicDigits(index + 1)} من {toArabicDigits(azkar.length)}
              </span>
              <button
                onClick={() => toggleBookmark(current.id)}
                aria-label="حفظ الذكر"
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card ${
                  progress.bookmarks.includes(current.id) ? "text-gold" : "text-muted-foreground"
                }`}
              >
                <Icon d={icons.bookmark} size={15} />
              </button>
            </div>

            {/* chapter progress */}
            <div className="relative mt-3 flex gap-1">
              {azkar.map((z, i) => (
                <span
                  key={z.id}
                  className={`h-1 flex-1 rounded-full ${
                    (progress.counters[z.id] ?? 0) >= z.repeat
                      ? "bg-gold"
                      : i === index
                        ? "bg-primary"
                        : "bg-border/70"
                  }`}
                />
              ))}
            </div>

            {/* current zikr — the only scrollable area */}
            <div ref={scrollRef} className="relative mt-4 max-h-[46vh] overflow-y-auto pl-1 overscroll-contain">
              <p className="text-right font-display text-[22px] leading-[2.15]">{current.text}</p>

              {chapter.references.length > 0 && (
                <div className="mt-5 rounded-2xl border border-border/60 bg-background/50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">التخريج</div>
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
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">التكرار</span>
              <button
                onClick={onTap}
                className={`mt-2 flex h-24 w-24 flex-col items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-glow transition active:scale-95 ${
                  pulse ? "scale-105" : ""
                }`}
              >
                <span className="font-display text-2xl tabular-nums">{toArabicDigits(count)}</span>
                <span className="text-[11px] tabular-nums opacity-80">من {toArabicDigits(current.repeat)}</span>
              </button>
              <span className="mt-2 text-[10px] text-muted-foreground">اضغط للعدّ · ينتقل تلقائيًا عند الإتمام</span>
            </div>

            {/* manual navigation */}
            <div className="relative mt-5 flex items-center justify-between">
              <button
                onClick={() => goTo(index - 1, -1)}
                disabled={index === 0}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs text-foreground disabled:opacity-40"
              >
                <span className="rotate-180"><Icon d={icons.back} size={14} /></span>
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
                onClick={() => (index + 1 < azkar.length ? goTo(index + 1, 1) : finish())}
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
