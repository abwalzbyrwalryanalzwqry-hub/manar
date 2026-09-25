// ============================================================
// Manar — Wird Module: تقدّم مستقل تمامًا عن عدّاد الأذكار
// تخزين محلي (offline) بمفتاح خاص بالوِرد فقط
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { WirdSessionKey } from "./data";
import { recordWird } from "@/lib/activity-log";

const KEY = "manar.wird.progress.v1";
const EVENT = "manar:wird-progress";
/**
 * إصدار ترتيب أذكار الوِرد. العدّادات مفهرسة بـ«الترتيب»، فإذا تغيّرت قائمة الأذكار
 * (كما في توحيدها مع «حصن المسلم») صار التقدّم القديم يشير إلى أذكار أخرى،
 * فيُهمل عند القراءة بدل عرضه على ذكر خاطئ.
 */
export const WIRD_LAYOUT = 2;

export interface WirdSessionProgress {
  /** ترتيب الذكر → العدد الحالي */
  counts: Record<number, number>;
  /** الذكر النشط حاليًا (ترتيبه) */
  current: number;
  /** هل تم إكمال الوِرد بالكامل */
  done: boolean;
  updatedAt: number | null;
  /** إصدار ترتيب الأذكار الذي كُتب به هذا التقدّم (انظر WIRD_LAYOUT). */
  layout?: number;
}

export type WirdStore = Record<WirdSessionKey, WirdSessionProgress>;

const emptySession = (): WirdSessionProgress => ({
  counts: {},
  current: 1,
  done: false,
  updatedAt: null,
  layout: WIRD_LAYOUT,
});

/** يقبل تقدّم الجلسة فقط إن كُتب بترتيب الأذكار الحالي. */
function readSession(raw: Partial<WirdSessionProgress> | undefined): WirdSessionProgress {
  if (!raw || raw.layout !== WIRD_LAYOUT) return emptySession();
  return { ...emptySession(), ...raw };
}

const EMPTY: WirdStore = { morning: emptySession(), evening: emptySession() };

function readStore(): WirdStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Record<WirdSessionKey, Partial<WirdSessionProgress>>>;
    return {
      morning: readSession(parsed.morning),
      evening: readSession(parsed.evening),
    };
  } catch {
    return EMPTY;
  }
}

function writeStore(store: WirdStore) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/** قراءة تقدّم الوِردين (للبطاقات في الصفحة الرئيسية للوِرد). */
export function useWirdOverview() {
  const [store, setStore] = useState<WirdStore>(EMPTY);
  useEffect(() => {
    const sync = () => setStore(readStore());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return store;
}

/**
 * جلسة وِرد واحدة — عدّاد سريع:
 * الحالة تُحدّث فورًا في الذاكرة، والكتابة إلى التخزين مُجمّعة (debounce)
 * لتجنّب أي تقطيع عند الأعداد الكبيرة مثل ١٠٠.
 */
export function useWirdSessionProgress(session: WirdSessionKey) {
  const [state, setState] = useState<WirdSessionProgress>(emptySession);
  const [hydrated, setHydrated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState(readStore()[session]);
    setHydrated(true);
  }, [session]);

  const flush = useCallback(
    (next: WirdSessionProgress) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const store = readStore();
        writeStore({ ...store, [session]: next });
      }, 180);
    },
    [session],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const commit = useCallback(
    (fn: (prev: WirdSessionProgress) => WirdSessionProgress) => {
      setState((prev) => {
        const next = { ...fn(prev), updatedAt: Date.now(), layout: WIRD_LAYOUT };
        flush(next);
        return next;
      });
    },
    [flush],
  );

  /** زيادة عدّاد ذكر بمقدار ١ (مع سقف العدد المطلوب). */
  const increment = useCallback(
    (order: number, repeat: number) =>
      commit((p) => {
        const n = Math.min(repeat, (p.counts[order] ?? 0) + 1);
        return { ...p, counts: { ...p.counts, [order]: n } };
      }),
    [commit],
  );

  const setCurrent = useCallback(
    (order: number) => commit((p) => (p.current === order ? p : { ...p, current: order })),
    [commit],
  );

  const markDone = useCallback(
    (done: boolean) => {
      /* الإكمال يُسجّل في السجل اليومي الموحّد ليُحتسب في السلسلة والإحصائيات. */
      if (done && (session === "morning" || session === "evening")) recordWird(session);
      commit((p) => ({ ...p, done }));
    },
    [commit, session],
  );

  const resetSession = useCallback(
    () => commit(() => ({ ...emptySession(), current: 1 })),
    [commit],
  );

  const resetItem = useCallback(
    (order: number) => commit((p) => ({ ...p, counts: { ...p.counts, [order]: 0 }, done: false })),
    [commit],
  );

  return { progress: state, hydrated, increment, setCurrent, markDone, resetSession, resetItem };
}

/** نسبة إنجاز الوِرد (٠..١) بالنسبة لمجموع التكرارات المطلوبة. */
export function wirdCompletion(p: WirdSessionProgress, items: { order: number; repeat: number }[]) {
  const total = items.reduce((s, it) => s + it.repeat, 0);
  const done = items.reduce((s, it) => s + Math.min(it.repeat, p.counts[it.order] ?? 0), 0);
  const completedItems = items.filter((it) => (p.counts[it.order] ?? 0) >= it.repeat).length;
  return { total, done, ratio: total ? done / total : 0, completedItems };
}
