/* مواسم منار — محرّك الحساب.
 *
 * دوال نقية تماماً: تأخذ التاريخ وإزاحة التقويم الهجري التي اختارها المستخدم،
 * وتعتمد على نظام التقويم الموجود (`@/lib/hijri`) لا على نظام موازٍ. لا شبكة،
 * لا تخزين، لا `window` — فتعمل دون اتصال وتُختبر في بيئة Node. */

import {
  addHijriMonths,
  fastingInfo,
  fromHijri,
  hijriEngine,
  hijriMonthLength,
  toHijri,
} from "@/lib/hijri";
import { SEASONS } from "./definitions";
import type {
  DayRef,
  HijriYMD,
  Season,
  SeasonInstance,
  SeasonPhase,
  SeasonReminderSlot,
  SeasonState,
} from "./types";

const MS_PER_DAY = 86_400_000;

/** منتصف النهار المحلي — يُبعد الحساب عن انتقالات التوقيت الصيفي. */
export function noon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = noon(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** عدد الأيام التقويمية من a إلى b (سالب إن كان b قبل a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((noon(b).getTime() - noon(a).getTime()) / MS_PER_DAY);
}

function ymd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function makeInstance(season: Season, start: Date, end: Date, adjust: number): SeasonInstance {
  const s = noon(start);
  const e = noon(end);
  return {
    season,
    key: `${season.id}@${ymd(s)}`,
    startDate: s,
    endDate: e,
    hijriStart: toHijri(s, adjust),
    hijriEnd: toHijri(e, adjust),
    length: daysBetween(s, e) + 1,
  };
}

function monthInstance(
  season: Season,
  year: number,
  month: number,
  startDay: number,
  endDay: number | "last",
  adjust: number,
): SeasonInstance {
  const len = hijriMonthLength(year, month, adjust);
  const last = endDay === "last" ? len : Math.min(endDay, len);
  const start = fromHijri({ year, month, day: startDay }, adjust);
  const end = fromHijri({ year, month, day: last }, adjust);
  return makeInstance(season, start, end, adjust);
}

/** أبعد مدى يُمدّ إليه البحث عن نسخة قادمة للمتكرر (رمضان كاملاً + العيد وما بعده). */
const WEEKLY_MAX_AHEAD = 60;
const MONTHLY_MAX_AHEAD = 4;

/**
 * نُسخ الموسم القريبة من التاريخ، مرتّبة زمنياً. النافذة الأساسية تكفي لإيجاد
 * السابقة والحالية والقادمة؛ فإن خلت من نسخة قادمة (مثل الاثنين والخميس طوال
 * رمضان، أو البيض بعد شهر متخطّى) تُمدّ حتى تُوجد واحدة — فلا يصير الموسم
 * «غير موجود» في منتصف رمضان.
 */
export function instancesAround(season: Season, date: Date, adjust = 0): SeasonInstance[] {
  const today = noon(date);
  /* مخزَّن: النظرة العامة تستدعيها ثلاث مرات لكل موسم، وجدولة التنبيهات مرة لكل
   * موسم في كل يوم من الأفق — وكل استدعاء يحوّل بين الهجري والميلادي مرات. الدالة
   * نقية، فالمفتاح (الموسم، اليوم، الإزاحة، محرّك الهجري) يكفي. النتيجة للقراءة. */
  const key = `${ymd(today)}|${today.getTimezoneOffset()}|${adjust}|${hijriEngine()}`;
  let perSeason = instanceCache.get(season);
  if (!perSeason) {
    perSeason = new Map();
    instanceCache.set(season, perSeason);
  }
  const hit = perSeason.get(key);
  if (hit) return hit;
  const out = computeInstancesAround(season, today, adjust);
  if (perSeason.size >= INSTANCE_CACHE_PER_SEASON) perSeason.clear();
  perSeason.set(key, out);
  return out;
}

const INSTANCE_CACHE_PER_SEASON = 400;
const instanceCache = new WeakMap<Season, Map<string, SeasonInstance[]>>();

function computeInstancesAround(season: Season, today: Date, adjust: number): SeasonInstance[] {
  const h = toHijri(today, adjust);
  const out: SeasonInstance[] = [];
  const c = season.cycle;
  const hasUpcoming = () => out.some((i) => i.startDate.getTime() > today.getTime());

  if (c.kind === "annual") {
    for (const y of [h.year - 1, h.year, h.year + 1]) {
      out.push(monthInstance(season, y, c.month, c.startDay, c.endDay, adjust));
    }
  } else if (c.kind === "monthly") {
    const pushMonth = (delta: number) => {
      const { year, month } = addHijriMonths(h.year, h.month, delta);
      if (c.skipMonths?.includes(month)) return;
      out.push(monthInstance(season, year, month, c.startDay, c.endDay, adjust));
    };
    for (let delta = -2; delta <= 2; delta++) pushMonth(delta);
    for (let delta = 3; delta <= MONTHLY_MAX_AHEAD && !hasUpcoming(); delta++) pushMonth(delta);
  } else {
    const pushDay = (delta: number) => {
      const day = addDays(today, delta);
      if (!c.weekdays.includes(day.getDay())) return;
      if (c.skipWhenFastingFixed) {
        const status = fastingInfo(day, toHijri(day, adjust)).status;
        if (status === "obligatory" || status === "forbidden") return;
      }
      out.push(makeInstance(season, day, day, adjust));
    };
    for (let delta = -8; delta <= 15; delta++) pushDay(delta);
    for (let delta = 16; delta <= WEEKLY_MAX_AHEAD && !hasUpcoming(); delta++) pushDay(delta);
  }
  return out.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/** يحوّل مرجع اليوم إلى إزاحة من أول يوم (٠ = أول يوم). */
export function refOffset(ref: DayRef, length: number): number {
  if (typeof ref === "number") return ref > 0 ? ref - 1 : ref;
  return length - 1 + ref.fromEnd;
}

/** المرحلة الفعّالة لإزاحة معيّنة — آخر مرحلة مطابقة في القائمة تفوز. */
export function phaseAt(season: Season, offset: number, length: number): SeasonPhase | null {
  let found: SeasonPhase | null = null;
  for (const p of season.phases) {
    const from = refOffset(p.from, length);
    const to = refOffset(p.to, length);
    if (offset >= from && offset <= to) found = p;
  }
  return found;
}

export function stateOf(instance: SeasonInstance, date: Date): SeasonState {
  const offset = daysBetween(instance.startDate, date);
  const len = instance.length;
  const status = offset < 0 ? "upcoming" : offset >= len ? "ended" : "current";
  return {
    instance,
    status,
    dayNumber: status === "current" ? offset + 1 : null,
    daysUntil: status === "upcoming" ? -offset : 0,
    daysLeft: status === "current" ? len - offset : 0,
    daysSinceEnd: status === "ended" ? offset - len + 1 : 0,
    phase: phaseAt(instance.season, offset, len),
    progress: status === "current" ? (offset + 1) / len : status === "ended" ? 1 : 0,
  };
}

/**
 * حالة الموسم اليوم: الجاري إن وُجد، وإلا الأقرب ضمن نافذة التمهيد/ما بعده،
 * وإلا القادم، وإلا الماضي الأخير.
 */
export function getSeasonState(season: Season, date: Date, adjust = 0): SeasonState | null {
  const list = instancesAround(season, date, adjust).map((i) => stateOf(i, date));
  const current = list.find((s) => s.status === "current");
  if (current) return current;
  const lead = season.leadDays ?? 0;
  const trail = season.trailDays ?? 0;
  const soon = list.find((s) => s.status === "upcoming" && s.daysUntil <= lead);
  if (soon) return soon;
  const recent = [...list].reverse().find((s) => s.status === "ended" && s.daysSinceEnd <= trail);
  if (recent) return recent;
  return list.find((s) => s.status === "upcoming") ?? list[list.length - 1] ?? null;
}

export function nextInstance(season: Season, date: Date, adjust = 0): SeasonInstance | null {
  const today = noon(date);
  return (
    instancesAround(season, date, adjust).find((i) => i.startDate.getTime() > today.getTime()) ??
    null
  );
}

export function lastEndedInstance(season: Season, date: Date, adjust = 0): SeasonInstance | null {
  const today = noon(date);
  const ended = instancesAround(season, date, adjust).filter(
    (i) => i.endDate.getTime() < today.getTime(),
  );
  return ended[ended.length - 1] ?? null;
}

export function findSeason(id: string, defs: Season[] = SEASONS): Season | undefined {
  return defs.find((s) => s.id === id && s.enabled);
}

export type SeasonsOverview = {
  /** المواسم الجارية اليوم، الأعلى أولوية أولاً. */
  current: SeasonState[];
  /** مواسم في مرحلة التمهيد أو ما بعد الموسم (ليست جارية). */
  around: SeasonState[];
  /** القادمة (السنوية) بعدّ تنازلي، الأقرب أولاً. */
  upcoming: SeasonState[];
  /** المتكررة (أسبوعية/شهرية) القادمة. */
  recurring: SeasonState[];
  /** السنوية التي انتهت خلال السنة الماضية، الأحدث أولاً. */
  past: SeasonState[];
  /** المعروض في الأعلى: الجاري الأعلى أولوية، أو الذي في مرحلة تمهيد، أو null. */
  featured: SeasonState | null;
  /** أقرب موسم سنوي قادم — لحالة «لا يوجد موسم خاص حالياً». */
  nearest: SeasonState | null;
};

const byPriority = (a: SeasonState, b: SeasonState) =>
  b.instance.season.priority - a.instance.season.priority;

/**
 * موسم سنوي في تمهيده يتقدّم على موسم سنوي جارٍ أقلّ أولوية حين يقترب إلى هذا
 * الحد: آخر أسبوع من شعبان يُبرز «الاستعداد لرمضان»، وقبله يبقى شعبان مميّزاً.
 */
export const FEATURE_LEAD_DAYS = 7;

export function seasonsOverview(date: Date, adjust = 0, defs: Season[] = SEASONS): SeasonsOverview {
  const enabled = defs.filter((s) => s.enabled);
  const current: SeasonState[] = [];
  const around: SeasonState[] = [];
  const upcoming: SeasonState[] = [];
  const recurring: SeasonState[] = [];
  const past: SeasonState[] = [];

  for (const season of enabled) {
    const periodic = season.cycle.kind !== "annual";
    const st = getSeasonState(season, date, adjust);
    if (st?.status === "current") current.push(st);
    else if (st && st.phase) around.push(st);

    const next = nextInstance(season, date, adjust);
    if (next) {
      const ns = stateOf(next, date);
      if (periodic) recurring.push(ns);
      else if (!(st?.status === "current" && st.instance.key === next.key)) upcoming.push(ns);
    }
    if (!periodic) {
      const last = lastEndedInstance(season, date, adjust);
      if (last) {
        const ls = stateOf(last, date);
        if (ls.daysSinceEnd <= 355) past.push(ls);
      }
    }
  }

  /* موسم شهري يبدأ مع موسم سنوي جارٍ في يومه الأول (بداية الشهر مع غرّة رمضان أو
   * المحرّم أو يوم العيد) مكرَّرٌ لا يضيف شيئاً. */
  const annualStarts = new Set(
    current
      .filter((s) => s.instance.season.cycle.kind === "annual" && s.dayNumber === 1)
      .map((s) => s.instance.startDate.getTime()),
  );
  const dropMonthly = (s: SeasonState) =>
    s.instance.season.cycle.kind === "monthly" && annualStarts.has(s.instance.startDate.getTime());
  for (let i = current.length - 1; i >= 0; i--) if (dropMonthly(current[i])) current.splice(i, 1);

  /* موسم منتهٍ في مرحلة «ما بعده» تطابق مرحلةَ موسم جارٍ (عيد الفطر في رمضان
   * وشوال معاً) يُحذف: الجاري يعرضها. */
  const currentPhases = new Set(current.map((s) => s.phase?.title).filter(Boolean));
  for (let i = around.length - 1; i >= 0; i--) {
    const a = around[i];
    if (a.status === "ended" && a.phase && currentPhases.has(a.phase.title)) around.splice(i, 1);
  }

  current.sort(byPriority);
  around.sort(byPriority);
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil || byPriority(a, b));
  recurring.sort((a, b) => a.daysUntil - b.daysUntil || byPriority(a, b));
  past.sort((a, b) => a.daysSinceEnd - b.daysSinceEnd);

  /* الموسم المميّز: الجاري السنوي أولاً (رمضان يسبق الجمعة)، ثم ما في التمهيد.
   * وتمهيد سنوي أعلى أولوية وقريب (≤ FEATURE_LEAD_DAYS) يتقدّم على الجاري. */
  const annualCurrent = current.find((s) => s.instance.season.cycle.kind === "annual");
  const leadIn = around.find((s) => s.status === "upcoming");
  const annualLeadIn = around.find(
    (s) => s.status === "upcoming" && s.instance.season.cycle.kind === "annual",
  );
  const leadWins =
    annualCurrent &&
    annualLeadIn &&
    annualLeadIn.daysUntil <= FEATURE_LEAD_DAYS &&
    annualLeadIn.instance.season.priority > annualCurrent.instance.season.priority;
  const featured =
    (leadWins ? annualLeadIn : annualCurrent) ?? leadIn ?? current[0] ?? around[0] ?? null;

  return {
    current,
    around,
    upcoming,
    recurring,
    past,
    featured,
    nearest: upcoming[0] ?? null,
  };
}

/** الأيام المهمة مع تواريخها الفعلية في نسخة معيّنة. */
export function importantDaysOf(instance: SeasonInstance, date: Date) {
  const today = noon(date);
  return instance.season.importantDays.map((d) => {
    const at = addDays(instance.startDate, refOffset(d.at, instance.length));
    const diff = daysBetween(today, at);
    return { ...d, date: at, diff, status: diff > 0 ? "upcoming" : diff === 0 ? "today" : "past" };
  });
}

/* ------------------------------ التنبيهات ------------------------------ */

export type SeasonNotifyPrefs = {
  enabled: boolean;
  seasons: Record<string, boolean>;
  morning: { hour: number; minute: number };
  evening: { hour: number; minute: number };
};

export type PlannedSeasonNotification = {
  /** مفتاح فريد لمنع التكرار. */
  key: string;
  seasonId: string;
  /** معرّف التنبيه داخل موسمه — به يُختار صوته (seasons/sounds.ts). */
  reminderId: string;
  dayIndex: number;
  slot: SeasonReminderSlot;
  at: Date;
  title: string;
  body: string;
};

export function isSeasonNotifyOn(
  season: Season,
  prefs: Pick<SeasonNotifyPrefs, "seasons">,
): boolean {
  const v = prefs.seasons[season.id];
  return typeof v === "boolean" ? v : season.notificationSettings.defaultEnabled;
}

/**
 * عدد المواسم التي تُرسِل تنبيهاتها فعلاً: مفعّلة، لها تذكيرات، ومفعّل تنبيهها
 * صراحةً أو افتراضياً. صفر إن كان المفتاح العام مطفأً.
 */
export function activeSeasonNotifyCount(
  prefs: Pick<SeasonNotifyPrefs, "enabled" | "seasons">,
  defs: Season[] = SEASONS,
): number {
  if (!prefs.enabled) return 0;
  return defs.filter((s) => s.enabled && s.reminders.length > 0 && isSeasonNotifyOn(s, prefs))
    .length;
}

/**
 * تنبيهات المواسم للأيام القادمة. تنبيه واحد كحد أقصى لكل فترة (صباح/مساء)
 * في اليوم، والأعلى أولوية يفوز — فلا يتراكم «غدًا الجمعة» مع «غدًا يوم عرفة».
 */
export function seasonNotificationsBetween(
  from: Date,
  days: number,
  adjust: number,
  prefs: SeasonNotifyPrefs,
  defs: Season[] = SEASONS,
): PlannedSeasonNotification[] {
  if (!prefs.enabled) return [];
  const active = defs.filter((s) => s.enabled && s.reminders.length && isSeasonNotifyOn(s, prefs));
  const out: PlannedSeasonNotification[] = [];

  for (let d = 0; d < days; d++) {
    const day = addDays(from, d);
    const best: Partial<Record<SeasonReminderSlot, { p: number; n: PlannedSeasonNotification }>> =
      {};
    for (const season of active) {
      for (const inst of instancesAround(season, day, adjust)) {
        const offset = daysBetween(inst.startDate, day);
        for (const r of season.reminders) {
          if (refOffset(r.at, inst.length) !== offset) continue;
          const t = r.slot === "morning" ? prefs.morning : prefs.evening;
          const at = noon(day);
          at.setHours(t.hour, t.minute, 0, 0);
          const cur = best[r.slot];
          if (cur && cur.p >= season.priority) continue;
          best[r.slot] = {
            p: season.priority,
            n: {
              key: `${inst.key}:${r.id}`,
              seasonId: season.id,
              reminderId: r.id,
              dayIndex: d,
              slot: r.slot,
              at,
              title: r.title,
              body: r.body,
            },
          };
        }
      }
    }
    if (best.morning) out.push(best.morning.n);
    if (best.evening) out.push(best.evening.n);
  }
  return out;
}

export function hijriLabel(h: HijriYMD, monthName: (m: number) => string): string {
  return `${h.day} ${monthName(h.month)} ${h.year}`;
}
