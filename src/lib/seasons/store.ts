/* مواسم منار — التخزين المحلي والتقدّم.
 *
 * مفتاح واحد `manar.seasons.v1` في التخزين الموجود (localStorage مع مرآة
 * Preferences الأصلية عبر بادئة `manar.`). لا قاعدة بيانات جديدة، ولا مزامنة
 * سحابية ولا تحليلات: خطة المستخدم تبقى على جهازه. */

import { useEffect, useState } from "react";
import { useLocalDay } from "@/lib/daily-content";
import { readJson, writeJson } from "@/lib/persistent-storage";
import {
  dayKey,
  shiftDayKey,
  type ActivityLog,
  type DayRecord,
  FARD_PRAYERS,
} from "@/lib/activity-log";
import type { SeasonNotifyPrefs } from "./engine";
import type { AutoTrack, GoalFrequency, SeasonAction, SeasonInstance } from "./types";

export const SEASONS_KEY = "manar.seasons.v1";
export const SEASONS_EVENT = "manar:seasons";

export type GoalState = {
  enabled: boolean;
  frequency: GoalFrequency;
  target: number;
  /** أيام أنجزها المستخدم يدوياً (YYYY-MM-DD). */
  done: string[];
};

export type SeasonsStore = {
  notify: SeasonNotifyPrefs;
  /** الخطة لكل نسخة موسم: key → actionId → الهدف. */
  plans: Record<string, Record<string, GoalState>>;
};

export const DEFAULT_NOTIFY: SeasonNotifyPrefs = {
  enabled: true,
  seasons: {},
  morning: { hour: 8, minute: 0 },
  evening: { hour: 20, minute: 30 },
};

const DEFAULT_STORE: SeasonsStore = { notify: DEFAULT_NOTIFY, plans: {} };

/** أقصى عدد نسخ مواسم محفوظة — الأقدم يُحذف حتى لا يكبر التخزين بلا حد. */
const MAX_PLANS = 40;

function clampTime(t: unknown, fb: { hour: number; minute: number }) {
  const o = (t ?? {}) as { hour?: unknown; minute?: unknown };
  const h = Number(o.hour);
  const m = Number(o.minute);
  return {
    hour: Number.isInteger(h) && h >= 0 && h <= 23 ? h : fb.hour,
    minute: Number.isInteger(m) && m >= 0 && m <= 59 ? m : fb.minute,
  };
}

export function normalizeStore(raw: unknown): SeasonsStore {
  const r = (raw ?? {}) as Partial<SeasonsStore>;
  const n = (r.notify ?? {}) as Partial<SeasonNotifyPrefs>;
  const seasons: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(n.seasons ?? {})) if (typeof v === "boolean") seasons[k] = v;
  const plans: SeasonsStore["plans"] = {};
  for (const [key, goals] of Object.entries(r.plans ?? {})) {
    if (!goals || typeof goals !== "object") continue;
    const out: Record<string, GoalState> = {};
    for (const [id, g] of Object.entries(goals as Record<string, Partial<GoalState>>)) {
      const freq: GoalFrequency =
        g?.frequency === "once" || g?.frequency === "count" ? g.frequency : "daily";
      out[id] = {
        enabled: g?.enabled !== false,
        frequency: freq,
        target: Math.max(1, Math.min(60, Math.trunc(Number(g?.target) || 1))),
        done: Array.isArray(g?.done)
          ? [...new Set(g.done.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))))]
          : [],
      };
    }
    plans[key] = out;
  }
  return {
    notify: {
      enabled: typeof n.enabled === "boolean" ? n.enabled : DEFAULT_NOTIFY.enabled,
      seasons,
      morning: clampTime(n.morning, DEFAULT_NOTIFY.morning),
      evening: clampTime(n.evening, DEFAULT_NOTIFY.evening),
    },
    plans,
  };
}

export function readSeasonsStore(): SeasonsStore {
  return normalizeStore(readJson<unknown>(SEASONS_KEY, DEFAULT_STORE));
}

export function readSeasonNotifyPrefs(): SeasonNotifyPrefs {
  return readSeasonsStore().notify;
}

export function writeSeasonsStore(next: SeasonsStore) {
  const keys = Object.keys(next.plans);
  if (keys.length > MAX_PLANS) {
    // المفتاح ينتهي بتاريخ البداية YYYY-MM-DD — نُبقي الأحدث.
    keys
      .sort((a, b) => a.split("@")[1].localeCompare(b.split("@")[1]))
      .slice(0, keys.length - MAX_PLANS)
      .forEach((k) => delete next.plans[k]);
  }
  writeJson(SEASONS_KEY, next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SEASONS_EVENT));
}

