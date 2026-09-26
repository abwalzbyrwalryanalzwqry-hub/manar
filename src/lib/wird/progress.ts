// ============================================================
// Manar — Wird Module: تقدّم مستقل تمامًا عن عدّاد الأذكار
// تخزين محلي (offline) بمفتاح خاص بالوِرد فقط
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { WirdSessionKey } from "./data";
import { dayKey, recordWird } from "@/lib/activity-log";
import { useDayKey, useOnLeave } from "@/hooks/use-day-key";

const KEY = "manar.wird.progress.v1";
const EVENT = "manar:wird-progress";
/**
 * إصدار ترتيب أذكار الوِرد. العدّادات مفهرسة بـ«الترتيب»، فإذا تغيّرت قائمة الأذكار
 * (كما في توحيدها مع «حصن المسلم») صار التقدّم القديم يشير إلى أذكار أخرى،
 * فيُهمل عند القراءة بدل عرضه على ذكر خاطئ.
 */
export const WIRD_LAYOUT = 3;

/** مهلة تجميع الكتابة إلى التخزين أثناء العدّ السريع. */
const WRITE_DELAY_MS = 180;

export interface WirdSessionProgress {
  /** ترتيب الذكر → العدد الحالي */
  counts: Record<number, number>;
  /** الذكر النشط حاليًا (ترتيبه) */
  current: number;
  /** هل اكتملت كل أذكار الوِرد اليوم */
  done: boolean;
  updatedAt: number | null;
  /** إصدار ترتيب الأذكار الذي كُتب به هذا التقدّم (انظر WIRD_LAYOUT). */
  layout?: number;
  /** يوم هذا التقدّم (YYYY-MM-DD محليًا). الوِرد يومي فيبدأ من الصفر كل يوم. */
  day?: string;
}

export type WirdStore = Record<WirdSessionKey, WirdSessionProgress>;
export type WirdItemRef = { order: number; repeat: number };

export const emptySession = (day = dayKey()): WirdSessionProgress => ({
  counts: {},
  current: 1,
  done: false,
  updatedAt: null,
  layout: WIRD_LAYOUT,
  day,
});

/** يقبل تقدّم الجلسة فقط إن كُتب اليوم وبترتيب الأذكار الحالي. */
export function readSession(
  raw: Partial<WirdSessionProgress> | undefined,
  day = dayKey(),
): WirdSessionProgress {
  if (!raw || raw.layout !== WIRD_LAYOUT || raw.day !== day) return emptySession(day);
  return { ...emptySession(day), ...raw };
}

/** هل اكتملت كل أذكار الوِرد؟ */
export function isWirdComplete(p: Pick<WirdSessionProgress, "counts">, items: WirdItemRef[]) {
  return items.length > 0 && items.every((it) => (p.counts[it.order] ?? 0) >= it.repeat);
}

/** عدّة ضغطة (دالة نقية). `done` يُشتق من اكتمال **كل** العناصر، لا آخرها. */
export function applyIncrement(
  p: WirdSessionProgress,
  order: number,
  repeat: number,
  items: WirdItemRef[],
): WirdSessionProgress {
  const n = Math.min(repeat, (p.counts[order] ?? 0) + 1);
  const counts = { ...p.counts, [order]: n };
  return { ...p, counts, done: isWirdComplete({ counts }, items) };
}

function readStore(day = dayKey()): WirdStore {
  const blank = { morning: emptySession(day), evening: emptySession(day) };
  if (typeof window === "undefined") return blank;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blank;
    const parsed = JSON.parse(raw) as Partial<Record<WirdSessionKey, Partial<WirdSessionProgress>>>;
    return {
      morning: readSession(parsed.morning, day),
      evening: readSession(parsed.evening, day),
    };
  } catch {
    return blank;
  }
}

