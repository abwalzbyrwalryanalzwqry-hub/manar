/* منار — السجل اليومي الموحّد.
 *
 * وحدات التقدّم الموجودة (الأذكار، الوِرد، قراءة القرآن) تحفظ حالة **اليوم فقط**
 * وتُصفَّر مع تغيّر التاريخ، فلا يمكن اشتقاق سلسلة أيام ولا معدّل أسبوعي منها.
 *
 * هذا الملف هو المصدر الوحيد للتاريخ: قيد يومي واحد لكل يوم، يُكتب إليه من كل
 * الشاشات، وتُشتقّ منه كل أرقام شاشة الإحصائيات.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PRAYER_ORDER, type PrayerKey } from "./prayer";

const KEY = "manar.activity.v1";
export const ACTIVITY_EVENT = "manar:activity";
const EVENT = ACTIVITY_EVENT;

/** الصلوات المفروضة فقط — الشروق ليس صلاة. */
export const FARD_PRAYERS: PrayerKey[] = PRAYER_ORDER.filter((p) => p !== "sunrise");

/** أقصى عدد أيام محفوظة (سنتان) — يمنع نمو التخزين بلا حدّ. */
const MAX_DAYS = 730;

export type DayRecord = {
  /** الصلوات المؤدّاة من المفروضة الخمس. */
  prayers: PrayerKey[];
  /** عدد الآيات المقروءة في هذا اليوم. */
  ayahs: number;
  /** عدد الأذكار المكتملة. */
  azkar: number;
  /** جلسات الوِرد المكتملة: صباح و/أو مساء. */
  wird: ("morning" | "evening")[];
  /** فصول «حصن المسلم» المكتملة اليوم: رقم الفصل ← وقت الإكمال (ms).
   * باب الصباح والمساء له مفتاحان «27:m» و«27:e» (والسجلات القديمة «27»).
   * اختياري حتى تبقى السجلات القديمة والمزامَنة صالحة. */
  chapters?: Record<string, number>;
};

export type ActivityLog = {
  days: Record<string, DayRecord>;
  /** أطول سلسلة بلغها المستخدم — تُحفظ لأن السلسلة الحالية قد تنقطع. */
  bestStreak: number;
};

const EMPTY_DAY: DayRecord = { prayers: [], ayahs: 0, azkar: 0, wird: [] };
const EMPTY_LOG: ActivityLog = { days: {}, bestStreak: 0 };

/* ------------------------------------------------------------------ */
/*  أدوات التاريخ — كلها بالتوقيت المحلي، لا UTC                       */
/* ------------------------------------------------------------------ */

/** `YYYY-MM-DD` بالتوقيت المحلي. `toISOString` يعطي UTC فيُزحزح اليوم. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * يوم الصلاة الشرعي: من الفجر إلى الفجر، لا من منتصف الليل.
 *
 * من يصلي العشاء بعد الساعة ١٢ ليلاً يصليها لليوم الذي مضى، فقبل فجر اليوم
 * يُنسب التسجيل إلى الأمس. بلا وقت فجر معروف نرجع إلى التاريخ الميلادي.
 */
export function prayerDayKey(now: Date = new Date(), fajr?: Date | null): string {
  const key = dayKey(now);
  if (!fajr || Number.isNaN(fajr.getTime())) return key;
  // الفجر المعطى يجب أن يكون فجر اليوم الميلادي نفسه، وإلا فلا نزحزح.
  if (dayKey(fajr) !== key) return key;
  return now.getTime() < fajr.getTime() ? shiftDayKey(key, -1) : key;
}

export function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

/* ------------------------------------------------------------------ */
/*  القراءة والكتابة                                                   */
/* ------------------------------------------------------------------ */

