/* مواسم منار — ملخص الموسم وسجلّه (٤.٢، ٤.٣).
 *
 * الملخص يُحسب من الخطة وسجل النشاط لأيام نسخة الموسم. والسجل يحفظ ملخصاً
 * مضغوطاً لكل نسخة سنوية في مفتاح مستقل عن الخطط، فلا يُحذف بحدّ الخطط
 * (`MAX_PLANS`) ويُقارن به العام التالي. */

import { useEffect, useState } from "react";
import { dayKey, FARD_PRAYERS, type ActivityLog } from "@/lib/activity-log";
import { toArabicDigits } from "@/lib/format";
import { readJson, writeJson } from "@/lib/persistent-storage";
import { addDays } from "./engine";
import { dayUnit } from "./labels";
import { goalProgress, type GoalState } from "./store";
import type { SeasonInstance } from "./types";

export const SEASON_HISTORY_KEY = "manar.seasons.history.v1";
export const SEASON_HISTORY_EVENT = "manar:seasons-history";
/** نسخ سنوية محفوظة كحد أقصى (١٢ موسماً × ١٠ سنوات تقريباً). */
const MAX_HISTORY = 120;

export type SummaryGoal = {
  id: string;
  title: string;
  done: number;
  target: number;
  complete: boolean;
  once: boolean;
};

export type SeasonTotals = {
  /** الصلوات المفروضة المؤدّاة. */
  prayers: number;
  ayahs: number;
  azkar: number;
  /** أيام فيها أي نشاط مسجَّل. */
  activeDays: number;
};

export type SeasonSummary = {
  key: string;
  seasonId: string;
  title: string;
  hijriYear: number;
  /** الأيام المحسوبة (حتى اليوم إن كان الموسم جارياً). */
  days: number;
  length: number;
  goals: SummaryGoal[];
  totals: SeasonTotals;
};

/** ملخص نسخة موسم حتى `today` (أو حتى آخره إن انتهى). */
export function seasonSummary(
  instance: SeasonInstance,
  plan: Record<string, GoalState> | undefined,
  log: ActivityLog,
  today: Date,
  adjust = 0,
): SeasonSummary {
  const season = instance.season;
  const goals: SummaryGoal[] = [];
  for (const a of season.recommendedActions) {
    const g = plan?.[a.id];
    if (!a.goal || !g?.enabled) continue;
    const p = goalProgress(g, a, instance, log, today, adjust);
    goals.push({
      id: a.id,
      title: a.title,
      done: p.done,
      target: p.target,
      complete: p.complete,
      once: g.frequency === "once",
    });
  }
  const totals: SeasonTotals = { prayers: 0, ayahs: 0, azkar: 0, activeDays: 0 };
  const todayKey = dayKey(today);
  let days = 0;
  for (let i = 0; i < instance.length; i++) {
    const k = dayKey(addDays(instance.startDate, i));
    if (k > todayKey) break;
    days += 1;
    const rec = log.days[k];
    if (!rec) continue;
    const prayers = FARD_PRAYERS.filter((p) => rec.prayers.includes(p)).length;
    totals.prayers += prayers;
    totals.ayahs += rec.ayahs;
    totals.azkar += rec.azkar;
    if (prayers || rec.ayahs || rec.azkar || rec.wird.length) totals.activeDays += 1;
  }
  return {
    key: instance.key,
    seasonId: season.id,
    title: season.shortTitle,
    hijriYear: instance.hijriStart.year,
    days,
    length: instance.length,
    goals,
    totals,
  };
}

/** هل في الملخص ما يُعرض؟ */
export function summaryHasContent(s: SeasonSummary): boolean {
  return s.goals.length > 0 || s.totals.activeDays > 0;
}

