import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnouncer } from "@/components/manar/live-announcer";
import { counterAnnouncement } from "@/lib/azkar/a11y";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Arabesque, Icon, icons, Screen, Skeleton } from "@/components/manar/shell";
import { WirdProgressBar } from "@/components/manar/wird-progress";
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from "@/hooks/use-keep-awake";

import { toArabicDigits } from "@/lib/format";
import { getWirdSession } from "@/lib/wird/data";
import { AzkarDisplayPanel, DisplayToggleButton } from "@/components/manar/azkar-display-controls";
import { isDailyOnce } from "@/lib/azkar/variant";
import { haptic, hapticFor, isCountableTap, textSizePx, useAzkarPrefs } from "@/lib/azkar/prefs";
import { personalCount, useWirdSessionProgress, wirdCompletion } from "@/lib/wird/progress";
import { buildWirdEntries, entryName, personalRefs, type WirdEntry } from "@/lib/wird/entries";
import { usePersonalAzkar } from "@/lib/personal-azkar/store";
import { PersonalBadge, PersonalMenuButton } from "@/components/manar/personal-zikr-actions";
import { usePersonalControls } from "@/components/manar/personal-wird-controls";
import { AddZikrButton } from "@/components/manar/personal-zikr-actions";

export const Route = createFileRoute("/wird/$session")({
  head: () => ({
    meta: [
      { title: "جلسة الوِرد — منار" },
      {
        name: "description",
        content: "جلسة وِرد متسلسلة: ذكر واحد في كل مرة مع عدّاد تفاعلي وحفظ تلقائي للتقدّم.",
      },
      { property: "og:title", content: "جلسة الوِرد — منار" },
      {
        property: "og:description",
        content: "اقرأ وِردك ذكرًا بذكر مع عدّاد سريع وتقدّم محفوظ محليًا.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WirdSessionPage,
});

function WirdSessionPage() {
  const { session } = Route.useParams();
  const nav = useNavigate();
  const wird = getWirdSession(session);
  const key = wird?.key ?? "morning";
  const items = useMemo(() => wird?.items ?? [], [wird]);
  const {
    progress,
    hydrated,
    increment,
    decrement,
    setCurrent,
    resetSession,
    incrementPersonal,
    decrementPersonal,
  } = useWirdSessionProgress(key, items);
  const personal = usePersonalAzkar();
  /* الأذكار الأصلية بترتيبها الثابت، وأذكار المستخدم في مواضعها. */
  const entries = useMemo(
    () => buildWirdEntries(key, items, personal.items),
    [key, items, personal.items],
  );
  const refs = useMemo(() => personalRefs(entries), [entries]);
  const controls = usePersonalControls({ context: "wird", session: key });
  const [index, setIndex] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const { prefs, update: updatePrefs } = useAzkarPrefs();
  const [showDisplay, setShowDisplay] = useState(false);
  const startX = useRef<number | null>(null);
  /** يوم آخر استئناف — يُعاد الاستئناف إن تجدّد الوِرد بيومٍ جديد والشاشة مفتوحة. */
  const restored = useRef<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** الذكر المعروض الآن — يقرؤه مؤقت الانتقال التلقائي بدل فهرس قديم. */
  const shownKey = useRef<string | null>(null);

  /** العدد الخام والهدف لأي عنصر (الأصلي بترتيبه، والشخصي بمعرّفه). */
  const rawOf = useCallback(
    (e: WirdEntry) =>
      e.kind === "original"
        ? (progress.counts[e.item.order] ?? 0)
        : personalCount(progress, e.zikr.id),
    [progress],
  );
  const repeatOf = (e: WirdEntry): number | null =>
    e.kind === "original" ? e.item.repeat : e.repeat;
  /** للتنقّل والاستئناف: ذو العدد يكتمل بعدده، والمفتوح يُعدّ مقولًا بعد أول عدّة. */
  const flowDone = useCallback(
    (e: WirdEntry) => {
      const r = e.kind === "original" ? e.item.repeat : e.repeat;
      return r == null ? rawOf(e) > 0 : rawOf(e) >= r;
    },
    [rawOf],
  );

  const entry = entries[index];
  const repeat = entry ? repeatOf(entry) : 1;
  const raw = entry ? rawOf(entry) : 0;
  const count = repeat == null ? raw : Math.min(repeat, raw);
  shownKey.current = entry?.key ?? null;
  const remaining = repeat == null ? 0 : repeat - count;
  const overall = useMemo(() => wirdCompletion(progress, items, refs), [progress, items, refs]);
  const countable = items.length + refs.filter((r) => r.repeat != null).length;
  /* الشاشة تبقى مضاءة أثناء الجلسة (العدّ مئة مرة يتجاوز مهلة إطفائها). */
  useKeepAwake(Boolean(wird), { idleMs: KEEP_AWAKE_IDLE_MS });

  // استئناف: أول ذكر غير مكتمل (أو المحفوظ)
  useEffect(() => {
    const day = progress.day ?? "";
    if (!hydrated || !personal.hydrated || restored.current === day || entries.length === 0) return;
    restored.current = day;
    const firstIncomplete = entries.findIndex((e) => !flowDone(e));
    const savedIdx = entries.findIndex(
      (e) => e.kind === "original" && e.item.order === progress.current,
    );
    setIndex(firstIncomplete >= 0 ? firstIncomplete : savedIdx >= 0 ? savedIdx : 0);
  }, [hydrated, personal.hydrated, entries, progress, flowDone]);

  /* إن أُضيف ذكر شخصي أو حُذف والشاشة مفتوحة: يبقى الذكر المعروض نفسه. */
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const k = lastKey.current;
    if (k && entries[index]?.key !== k) {
      const at = entries.findIndex((e) => e.key === k);
      setIndex(at >= 0 ? at : Math.max(0, Math.min(index, entries.length - 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- يُتابَع تغيّر القائمة وحده
  }, [entries]);
  lastKey.current = entry?.key ?? null;

  useEffect(() => {
    if (entry?.kind === "original") setCurrent(entry.item.order);
  }, [entry, setCurrent]);

  const goto = useCallback(
    (next: number) => {
      if (next < 0 || next >= entries.length) return;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
      setIndex(next);
    },
    [entries.length],
  );

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const { announce, node: liveRegion } = useAnnouncer();
  const onTap = useCallback(() => {
    if (!entry) return;
    if (repeat != null && count >= repeat) {
      /* ذكر مكتمل: التالي، أو في آخر الوِرد أول ذكر ناقص — لا نقرة «ميتة». */
      if (index + 1 < entries.length) goto(index + 1);
      else {
        const missing = entries.findIndex((e) => {
          const r = repeatOf(e);
          return r != null && rawOf(e) < r;
        });
        if (missing >= 0) goto(missing);
        else announce(`تم إكمال ${wird?.title ?? "الوِرد"}`);
      }
      return;
    }
    if (repeat == null) {
      /* عدد مفتوح: يزيد بلا سقف ولا انتقال تلقائي؛ «التالي» متى شاء المستخدم. */
      haptic(prefs, "tap");
      announce(toArabicDigits(raw + 1));
      if (entry.kind === "personal") incrementPersonal(entry.zikr.id, null);
      return;
    }
    haptic(prefs, hapticFor(count, repeat));
    announce(counterAnnouncement(count, repeat));
    if (entry.kind === "original") increment(entry.item.order, repeat);
    else incrementPersonal(entry.zikr.id, repeat);
    /* الإكمال يُحسب في وحدة التقدّم من اكتمال كل الأذكار، لا من آخرها. */
    if (count + 1 >= repeat && index + 1 < entries.length) {
      const doneKey = entry.key;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        if (shownKey.current !== doneKey) return;
        const at = entries.findIndex((e) => e.key === doneKey);
        if (at >= 0 && at + 1 < entries.length) setIndex(at + 1);
      }, 320);
    }
  }, [
    entry,
    repeat,
    count,
    raw,
    prefs,
    announce,
    increment,
    incrementPersonal,
    index,
    entries,
    goto,
    rawOf,
    wird?.title,
  ]);

  /** قراءة جديدة فورية بعد الإكمال (بلا تأكيد — لا شيء ناقص يضيع). */
  const startFresh = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    resetSession();
    setIndex(0);
    announce("بدأت قراءة جديدة");
  }, [resetSession, announce]);

  const onUndo = useCallback(() => {
    if (!entry || count <= 0) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    if (entry.kind === "original") decrement(entry.item.order);
    else decrementPersonal(entry.zikr.id);
    announce(
      repeat == null
        ? `تراجع، ${toArabicDigits(count - 1)}`
        : `تراجع، ${toArabicDigits(count - 1)} من ${toArabicDigits(repeat)}`,
    );
  }, [entry, count, repeat, decrement, decrementPersonal, announce]);

  /** الضغط على نص الذكر يعدّ (إن فُعّل)، إلا على الأزرار أو أثناء تحديد نص. */
  const onTextTap = (e: React.MouseEvent) => {
    if (!prefs.tapAnywhere || !isCountableTap(e.target)) return;
    onTap();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 70) return;
    // RTL: السحب لليسار ⇒ الذكر التالي
    goto(dx < 0 ? index + 1 : index - 1);
  };

  if (!wird) {
    return (
      <Screen>
        <div className="px-5 pt-24 text-center text-sm text-muted-foreground">وِرد غير معروف.</div>
        <div className="mt-4 px-5">
          <Link
            to="/wird"
            className="gradient-primary block rounded-2xl py-3 text-center text-sm text-primary-foreground"
          >
            رجوع إلى الوِرد
          </Link>
        </div>
      </Screen>
    );
  }

  const allDone = overall.completedItems === countable && items.length > 0;
  const item = entry?.kind === "original" ? entry.item : null;
  const pz = entry?.kind === "personal" ? entry.zikr : null;

  return (
    <Screen padBottom={false}>
      <div className="min-h-screen flex flex-col">
        {/* شريط علوي */}
        <div className="flex items-center justify-between px-5 pt-6">
          <button
            onClick={() => nav({ to: "/wird" })}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft"
            aria-label="إيقاف الجلسة والعودة"
          >
            <span className="rotate-180">
              <Icon d={icons.back} size={18} />
            </span>
          </button>
          <div className="text-center">
            <div className="font-display text-lg font-medium leading-tight">{wird.title}</div>
            <div className="text-[11px] text-muted-foreground">
              الذكر {toArabicDigits(index + 1)} من {toArabicDigits(entries.length)}
            </div>
          </div>
          <button
            onClick={() => setConfirmReset(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
            aria-label="إعادة الوِرد"
          >
            <Icon d={icons.refresh} size={16} />
          </button>
        </div>

        {/* شريط التقدّم المتحرك */}
        <div className="mt-4 px-5">
          <WirdProgressBar
            ratio={overall.ratio}
            currentName={entry ? entryName(entry) : undefined}
            currentOrder={index + 1}
            total={entries.length}
            countable={countable}
            remaining={repeat == null ? null : remaining}
            completedItems={overall.completedItems}
            saved={Boolean(progress.updatedAt)}
          />
          <div className="mt-3 flex gap-2">
            <Link
              to="/wird/list/$session"
              params={{ session: key }}
              className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-card py-2.5 text-center text-[11px] text-muted-foreground"
            >
              عرض كل الأذكار بالتفصيل
            </Link>
            <AddZikrButton onClick={controls.openAdd} className="min-h-[40px] text-[12px]" />
          </div>
        </div>

        {/* الذكر */}
        <div className="flex-1 px-5 pt-5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {!hydrated || !entry ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3 rounded-xl" />
              <Skeleton className="h-48 w-full rounded-[28px]" />
            </div>
          ) : pz && entry?.kind === "personal" ? (
            <div
              key={entry.key}
              className="glass-flat relative overflow-hidden rounded-[28px] p-5 shadow-soft animate-fade-up"
            >
              <Arabesque className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 text-primary/10" />
              <div className="relative flex items-start gap-2">
                <span className="mt-2 h-px w-4 shrink-0 bg-gold" />
                <div className="min-w-0 flex-1">
                  <div className="break-words text-[11px] font-medium tracking-wide text-foreground/80">
                    {entry.name}
                  </div>
                  <div className="mt-1">
                    <PersonalBadge pinned={pz.pinned} />
                  </div>
                </div>
                <DisplayToggleButton open={showDisplay} onClick={() => setShowDisplay((v) => !v)} />
                <PersonalMenuButton zikr={pz} onClick={() => controls.openMenu(pz)} />
              </div>
              {showDisplay && <AzkarDisplayPanel prefs={prefs} update={updatePrefs} />}
              <div
                onClick={onTextTap}
                dir="auto"
                className={`tap-text relative mt-4 max-h-[38vh] overflow-y-auto whitespace-pre-line break-words text-right font-display leading-[2.15] text-foreground ${
                  prefs.tapAnywhere ? "cursor-pointer select-none" : ""
                }`}
                style={{ WebkitOverflowScrolling: "touch", fontSize: textSizePx(prefs) }}
              >
                {pz.text}
              </div>
              <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] text-muted-foreground">
                {repeat == null ? "عدد مفتوح" : `${toArabicDigits(repeat)} مرة`}
              </div>
              {repeat == null && (
                <p className="relative mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  عدد مفتوح بلا هدف: انتقل بزر «التالي» متى شئت.
                </p>
              )}
            </div>
          ) : item ? (
            <div
              key={item.order}
              className="glass-flat relative overflow-hidden rounded-[28px] p-5 shadow-soft animate-fade-up"
            >
              <Arabesque className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 text-primary/10" />
              <div className="relative flex items-center gap-2">
                <span className="h-px w-4 bg-gold" />
                <span className="flex-1 text-[11px] font-medium tracking-wide text-foreground/80">
                  {item.name}
                </span>
                <DisplayToggleButton open={showDisplay} onClick={() => setShowDisplay((v) => !v)} />
              </div>
              {showDisplay && <AzkarDisplayPanel prefs={prefs} update={updatePrefs} />}
              <div
                onClick={onTextTap}
                className={`tap-text relative mt-4 max-h-[38vh] overflow-y-auto text-right text-foreground ${
                  item.quran ? "font-quran leading-[2.4]" : "font-display leading-[2.15]"
                } ${prefs.tapAnywhere ? "cursor-pointer select-none" : ""}`}
                style={{
                  WebkitOverflowScrolling: "touch",
                  /* خط المصحف للقرآن وحده؛ الأحاديث بخط الأذكار كما في قسم الأذكار. */
                  fontSize: item.quran ? textSizePx(prefs) - 0.4 : textSizePx(prefs),
                }}
              >
                {item.opening && <p className="mb-1 text-center text-primary">{item.opening}</p>}
                {item.text}
              </div>
              <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] text-muted-foreground">
                {toArabicDigits(item.repeat)} مرة
              </div>
              {isDailyOnce(item.hisn) && (
                <p className="relative mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  عدّاد يومي واحد: يُحتسب في وِرد الصباح والمساء وفي الأذكار معًا.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* العدّاد */}
        <div className="px-5 pb-8 pt-6">
          {allDone && (
            <div className="mb-5 w-full rounded-[24px] border border-primary/30 bg-card p-4 text-center shadow-soft animate-fade-up">
              <div className="font-display text-lg font-medium">تم إكمال {wird.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                تقبّل الله منك. يتجدّد الوِرد تلقائيًا غدًا، ويمكنك قراءته من جديد الآن.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={startFresh}
                  className="gradient-primary flex-1 rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow"
                >
                  قراءة جديدة
                </button>
                <button
                  onClick={() => nav({ to: "/wird" })}
                  className="flex-1 rounded-2xl border border-border bg-card py-3 text-sm"
                >
                  العودة
                </button>
              </div>
            </div>
          )}
          {entry && (
            <div className="flex flex-col items-center">
              {liveRegion}
              <button
                onClick={onTap}
                className="counter-tap relative flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-card bg-gradient-to-br from-primary/25 via-card/70 to-gold/20 shadow-elegant transition-transform duration-100 active:scale-95"
                aria-label={
                  repeat == null
                    ? `زيادة العدّاد، ${toArabicDigits(count)}، عدد مفتوح`
                    : `زيادة العدّاد، ${toArabicDigits(count)} من ${toArabicDigits(repeat)}`
                }
              >
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="4"
                  />
                  {repeat != null && (
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="url(#wird-grad)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 45}
                      strokeDashoffset={2 * Math.PI * 45 * (1 - count / repeat)}
                      style={{ transition: "stroke-dashoffset 140ms linear" }}
                    />
                  )}
                  <defs>
                    <linearGradient id="wird-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#C9A227" />
                      <stop offset="100%" stopColor="#F0D78C" />
                    </linearGradient>
                  </defs>
                </svg>
                <span key={count} className="animate-count-pop relative flex flex-col items-center">
                  <span className="font-display text-4xl font-medium tabular-nums">
                    {toArabicDigits(count)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {repeat == null ? "عدد مفتوح" : `من ${toArabicDigits(repeat)}`}
                  </span>
                </span>
              </button>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                {repeat != null && <span>متبقي {toArabicDigits(remaining)}</span>}
                <button
                  onClick={onUndo}
                  disabled={count <= 0}
                  aria-label="تراجع عن آخر عدّة"
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] disabled:opacity-40"
                >
                  <Icon d={icons.minus} size={12} />
                  تراجع
                </button>
              </div>

              {/* الترتيب كجلسة الأذكار: «السابق» يمينًا و«التالي» يسارًا. */}
              <div className="mt-5 flex w-full items-center gap-2">
                <button
                  onClick={() => goto(index - 1)}
                  disabled={index === 0}
                  className="flex-1 rounded-2xl border border-border bg-card py-3 text-xs disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  onClick={() => goto(index + 1)}
                  disabled={index + 1 >= entries.length}
                  className="flex-1 rounded-2xl border border-border bg-card py-3 text-xs disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-6 backdrop-blur-sm">
          <div className="glass w-full max-w-sm rounded-[28px] p-6 text-center shadow-elegant">
            <div className="font-display text-lg font-medium">إعادة {wird.title}؟</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              سيتم إعادة ضبط عدّادات هذا الوِرد فقط، ولن يتأثر الوِرد الآخر ولا الأذكار.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  resetSession();
                  setIndex(0);
                  setConfirmReset(false);
                }}
                className="flex-1 rounded-2xl border border-destructive/30 bg-destructive/5 py-3 text-sm text-destructive"
              >
                إعادة
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-2xl border border-border py-3 text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {controls.nodes}
    </Screen>
  );
}
