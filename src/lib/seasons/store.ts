/* مواسم منار — التخزين المحلي والتقدّم.
 *
 * مفتاح واحد `manar.seasons.v1` في التخزين الموجود (localStorage مع مرآة
 * Preferences الأصلية عبر بادئة `manar.`). لا قاعدة بيانات جديدة، ولا مزامنة
 * سحابية ولا تحليلات: خطة المستخدم تبقى على جهازه. */

import { useEffect, useState } from "react";
import { useLocalDay } from "@/lib/daily-content";
import { readJson, writeJson } from "@/lib/persistent-storage";
import { dayKey, type ActivityLog, type DayRecord, FARD_PRAYERS } from "@/lib/activity-log";
import { fastingInfo, toHijri } from "@/lib/hijri";
import { addDays, daysBetween, noon, refOffset, type SeasonNotifyPrefs } from "./engine";
import type { AutoTrack, GoalFrequency, SeasonAction, SeasonInstance } from "./types";

export const SEASONS_KEY = "manar.seasons.v1";
/**
 * تغيّر يمسّ التنبيهات (التفضيلات، أو استعادة نسخة احتياطية): يُعيد جدولة
 * إشعارات الجهاز. يستمع له `adhan-provider`.
 */
export const SEASONS_EVENT = "manar:seasons";
/**
 * تغيّر في الخطة وحدها (إنجاز، هدف، عدد): تتحدّث الواجهة فقط، بلا إعادة جدولة
 * — إعادة الجدولة تلغي الإشعارات ثم تضبطها، فلا تُطلق مع كل نقرة.
 */
export const SEASONS_PLAN_EVENT = "manar:seasons-plan";

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

/** أيّ حدث يُطلقه تغيير المخزن: التنبيهات إن تغيّرت تفضيلاتها، وإلا الخطة. */
export function seasonsChangeEvent(prev: SeasonsStore, next: SeasonsStore): string {
  const a = normalizeStore(prev).notify;
  const b = normalizeStore(next).notify;
  return JSON.stringify(a) === JSON.stringify(b) ? SEASONS_PLAN_EVENT : SEASONS_EVENT;
}

export function writeSeasonsStore(next: SeasonsStore) {
  const prev = readSeasonsStore();
  const keys = Object.keys(next.plans);
  if (keys.length > MAX_PLANS) {
    // المفتاح ينتهي بتاريخ البداية YYYY-MM-DD — نُبقي الأحدث.
    keys
      .sort((a, b) => a.split("@")[1].localeCompare(b.split("@")[1]))
      .slice(0, keys.length - MAX_PLANS)
      .forEach((k) => delete next.plans[k]);
  }
  writeJson(SEASONS_KEY, next);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(seasonsChangeEvent(prev, next)));
}