function writeSession(session: WirdSessionKey, next: WirdSessionProgress) {
  try {
    const store = readStore(next.day);
    window.localStorage.setItem(KEY, JSON.stringify({ ...store, [session]: next }));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/** قراءة تقدّم الوِردين (للبطاقات في الصفحة الرئيسية للوِرد). */
export function useWirdOverview() {
  const day = useDayKey();
  /* يبدأ فارغًا ثم يُقرأ بعد التركيب، حتى يطابق ما رُسم على الخادم. */
  const [store, setStore] = useState<WirdStore>(() => ({
    morning: emptySession(),
    evening: emptySession(),
  }));
  useEffect(() => {
    const sync = () => setStore(readStore());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [day]);
  return store;
}

/**
 * جلسة وِرد واحدة — عدّاد سريع:
 * الحالة تُحدّث فورًا في الذاكرة، والكتابة إلى التخزين مُجمّعة (debounce)
 * لتجنّب أي تقطيع عند الأعداد الكبيرة مثل ١٠٠. الكتابة المعلّقة تُنفَّذ فورًا عند
 * مغادرة الشاشة أو إرسال التطبيق للخلفية، فلا تضيع آخر الضغطات.
 */
export function useWirdSessionProgress(session: WirdSessionKey, items: WirdItemRef[]) {
  const [state, setState] = useState<WirdSessionProgress>(() => emptySession());
  const [hydrated, setHydrated] = useState(false);
  const ref = useRef(state);
  const pending = useRef<WirdSessionProgress | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const day = useDayKey();

  /** يكتب أي تقدّم معلّق الآن. */
  const flushNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) writeSession(session, next);
  }, [session]);

  useEffect(() => {
    flushNow();
    ref.current = readStore(day)[session];
    setState(ref.current);
    setHydrated(true);
  }, [session, day, flushNow]);

  useEffect(() => flushNow, [flushNow]);
  useOnLeave(flushNow);

  const commit = useCallback(
    (fn: (prev: WirdSessionProgress) => WirdSessionProgress) => {
      /* انتقل اليوم أثناء فتح الشاشة؟ ابدأ من وِرد جديد بدل البناء على الأمس. */
      const today = dayKey();
      const prev = ref.current.day === today ? ref.current : emptySession(today);
      const changed = fn(prev);
      if (changed === prev) return;
      const next = { ...changed, updatedAt: Date.now(), layout: WIRD_LAYOUT, day: today };
      ref.current = next;
      setState(next);
      /* الإكمال يُسجّل في السجل اليومي الموحّد ليُحتسب في السلسلة والإحصائيات —
       * مرة واحدة عند انتقاله من ناقص إلى تام، خارج دالة setState. */
      if (next.done && !prev.done) recordWird(session);
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flushNow, WRITE_DELAY_MS);
    },
    [session, flushNow],
  );

  /** زيادة عدّاد ذكر بمقدار ١ (مع سقف العدد المطلوب). */
  const increment = useCallback(
    (order: number, repeat: number) =>
      commit((p) => applyIncrement(p, order, repeat, itemsRef.current)),
    [commit],
  );

  const setCurrent = useCallback(
    (order: number) => commit((p) => (p.current === order ? p : { ...p, current: order })),
    [commit],
  );

  const resetSession = useCallback(() => commit(() => emptySession()), [commit]);

  const resetItem = useCallback(
    (order: number) => commit((p) => ({ ...p, counts: { ...p.counts, [order]: 0 }, done: false })),
    [commit],
  );

  return { progress: state, hydrated, increment, setCurrent, resetSession, resetItem };
}

/** نسبة إنجاز الوِرد (٠..١) بالنسبة لمجموع التكرارات المطلوبة. */
export function wirdCompletion(p: WirdSessionProgress, items: { order: number; repeat: number }[]) {
  const total = items.reduce((s, it) => s + it.repeat, 0);
  const done = items.reduce((s, it) => s + Math.min(it.repeat, p.counts[it.order] ?? 0), 0);
  const completedItems = items.filter((it) => (p.counts[it.order] ?? 0) >= it.repeat).length;
  return { total, done, ratio: total ? done / total : 0, completedItems };
}
