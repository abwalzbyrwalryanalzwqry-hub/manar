import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Arabesque, Icon, icons, Screen, Skeleton } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/format";
import { getWirdSession } from "@/lib/wird/data";
import { useWirdSessionProgress, wirdCompletion } from "@/lib/wird/progress";

export const Route = createFileRoute("/wird/$session")({
  head: () => ({
    meta: [
      { title: "جلسة الوِرد — منار" },
      { name: "description", content: "جلسة وِرد متسلسلة: ذكر واحد في كل مرة مع عدّاد تفاعلي وحفظ تلقائي للتقدّم." },
      { property: "og:title", content: "جلسة الوِرد — منار" },
      { property: "og:description", content: "اقرأ وِردك ذكرًا بذكر مع عدّاد سريع وتقدّم محفوظ محليًا." },
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
  const { progress, hydrated, increment, setCurrent, markDone, resetSession } = useWirdSessionProgress(key);
  const [index, setIndex] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pulse, setPulse] = useState(0);
  const startX = useRef<number | null>(null);
  const restored = useRef(false);

  const items = wird?.items ?? [];
  const item = items[index];
  const count = item ? Math.min(item.repeat, progress.counts[item.order] ?? 0) : 0;
  const remaining = item ? item.repeat - count : 0;
  const overall = useMemo(() => wirdCompletion(progress, items), [progress, items]);

  // استئناف: أول ذكر غير مكتمل (أو المحفوظ)
  useEffect(() => {
    if (!hydrated || restored.current || items.length === 0) return;
    restored.current = true;
    const firstIncomplete = items.findIndex((it) => (progress.counts[it.order] ?? 0) < it.repeat);
    const savedIdx = items.findIndex((it) => it.order === progress.current);
    setIndex(firstIncomplete >= 0 ? firstIncomplete : savedIdx >= 0 ? savedIdx : 0);
  }, [hydrated, items, progress]);

  useEffect(() => {
    if (item) setCurrent(item.order);
  }, [item, setCurrent]);

  const goto = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length) return;
      setIndex(next);
    },
    [items.length],
  );

  const onTap = useCallback(() => {
    if (!item) return;
    if (count >= item.repeat) {
      goto(index + 1);
      return;
    }
    increment(item.order, item.repeat);
    setPulse((p) => p + 1);
    if (count + 1 >= item.repeat) {
      if (index + 1 < items.length) window.setTimeout(() => goto(index + 1), 320);
      else markDone(true);
    }
  }, [item, count, increment, index, items.length, goto, markDone]);

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
          <Link to="/wird" className="gradient-primary block rounded-2xl py-3 text-center text-sm text-primary-foreground">
            رجوع إلى الوِرد
          </Link>
        </div>
      </Screen>
    );
  }

  const allDone = overall.completedItems === items.length && items.length > 0;

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
            <span className="rotate-180"><Icon d={icons.back} size={18} /></span>
          </button>
          <div className="text-center">
            <div className="font-display text-lg font-medium leading-tight">{wird.title}</div>
            <div className="text-[11px] text-muted-foreground">
              الذكر {toArabicDigits(index + 1)} من {toArabicDigits(items.length)}
            </div>
          </div>
          <button
            onClick={() => setConfirmReset(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft"
            aria-label="إعادة الوِرد"
          >
            <Icon d={icons.trend} size={16} />
          </button>
        </div>

        {/* شريط التقدّم العام */}
        <div className="mt-4 px-5">
          <div className="h-1 overflow-hidden rounded-full bg-secondary">
            <div className="gradient-gold h-full transition-all duration-300" style={{ width: `${overall.ratio * 100}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              مكتمل: {toArabicDigits(overall.completedItems)}/{toArabicDigits(items.length)}
            </span>
            <span>{progress.updatedAt ? "تم حفظ التقدّم" : "سيُحفظ تقدّمك تلقائيًا"}</span>
          </div>
        </div>

        {/* الذكر */}
        <div className="flex-1 px-5 pt-5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {!hydrated || !item ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3 rounded-xl" />
              <Skeleton className="h-48 w-full rounded-[28px]" />
            </div>
          ) : (
            <div key={item.order} className="glass relative overflow-hidden rounded-[28px] p-5 shadow-soft animate-fade-up">
              <Arabesque className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 text-primary/10" />
              <div className="relative flex items-center gap-2">
                <span className="h-px w-4 bg-gold" />
                <span className="text-[11px] font-medium tracking-wide text-foreground/80">{item.name}</span>
              </div>
              <div
                className="relative mt-4 max-h-[38vh] overflow-y-auto text-right font-quran text-[1.35rem] leading-[2.4] text-foreground"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {item.text}
              </div>
              <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] text-muted-foreground">
                {toArabicDigits(item.repeat)} مرة
              </div>
            </div>
          )}
        </div>

        {/* العدّاد */}
        <div className="px-5 pb-8 pt-6">
          {item && (
            <div className="flex flex-col items-center">
              <button
                onClick={onTap}
                className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-primary/25 via-card/70 to-gold/20 shadow-elegant backdrop-blur-2xl transition active:scale-95"
                aria-label="زيادة العدّاد"
              >
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="4" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#wird-grad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={2 * Math.PI * 45 * (1 - count / item.repeat)}
                    style={{ transition: "stroke-dashoffset 140ms linear" }}
                  />
                  <defs>
                    <linearGradient id="wird-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#C9A227" />
                      <stop offset="100%" stopColor="#F0D78C" />
                    </linearGradient>
                  </defs>
                </svg>
                <span key={pulse} className="relative flex flex-col items-center animate-fade-up">
                  <span className="font-display text-4xl font-medium tabular-nums">{toArabicDigits(count)}</span>
                  <span className="text-[11px] text-muted-foreground">من {toArabicDigits(item.repeat)}</span>
                </span>
              </button>
              <div className="mt-3 text-xs text-muted-foreground">متبقي {toArabicDigits(remaining)}</div>

              <div className="mt-5 flex w-full items-center gap-2">
                <button
                  onClick={() => goto(index + 1)}
                  disabled={index + 1 >= items.length}
                  className="flex-1 rounded-2xl border border-border bg-card py-3 text-xs disabled:opacity-40"
                >
                  التالي
                </button>
                <button
                  onClick={() => goto(index - 1)}
                  disabled={index === 0}
                  className="flex-1 rounded-2xl border border-border bg-card py-3 text-xs disabled:opacity-40"
                >
                  السابق
                </button>
              </div>

              {allDone && (
                <div className="mt-5 w-full rounded-[24px] border border-border bg-card p-4 text-center shadow-soft">
                  <div className="font-display text-lg font-medium">تم إكمال {wird.title}</div>
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="gradient-primary mt-3 w-full rounded-2xl py-3 text-sm font-medium text-primary-foreground shadow-glow"
                  >
                    إعادة الورد
                  </button>
                </div>
              )}
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
              <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-2xl border border-border py-3 text-sm">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