/** نص المشاركة: «حصيلتي في رمضان ١٤٤٧». */
export function summaryShareText(s: SeasonSummary): string {
  const lines = [`حصيلتي في ${s.title} ${toArabicDigits(s.hijriYear)}هـ`];
  for (const g of s.goals)
    lines.push(
      g.once
        ? `• ${g.title}: ${g.complete ? "تمّ" : "لم يتمّ"}`
        : `• ${g.title}: ${toArabicDigits(g.done)} / ${toArabicDigits(g.target)} ${dayUnit(g.target)}`,
    );
  if (s.totals.prayers) lines.push(`• الصلوات المسجّلة: ${toArabicDigits(s.totals.prayers)}`);
  if (s.totals.ayahs) lines.push(`• الآيات المقروءة: ${toArabicDigits(s.totals.ayahs)}`);
  lines.push("", "تقبّل الله منا ومنكم.", "— منار");
  return lines.join("\n");
}

/* ------------------------------ السجل ------------------------------ */

export type SeasonHistory = Record<string, SeasonSummary>;

export function normalizeHistory(raw: unknown): SeasonHistory {
  const out: SeasonHistory = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, Partial<SeasonSummary>>)) {
    if (!v || typeof v !== "object" || typeof v.seasonId !== "string") continue;
    if (!Number.isInteger(v.hijriYear) || !Array.isArray(v.goals)) continue;
    const t = (v.totals ?? {}) as Partial<SeasonTotals>;
    const n = (x: unknown) => (Number.isFinite(Number(x)) ? Math.max(0, Math.trunc(Number(x))) : 0);
    out[k] = {
      key: k,
      seasonId: v.seasonId,
      title: String(v.title ?? ""),
      hijriYear: v.hijriYear!,
      days: n(v.days),
      length: n(v.length),
      goals: v.goals
        .filter((g) => g && typeof g.id === "string")
        .map((g) => ({
          id: g.id,
          title: String(g.title ?? ""),
          done: n(g.done),
          target: n(g.target),
          complete: g.complete === true,
          once: g.once === true,
        })),
      totals: {
        prayers: n(t.prayers),
        ayahs: n(t.ayahs),
        azkar: n(t.azkar),
        activeDays: n(t.activeDays),
      },
    };
  }
  return out;
}

export function readSeasonHistory(): SeasonHistory {
  return normalizeHistory(readJson<unknown>(SEASON_HISTORY_KEY, {}));
}

/** يضيف/يحدّث ملخص نسخة في السجل (بلا كتابة إن لم يتغيّر). يعيد السجل الجديد. */
export function withSummary(history: SeasonHistory, s: SeasonSummary): SeasonHistory {
  if (JSON.stringify(history[s.key]) === JSON.stringify(s)) return history;
  const next = { ...history, [s.key]: s };
  const keys = Object.keys(next);
  if (keys.length > MAX_HISTORY)
    keys
      .sort((a, b) => a.split("@")[1].localeCompare(b.split("@")[1]))
      .slice(0, keys.length - MAX_HISTORY)
      .forEach((k) => delete next[k]);
  return next;
}

export function recordSeasonSummary(s: SeasonSummary) {
  if (!summaryHasContent(s)) return;
  const cur = readSeasonHistory();
  const next = withSummary(cur, s);
  if (next === cur) return;
  writeJson(SEASON_HISTORY_KEY, next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SEASON_HISTORY_EVENT));
}

/** النسخة السابقة من الموسم نفسه في السجل (رمضان الماضي). */
export function previousSummary(history: SeasonHistory, s: SeasonSummary): SeasonSummary | null {
  const prev = Object.values(history)
    .filter((h) => h.seasonId === s.seasonId && h.hijriYear < s.hijriYear)
    .sort((a, b) => b.hijriYear - a.hijriYear);
  return prev[0] ?? null;
}

export function useSeasonHistory(): SeasonHistory {
  const [h, setH] = useState<SeasonHistory>({});
  useEffect(() => {
    const sync = () => setH(readSeasonHistory());
    sync();
    window.addEventListener(SEASON_HISTORY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEASON_HISTORY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return h;
}
