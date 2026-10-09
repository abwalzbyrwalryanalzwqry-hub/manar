// ============================================================
// منار — المسبحة: التخزين الدائم والخطاف
// ------------------------------------------------------------
// المفتاح `manar.tasbih.v1` (localStorage، ويُطابَق إلى SharedPreferences على
// أندرويد، ويدخل النسخة الاحتياطية). العدّ يُطبَّق على مرجع في الذاكرة فورًا
// (لا تضيع نقرة مهما تسارع النقر)، والكتابة إلى التخزين مؤجّلة قليلًا وتُفرَّغ
// عند مغادرة الشاشة أو إخفاء التطبيق، وفورًا في العمليات المهمة (بدء/إنهاء/تصفير).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useOnLeave } from "@/hooks/use-day-key";
import {
  clearHistory,
  deleteSession,
  emptyTasbihStore,
  endSession,
  normalizeTasbihStore,
  resetCount,
  resumeSession,
  setTarget,
  startSession,
  tap,
  undo,
  type StartInput,
  type TasbihStore,
} from "./session";

export const TASBIH_KEY = "manar.tasbih.v1";
export const TASBIH_EVENT = "manar:tasbih";
const WRITE_DELAY_MS = 250;

export function readTasbihStore(): TasbihStore {
  if (typeof window === "undefined") return emptyTasbihStore();
  try {
    const raw = window.localStorage.getItem(TASBIH_KEY);
    return raw ? normalizeTasbihStore(JSON.parse(raw)) : emptyTasbihStore();
  } catch {
    return emptyTasbihStore();
  }
}

/** كتابة مباشرة (للاستعادة/الاختبارات). تعيد `false` إن فشل التخزين. */
export function writeTasbihStore(store: TasbihStore, notify = true): boolean {
  try {
    window.localStorage.setItem(TASBIH_KEY, JSON.stringify(store));
    if (notify) window.dispatchEvent(new Event(TASBIH_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function useTasbih() {
  const [store, setStore] = useState<TasbihStore>(emptyTasbihStore);
  const [hydrated, setHydrated] = useState(false);
  const ref = useRef<TasbihStore>(store);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      setSaveFailed(!writeTasbihStore(ref.current, false));
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      /* لا نستبدل عدًّا لم يُكتب بعد بنسخة أقدم من التخزين. */
      if (timer.current) return;
      const s = readTasbihStore();
      ref.current = s;
      setStore(s);
    };
    sync();
    setHydrated(true);
    window.addEventListener(TASBIH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TASBIH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useOnLeave(flush);
  useEffect(() => flush, [flush]);

  const apply = useCallback((next: TasbihStore, immediate: boolean) => {
    if (next === ref.current) return;
    ref.current = next;
    setStore(next);
    if (immediate) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setSaveFailed(!writeTasbihStore(next, false));
    } else if (!timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        setSaveFailed(!writeTasbihStore(ref.current, false));
      }, WRITE_DELAY_MS);
    }
  }, []);

  /** نقرة عدّ؛ تعيد هل بلغ الهدف بهذه النقرة. */
  const increment = useCallback(() => {
    const r = tap(ref.current);
    apply(r.store, false);
    return r.reachedNow;
  }, [apply]);

  return {
    store,
    hydrated,
    saveFailed,
    increment,
    undo: useCallback(() => apply(undo(ref.current), false), [apply]),
    reset: useCallback(() => apply(resetCount(ref.current), true), [apply]),
    end: useCallback(() => apply(endSession(ref.current), true), [apply]),
    start: useCallback(
      (input: StartInput) => apply(startSession(ref.current, input), true),
      [apply],
    ),
    resume: useCallback((id: string) => apply(resumeSession(ref.current, id), true), [apply]),
    remove: useCallback((id: string) => apply(deleteSession(ref.current, id), true), [apply]),
    clearHistory: useCallback(() => apply(clearHistory(ref.current), true), [apply]),
    setTarget: useCallback((t: number | null) => apply(setTarget(ref.current, t), true), [apply]),
  };
}