export function useSeasonsStore() {
  const [store, setStore] = useState<SeasonsStore>(DEFAULT_STORE);

  useEffect(() => {
    const sync = () => setStore(readSeasonsStore());
    sync();
    window.addEventListener(SEASONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEASONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const commit = (fn: (cur: SeasonsStore) => SeasonsStore) => {
    const next = fn(readSeasonsStore());
    setStore(next);
    writeSeasonsStore(next);
  };

  const patchNotify = (p: Partial<SeasonNotifyPrefs>) =>
    commit((cur) => ({ ...cur, notify: { ...cur.notify, ...p } }));

  const setSeasonNotify = (id: string, on: boolean) =>
    commit((cur) => ({
      ...cur,
      notify: { ...cur.notify, seasons: { ...cur.notify.seasons, [id]: on } },
    }));

  const patchGoal = (instanceKey: string, action: SeasonAction, p: Partial<GoalState>) =>
    commit((cur) => {
      const plan = { ...(cur.plans[instanceKey] ?? {}) };
      const base = plan[action.id] ?? defaultGoal(action);
      plan[action.id] = { ...base, ...p };
      return { ...cur, plans: { ...cur.plans, [instanceKey]: plan } };
    });

  const toggleDone = (instanceKey: string, action: SeasonAction, day: string) =>
    commit((cur) => {
      const plan = { ...(cur.plans[instanceKey] ?? {}) };
      const base = plan[action.id] ?? defaultGoal(action);
      const has = base.done.includes(day);
      plan[action.id] = {
        ...base,
        done: has ? base.done.filter((d) => d !== day) : [...base.done, day],
      };
      return { ...cur, plans: { ...cur.plans, [instanceKey]: plan } };
    });

  return { store, patchNotify, setSeasonNotify, patchGoal, toggleDone };
}

export function defaultGoal(action: SeasonAction): GoalState {
  return {
    enabled: true,
    frequency: action.goal?.frequency ?? "daily",
    target: action.goal?.target ?? 1,
    done: [],
  };
}

/* ------------------------------ التقدّم ------------------------------ */

export function autoDone(track: AutoTrack, rec: DayRecord | undefined): boolean {
  if (!rec) return false;
  switch (track) {
    case "prayers":
      return FARD_PRAYERS.every((p) => rec.prayers.includes(p));
    case "quran":
      return rec.ayahs > 0;
    case "azkar":
      return rec.azkar > 0;
    case "wird":
      return rec.wird.length > 0;
  }
}

export type GoalProgress = {
  /** الأيام المنجزة داخل الموسم حتى اليوم. */
  done: number;
  /** الهدف: أيام الموسم (يومي)، ١ (مرة)، أو العدد المختار. */
  target: number;
  todayDone: boolean;
  complete: boolean;
};

/**
 * تقدّم هدف داخل نسخة موسم: يجمع ما سجّله المستخدم يدوياً مع ما يُستنتج من
 * سجل النشاط الموجود (الصلوات، القرآن، الوِرد) — بلا تتبّع جديد.
 */
export function goalProgress(
  goal: GoalState,
  action: SeasonAction,
  instance: SeasonInstance,
  log: ActivityLog,
  today: Date = new Date(),
): GoalProgress {
  const startKey = dayKey(instance.startDate);
  const endKey = dayKey(instance.endDate);
  const todayKey = dayKey(today);
  const inRange = (k: string) => k >= startKey && k <= endKey;
  const days = new Set(goal.done.filter(inRange));
  const auto = action.goal?.auto;
  if (auto) {
    for (let k = startKey; k <= endKey && k <= todayKey; k = shiftDayKey(k, 1)) {
      if (autoDone(auto, log.days[k])) days.add(k);
    }
  }
  const target =
    goal.frequency === "daily" ? instance.length : goal.frequency === "once" ? 1 : goal.target;
  const done = Math.min(days.size, target);
  return { done, target, todayDone: days.has(todayKey), complete: done >= target };
}

/**
 * «الآن» على جهاز المستخدم فقط: `null` في الرسم الأول (الخادم/الترطيب) ثم
 * التاريخ المحلي بعد التركيب، ويتجدّد عند تغيّر اليوم. يمنع اختلاف الترطيب
 * حين يختلف يوم الخادم أو منطقته الزمنية عن الجهاز.
 */
export function useSeasonToday(): Date | null {
  const day = useLocalDay();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, [day]);
  return now;
}
