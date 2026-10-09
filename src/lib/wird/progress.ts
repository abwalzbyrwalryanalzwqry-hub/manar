// ============================================================
// Manar — Wird Module: تقدّم مستقل تمامًا عن عدّاد الأذكار
// تخزين محلي (offline) بمفتاح خاص بالوِرد فقط
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { WIRD_SESSIONS, type WirdSessionKey } from "./data";
import { dayKey, recordWird } from "@/lib/activity-log";
import { useDayKey, useOnLeave } from "@/hooks/use-day-key";
import { markAzkarComplete, readAzkarCompleted, type CompleteEntry } from "@/lib/azkar/progress";
import { dailyCarryOver, linkedAzkarEntries, type LinkableItem } from "./link";
import type { PersonalRef } from "./entries";

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
  /**
   * عدّادات الأذكار الشخصية في هذا الوِرد: معرّف الذكر ← العدد. منفصلة عن `counts`
   * (المفهرسة بترتيب الأذكار الأصلية) فلا يتغيّر تقدّم الأذكار الأصلية ولا `WIRD_LAYOUT`.
   */
  personal?: Record<string, number>;
}

export type WirdStore = Record<WirdSessionKey, WirdSessionProgress>;
export type WirdItemRef = LinkableItem;

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
  const out: WirdSessionProgress = { ...emptySession(day), ...raw };
  const personal = cleanPersonal(raw.personal);
  if (personal) out.personal = personal;
  else delete out.personal;
  return out;
}

function cleanPersonal(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Number.isSafeInteger(v) && (v as number) > 0) out[k] = v as number;
  }
  return Object.keys(out).length ? out : undefined;
}

/** عدد ذكر شخصي في جلسة الوِرد. */
export function personalCount(p: Pick<WirdSessionProgress, "personal">, id: string): number {
  return p.personal?.[id] ?? 0;
}

/**
 * هل اكتملت كل أذكار الوِرد؟ الأذكار الشخصية ذات العدد تُحتسب إن مُرّرت؛
 * الذكر المفتوح لا هدف له فلا يمنع الإتمام.
 */
export function isWirdComplete(
  p: Pick<WirdSessionProgress, "counts" | "personal">,
  items: WirdItemRef[],
  personal: readonly PersonalRef[] = [],
) {
  return (
    items.length > 0 &&
    items.every((it) => (p.counts[it.order] ?? 0) >= it.repeat) &&
    personal.every((r) => r.repeat == null || personalCount(p, r.id) >= r.repeat)
  );
}

/** عدّة لذكر شخصي (دالة نقية). سقفه عدده، والمفتوح بلا سقف سوى الرقم الآمن. */
export function applyPersonalIncrement(
  p: WirdSessionProgress,
  id: string,
  repeat: number | null,
): WirdSessionProgress {
  const now = personalCount(p, id);
  const cap = repeat ?? Number.MAX_SAFE_INTEGER;
  if (now >= cap) return p;
  return { ...p, personal: { ...p.personal, [id]: now + 1 } };
}

/** تراجع عن آخر عدّة لذكر شخصي؛ لا ينزل تحت الصفر. */
export function applyPersonalDecrement(p: WirdSessionProgress, id: string): WirdSessionProgress {
  const now = personalCount(p, id);
  if (now <= 0) return p;
  const personal = { ...p.personal, [id]: now - 1 };
  if (personal[id] === 0) delete personal[id];
  return { ...p, personal };
}

export function applyPersonalReset(p: WirdSessionProgress, id: string): WirdSessionProgress {
  if (!personalCount(p, id)) return p;
  const personal = { ...p.personal };
  delete personal[id];
  return { ...p, personal };
}