export function useSeasonsStore() {
  const [store, setStore] = useState<SeasonsStore>(DEFAULT_STORE);

  useEffect(() => {
    const sync = () => setStore(readSeasonsStore());
    sync();
    window.addEventListener(SEASONS_EVENT, sync);
    window.addEventListener(SEASONS_PLAN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEASONS_EVENT, sync);
      window.removeEventListener(SEASONS_PLAN_EVENT, sync);
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

/**
 * أيام احتساب الهدف (YYYY-MM-DD) داخل نسخة موسم، مرتّبة: اتحاد مراحل الاحتساب
 * (`goal.trackPhases`، وإلا `phases`)، وإلا أيام الموسم كلها. قد تسبق بداية
 * الموسم (مرحلة التمهيد: قضاء ما فات قبل رمضان) أو تليها (يوم العيد لزكاة الفطر).
 */
export function goalDayKeys(action: SeasonAction, instance: SeasonInstance): string[] {
  return phaseOffsets(instance, action.goal?.trackPhases ?? action.phases).map((o) =>
    dayKey(addDays(instance.startDate, o)),
  );
}

/** إزاحات أيام مراحل معيّنة من أول يوم في الموسم، مرتّبة؛ وبلا مراحل: الموسم كله. */
function phaseOffsets(instance: SeasonInstance, ids: string[] | undefined): number[] {
  const len = instance.length;
  const offsets = new Set<number>();
  for (const id of ids ?? []) {
    const p = instance.season.phases.find((x) => x.id === id);
    if (!p) continue;
    const from = refOffset(p.from, len);
    const to = refOffset(p.to, len);
    for (let o = from; o <= to; o++) offsets.add(o);
  }
  if (!offsets.size) for (let o = 0; o < len; o++) offsets.add(o);
  return [...offsets].sort((a, b) => a - b);
}

/**
 * موضع العمل من الخطة الآن:
 * - `now`: يظهر في المرحلة الجارية (أو طوال الموسم) — يُعرض للإضافة.
 * - `later`: مراحله لم تأتِ بعد — «أهداف قادمة».
 * - `past`: مضت مراحله — لا يُقترح.
 */
export type GoalTiming = "now" | "later" | "past";

export function goalTiming(
  action: SeasonAction,
  instance: SeasonInstance,
  phaseId: string | null | undefined,
  today: Date,
): GoalTiming {
  if (!action.phases?.length) return "now";
  if (phaseId && action.phases.includes(phaseId)) return "now";
  const offsets = phaseOffsets(instance, action.phases);
  const t = daysBetween(instance.startDate, today);
  if (offsets[0] > t) return "later";
  if (offsets[offsets.length - 1] < t) return "past";
  return "now";
}

/**
 * عنوان أول مرحلة قادمة للعمل — «العشر الأواخر». `show`: مراحل ظهوره (للأهداف
 * القادمة)، `track`: مراحل احتسابه (متى يُسجَّل: «يوم عرفة»).
 */
export function nextPhaseTitle(
  action: SeasonAction,
  instance: SeasonInstance,
  today: Date,
  which: "show" | "track" = "show",
): string | null {
  const t = daysBetween(instance.startDate, today);
  const len = instance.length;
  const ids = which === "track" ? (action.goal?.trackPhases ?? action.phases) : action.phases;
  const upcoming = (ids ?? [])
    .map((id) => instance.season.phases.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && refOffset(p.from, len) > t)
    .sort((a, b) => refOffset(a.from, len) - refOffset(b.from, len));
  return upcoming[0]?.title ?? null;
}

export type GoalProgress = {
  /** الأيام المنجزة داخل أيام الاحتساب حتى اليوم. */
  done: number;
  /** الهدف: أيام الاحتساب (يومي)، ١ (مرة)، أو العدد المختار (بحدّ أيام الاحتساب). */
  target: number;
  todayDone: boolean;
  complete: boolean;
  /** اليوم من أيام الاحتساب — يُسمح بتسجيل الإنجاز. */
  canMark: boolean;
  /** عدد أيام الاحتساب — الحد الأعلى لهدف «عدد أيام». */
  windowDays: number;
  /** إنجاز اليوم مستنتَج من سجل النشاط (لا يُلغى بالنقر). */
  todayAuto: boolean;
  /** سبب منع التسجيل اليوم (صيام في يوم منهيّ عنه)، وإلا null. */
  blocked: string | null;
};

/**
 * تقدّم هدف داخل نسخة موسم: يجمع ما سجّله المستخدم يدوياً مع ما يُستنتج من
 * سجل النشاط الموجود (الصلوات، القرآن، الوِرد) — بلا تتبّع جديد. لا يُحتسب إلا
 * ما وقع في أيام احتساب الهدف (`goalDayKeys`).
 */
export function goalProgress(
  goal: GoalState,
  action: SeasonAction,
  instance: SeasonInstance,
  log: ActivityLog,
  today: Date = new Date(),
  adjust = 0,
): GoalProgress {
  const keys = goalDayKeys(action, instance);
  const window = new Set(keys);
  const todayKey = dayKey(today);
  const days = new Set(goal.done.filter((k) => window.has(k)));
  const auto = action.goal?.auto;
  let todayAuto = false;
  if (auto) {
    for (const k of keys) {
      if (k > todayKey) break;
      if (autoDone(auto, log.days[k])) {
        days.add(k);
        if (k === todayKey) todayAuto = true;
      }
    }
  }
  const inWindow = window.has(todayKey);
  const blocked = inWindow ? fastingBlocked(action, today, adjust) : null;
  const target =
    goal.frequency === "daily"
      ? keys.length
      : goal.frequency === "once"
        ? 1
        : Math.min(goal.target, keys.length);
  const done = Math.min(days.size, target);
  return {
    done,
    target,
    todayDone: days.has(todayKey),
    complete: done >= target,
    canMark: inWindow && !todayAuto && !blocked,
    windowDays: keys.length,
    todayAuto,
    blocked,
  };
}

/** صيام في يوم يُنهى عن صومه (العيدان وأيام التشريق): سبب المنع، وإلا null. */
export function fastingBlocked(action: SeasonAction, date: Date, adjust = 0): string | null {
  if (!action.goal?.fasting) return null;
  const d = noon(date);
  const info = fastingInfo(d, toHijri(d, adjust));
  return info.status === "forbidden" ? `لا يُصام ${info.reason ?? "هذا اليوم"}` : null;
}

/** هل اليوم من أيام احتساب الهدف؟ (لعرض الخطة في مرحلة ما بعد الموسم كيوم العيد.) */
export function isGoalDay(action: SeasonAction, instance: SeasonInstance, today: Date): boolean {
  return goalDayKeys(action, instance).includes(dayKey(today));
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