function normalizeDay(raw: Partial<DayRecord> | undefined): DayRecord {
  return {
    prayers: Array.isArray(raw?.prayers)
      ? (raw.prayers.filter((p) => FARD_PRAYERS.includes(p)) as PrayerKey[])
      : [],
    ayahs: Number.isFinite(raw?.ayahs) ? Math.max(0, Math.trunc(raw!.ayahs!)) : 0,
    azkar: Number.isFinite(raw?.azkar) ? Math.max(0, Math.trunc(raw!.azkar!)) : 0,
    wird: Array.isArray(raw?.wird)
      ? raw.wird.filter((w): w is "morning" | "evening" => w === "morning" || w === "evening")
      : [],
    ...normalizeChapters(raw?.chapters),
  };
}

function normalizeChapters(raw: unknown): { chapters?: Record<string, number> } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{1,3}(:[me])?$/.test(k) && typeof v === "number" && Number.isFinite(v) && v > 0)
      out[k] = v;
  }
  return Object.keys(out).length ? { chapters: out } : {};
}

export function readLog(): ActivityLog {
  if (typeof window === "undefined") return EMPTY_LOG;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_LOG;
    const parsed = JSON.parse(raw) as Partial<ActivityLog>;
    const days: Record<string, DayRecord> = {};
    for (const [k, v] of Object.entries(parsed.days ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) days[k] = normalizeDay(v);
    }
    return {
      days,
      bestStreak: Number.isFinite(parsed.bestStreak) ? Math.max(0, parsed.bestStreak!) : 0,
    };
  } catch {
    return EMPTY_LOG;
  }
}

function writeLog(log: ActivityLog) {
  if (typeof window === "undefined") return;
  try {
    // قصّ الأيام الأقدم من الحدّ حتى لا ينمو التخزين بلا نهاية.
    const keys = Object.keys(log.days).sort();
    const trimmed =
      keys.length > MAX_DAYS
        ? Object.fromEntries(keys.slice(-MAX_DAYS).map((k) => [k, log.days[k]]))
        : log.days;
    const next: ActivityLog = { ...log, days: trimmed };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* التخزين ممتلئ أو محظور — نتجاهل بصمت حتى لا تتعطّل الواجهة */
  }
}

/** يومٌ نشط إن حدث فيه أي عمل. يُستخدم لحساب السلسلة. */
export function isActiveDay(d: DayRecord | undefined): boolean {
  if (!d) return false;
  return d.prayers.length > 0 || d.ayahs > 0 || d.azkar > 0 || d.wird.length > 0;
}

/**
 * السلسلة الحالية: الأيام النشطة المتتالية المنتهية باليوم أو بالأمس.
 *
 * نقبل الانتهاء بالأمس حتى لا تظهر السلسلة مقطوعة صباح اليوم قبل أن يبدأ
 * المستخدم عمله — وهو سلوك التطبيقات المعروفة في هذا المجال.
 */