/** تراجع عن آخر عدّة (دالة نقية). */
export function applyDecrement(
  p: WirdSessionProgress,
  order: number,
  items: WirdItemRef[],
): WirdSessionProgress {
  const now = p.counts[order] ?? 0;
  if (now <= 0) return p;
  const counts = { ...p.counts, [order]: now - 1 };
  return { ...p, counts, done: isWirdComplete({ counts }, items) };
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

/** الأذكار اليومية المقولة في الوِرد الآخر أو في الأذكار تُحتسب في الوِردين. */
export function withDailyCarry(
  store: WirdStore,
  azkarCompleted: ReadonlySet<string> = readAzkarCompleted(),
): WirdStore {
  const next = { ...store };
  for (const [s, other] of [
    ["morning", "evening"],
    ["evening", "morning"],
  ] as const) {
    const items = WIRD_SESSIONS[s].items;
    const counts = dailyCarryOver(
      items,
      store[s].counts,
      WIRD_SESSIONS[other].items,
      store[other].counts,
      azkarCompleted,
    );
    if (counts) next[s] = { ...store[s], counts, done: isWirdComplete({ counts }, items) };
  }
  return next;
}

function readStore(day = dayKey()): WirdStore {
  const blank = { morning: emptySession(day), evening: emptySession(day) };
  if (typeof window === "undefined") return blank;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return withDailyCarry(blank);
    const parsed = JSON.parse(raw) as Partial<Record<WirdSessionKey, Partial<WirdSessionProgress>>>;
    return withDailyCarry({
      morning: readSession(parsed.morning, day),
      evening: readSession(parsed.evening, day),
    });
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

/** يبدأ قراءة جديدة لوِرد (من بطاقة الوِرد بعد إكماله). */
export function resetWirdSession(session: WirdSessionKey) {
  if (typeof window === "undefined") return;
  writeSession(session, { ...emptySession(), updatedAt: Date.now() });
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
  /* أعمال السجل اليومي (JSON كبير لدى المستخدم القديم) تُؤجَّل للحفظ المجمّع
   * حتى لا تثقل نقرة الإتمام ولا الانتقال للذكر التالي. */
  const pendingLinks = useRef<CompleteEntry[]>([]);
  const pendingDone = useRef(false);
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
    if (pendingDone.current) {
      pendingDone.current = false;
      recordWird(session);
    }
    const links = pendingLinks.current;
    pendingLinks.current = [];
    if (links.length) markAzkarComplete(links);
  }, [session]);

  useEffect(() => {
    flushNow();
    ref.current = readStore(day)[session];
    setState(ref.current);
    setHydrated(true);
    /* ما أُتمّ من الوِرد اليوم قبل الربط (أو على جهاز آخر) يُحتسب في الأذكار أيضًا. */
    markAzkarComplete(linkedAzkarEntries(session, itemsRef.current, ref.current.counts));
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
      if (next.done && !prev.done) pendingDone.current = true;
      /* كل ذكر اكتمل الآن في الوِرد يُعلَّم مكتملًا في أذكار الوقت نفسه. */
      const links = linkedAzkarEntries(session, itemsRef.current, next.counts, prev.counts);
      if (links.length) pendingLinks.current.push(...links);
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

  /** تراجع عن آخر عدّة في ذكر. */
  const decrement = useCallback(
    (order: number) => commit((p) => applyDecrement(p, order, itemsRef.current)),
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

  /* الأذكار الشخصية: العدّاد نفسه وآلية الحفظ نفسها، بمفاتيح معرّفاتها. */
  const incrementPersonal = useCallback(
    (id: string, repeat: number | null) => commit((p) => applyPersonalIncrement(p, id, repeat)),
    [commit],
  );
  const decrementPersonal = useCallback(
    (id: string) => commit((p) => applyPersonalDecrement(p, id)),
    [commit],
  );
  const resetPersonal = useCallback(
    (id: string) => commit((p) => applyPersonalReset(p, id)),
    [commit],
  );

  return {
    progress: state,
    hydrated,
    increment,
    decrement,
    setCurrent,
    resetSession,
    resetItem,
    incrementPersonal,
    decrementPersonal,
    resetPersonal,
  };
}

/**
 * نسبة إنجاز الوِرد (٠..١) بالنسبة لمجموع التكرارات المطلوبة. الأذكار الشخصية
 * ذات العدد تدخل في المجموع إن مُرّرت؛ المفتوحة لا هدف لها فلا تدخل النسبة.
 */
export function wirdCompletion(
  p: WirdSessionProgress,
  items: { order: number; repeat: number }[],
  personal: readonly PersonalRef[] = [],
) {
  const counted = personal.filter((r): r is { id: string; repeat: number } => r.repeat != null);
  const total =
    items.reduce((s, it) => s + it.repeat, 0) + counted.reduce((s, r) => s + r.repeat, 0);
  const done =
    items.reduce((s, it) => s + Math.min(it.repeat, p.counts[it.order] ?? 0), 0) +
    counted.reduce((s, r) => s + Math.min(r.repeat, personalCount(p, r.id)), 0);
  const completedItems =
    items.filter((it) => (p.counts[it.order] ?? 0) >= it.repeat).length +
    counted.filter((r) => personalCount(p, r.id) >= r.repeat).length;
  return { total, done, ratio: total ? done / total : 0, completedItems };
}