export function currentStreak(log: ActivityLog, today = dayKey()): number {
  const startsToday = isActiveDay(log.days[today]);
  let cursor = startsToday ? today : shiftDayKey(today, -1);
  if (!startsToday && !isActiveDay(log.days[cursor])) return 0;

  let n = 0;
  while (isActiveDay(log.days[cursor])) {
    n += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return n;
}

function computeBestStreak(log: ActivityLog): number {
  const keys = Object.keys(log.days)
    .filter((k) => isActiveDay(log.days[k]))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev && shiftDayKey(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  التسجيل                                                            */
/* ------------------------------------------------------------------ */

function patchDay(key: string, fn: (d: DayRecord) => DayRecord) {
  const log = readLog();
  const before = log.days[key] ?? EMPTY_DAY;
  const after = fn(before);
  // لا تغيير: لا كتابة ولا حدث (نقرات الذكر كثيرة، وكل حدث يوقظ مستمعين).
  if (after === before && log.days[key]) return;
  const days = { ...log.days, [key]: after };
  const next: ActivityLog = { ...log, days };
  next.bestStreak = Math.max(log.bestStreak, computeBestStreak(next), currentStreak(next));
  writeLog(next);
}

/** يسجّل أداء صلاة (أو يلغيه). العملية عكسية حتى يصحّح المستخدم خطأه. */
export function recordPrayer(prayer: PrayerKey, done: boolean, date = new Date()) {
  if (!FARD_PRAYERS.includes(prayer)) return;
  patchDay(dayKey(date), (d) => ({
    ...d,
    prayers: done
      ? d.prayers.includes(prayer)
        ? d.prayers
        : [...d.prayers, prayer]
      : d.prayers.filter((p) => p !== prayer),
  }));
}

/** يضيف آيات مقروءة لليوم. */
export function recordAyahs(count: number, date = new Date()) {
  if (!Number.isFinite(count) || count <= 0) return;
  patchDay(dayKey(date), (d) => ({ ...d, ayahs: d.ayahs + Math.trunc(count) }));
}

/** يضبط عدد الأذكار المكتملة اليوم (قيمة مطلقة، لا إضافة). */
export function recordAzkarCount(count: number, date = new Date()) {
  if (!Number.isFinite(count) || count < 0) return;
  const n = Math.trunc(count);
  patchDay(dayKey(date), (d) => (d.azkar === n ? d : { ...d, azkar: n }));
}

/** يسجّل إكمال جلسة وِرد (صباح/مساء). */
export function recordWird(session: "morning" | "evening", date = new Date()) {
  patchDay(dayKey(date), (d) => ({
    ...d,
    wird: d.wird.includes(session) ? d.wird : [...d.wird, session],
  }));
}

/**
 * يزامن فصول الأذكار المكتملة اليوم: الفصل المكتمل حديثاً يُسجَّل بوقت إكماله،
 * والفصل الذي أُعيد تصفيره يُحذف (فإن أُكمل ثانيةً سُجّل بالوقت الجديد).
 * تستعمله «تخطّي إذا أُنجز» في تذكيرات الأذكار.
 */
export function syncAzkarChapters(completeIds: readonly (number | string)[], at = Date.now()) {
  const date = new Date(at);
  patchDay(dayKey(date), (d) => {
    const prev = d.chapters ?? {};
    const want = new Set(completeIds.map(String));
    const next: Record<string, number> = {};
    for (const k of want) next[k] = prev[k] ?? at;
    const same =
      Object.keys(prev).length === want.size && [...want].every((k) => prev[k] !== undefined);
    if (same) return d;
    const rest: DayRecord = { ...d };
    delete rest.chapters;
    return want.size ? { ...rest, chapters: next } : rest;
  });
}

/* ------------------------------------------------------------------ */
/*  الاشتقاقات                                                         */
/* ------------------------------------------------------------------ */

export type RangeStats = {
  days: number;
  prayers: number;
  prayersPossible: number;
  ayahs: number;
  azkar: number;
  wird: number;
  activeDays: number;
  /** نسبة إنجاز الصلوات في المدى (٠..١). */
  prayerRatio: number;
};

/** إحصاء مدى من الأيام ينتهي باليوم (`length` يوماً شاملاً اليوم). */
export function rangeStats(log: ActivityLog, length: number, endKey = dayKey()): RangeStats {
  let prayers = 0;
  let ayahs = 0;
  let azkar = 0;
  let wird = 0;
  let activeDays = 0;

  for (let i = 0; i < length; i += 1) {
    const d = log.days[shiftDayKey(endKey, -i)];
    if (!d) continue;
    prayers += d.prayers.length;
    ayahs += d.ayahs;
    azkar += d.azkar;
    wird += d.wird.length;
    if (isActiveDay(d)) activeDays += 1;
  }

  const prayersPossible = length * FARD_PRAYERS.length;
  return {
    days: length,
    prayers,
    prayersPossible,
    ayahs,
    azkar,
    wird,
    activeDays,
    prayerRatio: prayersPossible ? prayers / prayersPossible : 0,
  };
}

export type DayBar = {
  key: string;
  date: Date;
  /** حرف اليوم العربي المختصر. */
  label: string;
  /** نسبة إنجاز الصلوات في ذلك اليوم (٠..١). */
  ratio: number;
  record: DayRecord;
  isToday: boolean;
};

const WEEKDAY_LETTERS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // الأحد → السبت

/** آخر `length` يوماً مرتّبة من الأقدم إلى اليوم — جاهزة للرسم البياني. */
export function dayBars(log: ActivityLog, length = 7, endKey = dayKey()): DayBar[] {
  const out: DayBar[] = [];
  for (let i = length - 1; i >= 0; i -= 1) {
    const key = shiftDayKey(endKey, -i);
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    const record = log.days[key] ?? EMPTY_DAY;
    out.push({
      key,
      date,
      label: WEEKDAY_LETTERS[date.getDay()],
      ratio: record.prayers.length / FARD_PRAYERS.length,
      record,
      isToday: i === 0,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  الإنجازات                                                          */
/* ------------------------------------------------------------------ */

export type Achievement = {
  id: string;
  title: string;
  hint: string;
  /** التقدّم الحالي والهدف — النسبة تُشتقّ منهما. */
  value: number;
  goal: number;
};

/** عدد الأيام المتتالية المنتهية باليوم التي تحقّق فيها الشرط. */
function consecutiveDays(
  log: ActivityLog,
  predicate: (d: DayRecord) => boolean,
  today = dayKey(),
): number {
  let cursor = predicate(log.days[today] ?? EMPTY_DAY) ? today : shiftDayKey(today, -1);
  let n = 0;
  while (predicate(log.days[cursor] ?? EMPTY_DAY)) {
    n += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return n;
}

function countDays(log: ActivityLog, predicate: (d: DayRecord) => boolean): number {
  return Object.values(log.days).filter(predicate).length;
}

/** إنجازات محسوبة من السجل الفعلي — لا قيم ثابتة. */
export function achievements(log: ActivityLog, today = dayKey()): Achievement[] {
  const streak = currentStreak(log, today);
  const month = rangeStats(log, 30, today);

  return [
    {
      id: "fajr-keeper",
      title: "مواظب الفجر",
      hint: "أداء الفجر ٣٠ يوماً متتالياً",
      value: consecutiveDays(log, (d) => d.prayers.includes("fajr"), today),
      goal: 30,
    },
    {
      id: "full-five",
      title: "حافظ الصلوات",
      hint: "الصلوات الخمس كاملة ٧ أيام متتالية",
      value: consecutiveDays(log, (d) => d.prayers.length === FARD_PRAYERS.length, today),
      goal: 7,
    },
    {
      id: "azkar-keeper",
      title: "حافظ الأذكار",
      hint: "أذكار يومية ٢١ يوماً متتالياً",
      value: consecutiveDays(log, (d) => d.azkar > 0, today),
      goal: 21,
    },
    {
      id: "wird-keeper",
      title: "صاحب الوِرد",
      hint: "وِرد الصباح والمساء ١٤ يوماً متتالياً",
      value: consecutiveDays(log, (d) => d.wird.length === 2, today),
      goal: 14,
    },
    {
      id: "monthly-reader",
      title: "قارئ الشهر",
      hint: "٦٠٠ آية خلال ٣٠ يوماً",
      value: month.ayahs,
      goal: 600,
    },
    {
      id: "streak-40",
      title: "أربعون يوماً",
      hint: "سلسلة ٤٠ يوماً متواصلة",
      value: streak,
      goal: 40,
    },
    {
      id: "century",
      title: "مئة يوم",
      hint: "١٠٠ يوم نشط منذ البداية",
      value: countDays(log, isActiveDay),
      goal: 100,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  الخطّاف                                                            */
/* ------------------------------------------------------------------ */

export function useActivityLog() {
  // نبدأ فارغين ليتطابق أول رسم مع الخادم، ثم نقرأ المحفوظ بعد التركيب.
  const [log, setLog] = useState<ActivityLog>(EMPTY_LOG);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setLog(readLog());
    sync();
    setHydrated(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const today = dayKey();

  return {
    log,
    hydrated,
    today: log.days[today] ?? EMPTY_DAY,
    streak: useMemo(() => currentStreak(log, today), [log, today]),
    bestStreak: Math.max(log.bestStreak, currentStreak(log, today)),
    week: useMemo(() => rangeStats(log, 7, today), [log, today]),
    prevWeek: useMemo(() => rangeStats(log, 7, shiftDayKey(today, -7)), [log, today]),
    month: useMemo(() => rangeStats(log, 30, today), [log, today]),
    bars: useMemo(() => dayBars(log, 7, today), [log, today]),
    achievements: useMemo(() => achievements(log, today), [log, today]),
    /** سجل يوم محدد (مثل يوم الصلاة الشرعي قبل الفجر). */
    dayRecord: useCallback((key: string) => log.days[key] ?? EMPTY_DAY, [log]),
    /** يقلب تسجيل صلاة في يوم `key` (الافتراضي: اليوم الميلادي). */
    togglePrayer: useCallback((p: PrayerKey, key: string = dayKey()) => {
      const [y, m, d] = key.split("-").map(Number);
      recordPrayer(p, !(readLog().days[key]?.prayers ?? []).includes(p), new Date(y, m - 1, d, 12));
    }, []),
  };
}

/* ------------------------------------------------------------------ */
/*  خريطة الأيام الشهرية                                               */
/* ------------------------------------------------------------------ */

export type HeatCell = {
  key: string;
  day: number;
  /** نسبة الصلوات المسجّلة (٠..١). */
  ratio: number;
  prayers: number;
  /** يوم لم يأتِ بعد: لا يُسجَّل فيه. */
  future: boolean;
  isToday: boolean;
};

/**
 * شهر ميلادي كامل بخلايا فارغة قبل أوله حتى يبدأ الأسبوع بالسبت كما في
 * التقويم. `null` خلية فارغة.
 */
export function monthHeatmap(
  log: ActivityLog,
  year: number,
  month: number,
  todayKey = dayKey(),
): (HeatCell | null)[] {
  const first = new Date(year, month - 1, 1, 12);
  const lead = (first.getDay() + 1) % 7; // السبت = ٠
  const length = new Date(year, month, 0).getDate();
  const out: (HeatCell | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= length; d += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const n = log.days[key]?.prayers.length ?? 0;
    out.push({
      key,
      day: d,
      ratio: n / FARD_PRAYERS.length,
      prayers: n,
      future: key > todayKey,
      isToday: key === todayKey,
    });
  }
  return out;
}

/** يضبط صلوات يوم سابق كما هي (للتسجيل المتأخر). يرفض الأيام القادمة. */
export function setDayPrayers(key: string, prayers: PrayerKey[], todayKey = dayKey()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key > todayKey) return false;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  for (const p of FARD_PRAYERS) recordPrayer(p, prayers.includes(p), date);
  return true;
}

export type MonthBar = { year: number; month: number; ratio: number; prayers: number };

/** آخر `count` شهراً ميلادياً حتى شهر `todayKey`، من الأقدم. النسبة على ما مضى من أيام الشهر فقط. */
export function monthBars(log: ActivityLog, count = 12, todayKey = dayKey()): MonthBar[] {
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const out: MonthBar[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const total = ty * 12 + (tm - 1) - i;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const len = i === 0 ? td : new Date(year, month, 0).getDate();
    let prayers = 0;
    for (let d = 1; d <= len; d += 1) {
      const k = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      prayers += log.days[k]?.prayers.length ?? 0;
    }
    out.push({ year, month, prayers, ratio: prayers / (len * FARD_PRAYERS.length) });
  }
  return out;
}
