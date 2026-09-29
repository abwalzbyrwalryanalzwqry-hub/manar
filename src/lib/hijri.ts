/* منار — محرّك التقويم الهجري.
 *
 * التحويل يعتمد على تقويم أم القرى عبر `Intl` (وهو التقويم الرسمي المعتمد في
 * السعودية والأدق للفترة ١٣٠٠–١٦٠٠هـ)، مع طبقة إزاحة يدوية ±٢ يوم.
 *
 * لماذا الإزاحة؟ بداية الشهر الهجري تُبنى على رؤية الهلال المحلية، فتختلف
 * الدول يوماً أو يومين. نفس المعالجة تعتمدها التطبيقات الاحترافية:
 * https://support.muslimpro.com/help/en/articles/how-to-adjust-islamic-hijri-calendar-date
 */

import { useEffect, useState } from "react";
import { UQ_EPOCH_DAY, UQ_FIRST_YEAR, UQ_LAST_YEAR, UQ_MONTH_BITS } from "./hijri-table";

export type HijriDate = {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
};

export const HIJRI_MONTHS = [
  "محرّم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوّال",
  "ذو القعدة",
  "ذو الحجة",
] as const;

export function hijriMonthName(month: number): string {
  return HIJRI_MONTHS[Math.min(11, Math.max(0, month - 1))];
}

/* ------------------------------------------------------------------ */
/*  إزاحة التاريخ الهجري (تعديل المستخدم)                              */
/* ------------------------------------------------------------------ */

const LS_ADJUST = "manar.hijri.adjust.v1";
const EVT_ADJUST = "manar:hijri-adjust";

export const HIJRI_ADJUST_RANGE = [-2, -1, 0, 1, 2] as const;
export type HijriAdjust = (typeof HIJRI_ADJUST_RANGE)[number];

export function getHijriAdjust(): HijriAdjust {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(LS_ADJUST));
  if (!Number.isFinite(raw)) return 0;
  const clamped = Math.max(-2, Math.min(2, Math.trunc(raw)));
  return clamped as HijriAdjust;
}

export function setHijriAdjust(value: number) {
  if (typeof window === "undefined") return;
  const clamped = Math.max(-2, Math.min(2, Math.trunc(value)));
  window.localStorage.setItem(LS_ADJUST, String(clamped));
  window.dispatchEvent(new CustomEvent(EVT_ADJUST));
}

/* ------------------------------------------------------------------ */
/*  بداية اليوم الهجري عند المغرب (المرحلة ٣٣)                          */
/* ------------------------------------------------------------------ */

const LS_AT_MAGHRIB = "manar.hijri.at-maghrib.v1";

/** اليوم الهجري يبدأ شرعاً بغروب الشمس. مطفأ افتراضياً: التقويم المدني أشيع. */
export function getHijriAtMaghrib(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_AT_MAGHRIB) === "1";
  } catch {
    return false;
  }
}

export function setHijriAtMaghrib(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(LS_AT_MAGHRIB, "1");
    else window.localStorage.removeItem(LS_AT_MAGHRIB);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVT_ADJUST));
}

/**
 * التاريخ الميلادي الذي يُحوَّل لعرض «اليوم الهجري» الآن: بعد مغرب اليوم —
 * والخيار مفعّل — هو الغد. التقويم الشهري والمناسبات تبقى بالأيام المدنية.
 */
export function hijriDisplayDate(now: Date, maghrib: Date | null | undefined, atMaghrib: boolean) {
  if (!atMaghrib || !maghrib || now.getTime() < maghrib.getTime()) return now;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
}

/* ------------------------------------------------------------------ */
/*  تأكيد دخول الشهر (مواسم منار، ٤.١)                                  */
/* ------------------------------------------------------------------ */

/* الإزاحة العامة تنقل كل الأشهر معاً، لكن بداية رمضان والعيد تختلف بين البلدان
 * في أشهر بعينها. فيحفظ المستخدم «أُعلن دخول الشهر يوم كذا» لشهر واحد، ويتقدّم
 * ذلك على الحساب في ذلك الشهر، وتتبعه الأشهر التالية حتى يعود طولها ٢٩/٣٠ إلى
 * أم القرى. المفتاح «السنة-الشهر» الهجري، والقيمة يوم UTC (أيام منذ ١٩٧٠) لأول
 * يوم فيه. */

const LS_MONTH_STARTS = "manar.hijri.month-starts.v1";
/** حدّ أعلى للتأكيدات المحفوظة: الأقدم يُحذف (يكفي لسنتين). */
const MAX_MONTH_STARTS = 24;

let monthStartCache: Map<number, number> | null = null;
let monthStartRev = 0;

/** رقم مراجعة التأكيدات — يدخل في مفاتيح التخزين المؤقت للحسابات. */
export function hijriOverridesRev(): number {
  return monthStartRev;
}

function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function readMonthStarts(): Map<number, number> {
  if (monthStartCache) return monthStartCache;
  const map = new Map<number, number>();
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(LS_MONTH_STARTS);
    monthStartRaw = raw;
    const obj = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(obj)) {
      const m = /^(\d{4})-(\d{2})$/.exec(k);
      if (!m || typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
      const [y, mo, d] = v.split("-").map(Number);
      map.set(monthIndex(Number(m[1]), Number(m[2])), Date.UTC(y, mo - 1, d) / MS_PER_DAY);
    }
  } catch {
    /* تالف ← بلا تأكيدات */
  }
  monthStartCache = map;
  return map;
}

function writeMonthStarts(map: Map<number, number>) {
  const keys = [...map.keys()].sort((a, b) => a - b);
  while (keys.length > MAX_MONTH_STARTS) map.delete(keys.shift()!);
  const obj: Record<string, string> = {};
  for (const [idx, day] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    obj[`${y}-${String(m).padStart(2, "0")}`] = new Date(day * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
  }
  monthStartCache = map;
  monthStartRev += 1;
  if (typeof window === "undefined") return;
  try {
    const raw = map.size ? JSON.stringify(obj) : null;
    if (raw) window.localStorage.setItem(LS_MONTH_STARTS, raw);
    else window.localStorage.removeItem(LS_MONTH_STARTS);
    monthStartRaw = raw;
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVT_ADJUST));
}

/** يُعاد قراءة التأكيدات إن تغيّر المحفوظ (استعادة نسخة احتياطية، نافذة أخرى). */
function reloadHijriMonthStarts() {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LS_MONTH_STARTS);
  } catch {
    /* ignore */
  }
  if (raw === monthStartRaw) return;
  monthStartRaw = raw;
  monthStartCache = null;
  monthStartRev += 1;
}

let monthStartRaw: string | null | undefined;
if (typeof window !== "undefined") {
  window.addEventListener(EVT_ADJUST, reloadHijriMonthStarts);
  window.addEventListener("storage", reloadHijriMonthStarts);
}

/** التأكيدات المحفوظة: [{year, month, start}] مرتّبة. */
export function hijriMonthStarts(): { year: number; month: number; start: Date }[] {
  return [...readMonthStarts().entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, day]) => {
      const u = new Date(day * MS_PER_DAY);
      return {
        year: Math.floor(idx / 12),
        month: (idx % 12) + 1,
        start: new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 12),
      };
    });
}

/** هل للشهر تأكيد محفوظ؟ */
export function hijriMonthConfirmed(year: number, month: number): Date | null {
  return hijriMonthStarts().find((x) => x.year === year && x.month === month)?.start ?? null;
}

export type ConfirmMonthResult = { ok: true } | { ok: false; reason: string };

/**
 * يحفظ «دخل الشهر يوم `start`». يُرفض إن جعل الشهر السابق أقصر من ٢٩ أو أطول
 * من ٣٠، أو ابتعد أكثر من يومين عن الحساب.
 */
export function confirmHijriMonthStart(
  year: number,
  month: number,
  start: Date,
  adjust: number = getHijriAdjust(),
): ConfirmMonthResult {
  const check = checkHijriMonthStart(year, month, start, adjust);
  if (!check.ok) return check;
  const map = new Map(readMonthStarts());
  map.set(monthIndex(year, month), epochDayOf(start));
  writeMonthStarts(map);
  return check;
}

/** هل يصحّ «دخل الشهر يوم `start`»؟ (بلا حفظ — لعرض الخيارات الممكنة فقط.) */
export function checkHijriMonthStart(
  year: number,
  month: number,
  start: Date,
  adjust: number = getHijriAdjust(),
): ConfirmMonthResult {
  const idx = monthIndex(year, month);
  const day = epochDayOf(start);
  const map = new Map(readMonthStarts());
  map.delete(idx);
  const computed = startOfMonth(idx, adjust, map);
  if (Math.abs(day - computed) > 2)
    return { ok: false, reason: "التاريخ بعيد عن الحساب بأكثر من يومين" };
  const prevLen = day - startOfMonth(idx - 1, adjust, map);
  if (prevLen < 29) return { ok: false, reason: "الشهر السابق لا يكون أقل من ٢٩ يومًا" };
  if (prevLen > 30) return { ok: false, reason: "الشهر السابق لا يزيد على ٣٠ يومًا" };
  return { ok: true };
}

/** يلغي تأكيد شهر فيعود للحساب. */
export function clearHijriMonthStart(year: number, month: number) {
  const map = new Map(readMonthStarts());
  if (map.delete(monthIndex(year, month))) writeMonthStarts(map);
}

/** للاختبارات فقط. */
export function __resetHijriMonthStartsForTests() {
  monthStartCache = new Map();
  monthStartRaw = undefined;
  monthStartRev += 1;
}

function epochDayOf(date: Date): number {
  return Math.floor(utcNoon(date).getTime() / MS_PER_DAY);
}

/** أول يوم (يوم UTC) لشهر وفق الحساب والإزاحة، بلا تأكيدات. */
function baseStartOfMonth(idx: number, adjust: number): number {
  const { starts, count } = decodeTable();
  const i = idx - UQ_FIRST_YEAR * 12;
  if (i >= 0 && i < count) return starts[i] - adjust;
  // خارج الجدول (١٣٠٠–١٦٠٠هـ): تقدير لا يُستعمل عملياً.
  return Math.round(UQ_EPOCH_DAY + i * 29.530588) - adjust;
}

/**
 * أول يوم لشهر مع التأكيدات: المؤكَّد كما هو، وما بعده يتبع الحساب ما دام طول
 * الشهر السابق ٢٩ أو ٣٠، وإلا يُقصر إلى الحد. التأكيد يؤثر ١٢ شهراً كحد أقصى.
 */
function startOfMonth(idx: number, adjust: number, map: Map<number, number>): number {
  if (map.has(idx)) return map.get(idx)!;
  let from = -1;
  for (const k of map.keys()) if (k < idx && k >= idx - 12 && k > from) from = k;
  if (from < 0) return baseStartOfMonth(idx, adjust);
  let s = map.get(from)!;
  for (let k = from + 1; k <= idx; k++) {
    const b = map.get(k) ?? baseStartOfMonth(k, adjust);
    s = map.has(k) ? b : Math.min(s + 30, Math.max(s + 29, b));
  }
  return s;
}

/** الهجري مع التأكيدات: الشهر الذي يقع اليوم بين بدايته وبداية تاليه. */
function hijriWithOverrides(date: Date, adjust: number, base: HijriDate): HijriDate {
  const map = readMonthStarts();
  const d = epochDayOf(date);
  let idx = monthIndex(base.year, base.month);
  for (let guard = 0; guard < 4; guard++) {
    const s = startOfMonth(idx, adjust, map);
    if (d < s) {
      idx -= 1;
      continue;
    }
    const next = startOfMonth(idx + 1, adjust, map);
    if (d >= next) {
      idx += 1;
      continue;
    }
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1, day: d - s + 1 };
  }
  return base;
}

/** يقرأ الإزاحة ويعيد الرسم عند تغييرها من أي شاشة. */
export function useHijriAdjust() {
  // نبدأ من 0 على الخادم وفي أول رسم حتى يتطابق الترطيب، ثم نقرأ المحفوظ.
  const [adjust, setAdjust] = useState<HijriAdjust>(0);
  const [atMaghrib, setAtMaghribState] = useState(false);
  /* تتغيّر مع تأكيد دخول شهر، لتدخل في اعتماديات useMemo. */
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const sync = () => {
      setAdjust(getHijriAdjust());
      setAtMaghribState(getHijriAtMaghrib());
      setRev(hijriOverridesRev());
    };
    sync();
    window.addEventListener(EVT_ADJUST, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT_ADJUST, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    adjust,
    rev,
    setAdjust: (v: number) => setHijriAdjust(v),
    atMaghrib,
    setAtMaghrib: (on: boolean) => setHijriAtMaghrib(on),
  };
}

/* ------------------------------------------------------------------ */
/*  التحويل: ميلادي → هجري                                             */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 86_400_000;

let formatter: Intl.DateTimeFormat | null = null;

function hijriFormatter(): Intl.DateTimeFormat {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return formatter;
}

/** يُثبّت التاريخ على منتصف نهاره بتوقيت UTC حتى لا تُزحزحه المناطق الزمنية. */
function utcNoon(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * يحوّل تاريخاً ميلادياً إلى هجري (أم القرى) بعد تطبيق إزاحة المستخدم.
 *
 * الإزاحة تعني «التاريخ الهجري عندي متقدّم/متأخّر بيوم»، فنطبّقها بإزاحة اليوم
 * الميلادي المُحوَّل — وهي الطريقة التي تُنتج نتيجة متّسقة مع طول الأشهر.
 */
export function toHijri(date: Date, adjust: number = 0): HijriDate {
  const base = baseHijri(date, adjust);
  return readMonthStarts().size ? hijriWithOverrides(date, adjust, base) : base;
}

/** هل يُحسب الهجري مع تأكيدات أشهر؟ (فلا يُعتمد على تنسيق `Intl` المباشر.) */
export function hasHijriOverrides(): boolean {
  return readMonthStarts().size > 0;
}

function baseHijri(date: Date, adjust: number): HijriDate {
  const target = shiftDays(utcNoon(date), adjust);
  if (hijriEngine() === "table") {
    const fromTable = tableHijri(Math.floor(target.getTime() / MS_PER_DAY));
    if (fromTable) return fromTable;
  }
  return intlHijri(target);
}

function intlHijri(target: Date): HijriDate {
  const parts = hijriFormatter().formatToParts(target);
  let year = 0;
  let month = 1;
  let day = 1;
  for (const p of parts) {
    if (p.type === "year") year = Number(p.value.replace(/[^\d-]/g, ""));
    else if (p.type === "month") month = Number(p.value.replace(/[^\d]/g, ""));
    else if (p.type === "day") day = Number(p.value.replace(/[^\d]/g, ""));
  }
  return { year, month, day };
}

/* ------------------------------------------------------------------ */
/*  الجدول الاحتياطي (المرحلة ٣٣)                                      */
/* ------------------------------------------------------------------ */

/* بعض WebView في أندرويد تُشحن ببيانات ICU مختصرة: `Intl` يقبل
 * «islamic-umalqura» ولا يرمي خطأً، لكنه يُرجع التاريخ الميلادي بصمت (السنة
 * ٢٠٢٦ بدل ١٤٤٨). فنفحص المحرّك مرة واحدة على تواريخ معروفة، ونستعمل جدول أم
 * القرى المضمَّن (`hijri-table.ts`، مولَّد من ICU نفسه) إن لم يطابق. */

let monthLengths: Uint8Array | null = null;
let monthStarts: Int32Array | null = null;

function decodeTable(): { starts: Int32Array; count: number } {
  if (!monthStarts) {
    const bin = atob(UQ_MONTH_BITS);
    const count = (UQ_LAST_YEAR - UQ_FIRST_YEAR + 1) * 12;
    monthLengths = new Uint8Array(count);
    monthStarts = new Int32Array(count + 1);
    monthStarts[0] = UQ_EPOCH_DAY;
    for (let i = 0; i < count; i++) {
      const bit = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
      monthLengths[i] = bit ? 30 : 29;
      monthStarts[i + 1] = monthStarts[i] + monthLengths[i];
    }
  }
  return { starts: monthStarts, count: monthStarts.length - 1 };
}

/** يوم UTC (أيام منذ ١٩٧٠) → هجري من الجدول، أو null خارج ١٣٠٠–١٦٠٠هـ. */
export function tableHijri(epochDay: number): HijriDate | null {
  const { starts, count } = decodeTable();
  if (epochDay < starts[0] || epochDay >= starts[count]) return null;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= epochDay) lo = mid;
    else hi = mid - 1;
  }
  return {
    year: UQ_FIRST_YEAR + Math.floor(lo / 12),
    month: (lo % 12) + 1,
    day: epochDay - starts[lo] + 1,
  };
}

/** تواريخ مرجعية: ١ محرّم ١٤٤٧ = ٢٦ يونيو ٢٠٢٥، ١ رمضان ١٤٤٧ = ١٨ فبراير ٢٠٢٦. */
const PROBES: [number, HijriDate][] = [
  [Date.UTC(2025, 5, 26, 12), { year: 1447, month: 1, day: 1 }],
  [Date.UTC(2026, 1, 18, 12), { year: 1447, month: 9, day: 1 }],
];

let engine: "intl" | "table" | null = null;

/** أيّ محرّك يحسب الهجري على هذا الجهاز. يُفحص مرة واحدة. */
export function hijriEngine(): "intl" | "table" {
  if (engine) return engine;
  try {
    const ok = PROBES.every(([t, want]) => {
      const got = intlHijri(new Date(t));
      return got.year === want.year && got.month === want.month && got.day === want.day;
    });
    engine = ok ? "intl" : "table";
  } catch {
    engine = "table";
  }
  if (engine === "table") console.warn("[manar] Intl لا يدعم أم القرى هنا — الجدول المضمَّن");
  return engine;
}

/** للاختبارات فقط: فرض محرّك (أو null لإعادة الفحص). */
export function __setHijriEngineForTests(e: "intl" | "table" | null) {
  engine = e;
  formatter = null;
}

/* ------------------------------------------------------------------ */
/*  التحويل: هجري → ميلادي                                             */
/* ------------------------------------------------------------------ */

/** فرق الأيام بين تاريخين هجريين (تقديري، يكفي للبحث). */
function hijriToOrdinal(h: HijriDate): number {
  return h.year * 354.367 + (h.month - 1) * 29.53 + h.day;
}

/**
 * يحوّل تاريخاً هجرياً إلى ميلادي. نبدأ بتقدير فلكي ثم نصحّحه بالبحث الخطّي
 * (٥ تكرارات كحد أقصى عملياً) لأن `Intl` لا يوفّر تحويلاً عكسياً مباشراً.
 */
export function fromHijri(h: HijriDate, adjust: number = 0): Date {
  /* نعمل بتواريخ محلية في منتصف النهار من البداية إلى النهاية، لأن `toHijri`
   * يقرأ اليوم المحلي. النسخة السابقة كانت تقدّر بتوقيت UTC وبكسور يوم ثم تُرجع
   * يوم UTC، فتنزاح أشهر كاملة يوماً في المناطق ذات التوقيت الموجب (كل البلاد
   * العربية) — منها شوّال وذو الحجة ١٤٤٦، أي العيدان ويوم عرفة في التقويم. */
  // ١ محرّم ١٤٤٧هـ = ٢٦ يونيو ٢٠٢٥م — نقطة ارتساء ثم تقدير بأيام كاملة.
  const anchorHijri: HijriDate = { year: 1447, month: 1, day: 1 };
  const localNoon = (days: number) => new Date(2025, 5, 26 + days, 12);
  let offset = Math.round(hijriToOrdinal(h) - hijriToOrdinal(anchorHijri));
  let guess = localNoon(offset);

  for (let i = 0; i < 60; i += 1) {
    const got = toHijri(guess, adjust);
    if (got.year === h.year && got.month === h.month && got.day === h.day) break;
    const delta = (h.year - got.year) * 354 + (h.month - got.month) * 29.53 + (h.day - got.day);
    const step = Math.abs(delta) < 1 ? Math.sign(delta) || 1 : Math.round(delta);
    offset += step;
    guess = localNoon(offset);
  }

  return guess;
}

/** عدد أيام الشهر الهجري (٢٩ أو ٣٠) وفق أم القرى بعد الإزاحة. */
export function hijriMonthLength(year: number, month: number, adjust: number = 0): number {
  const first = fromHijri({ year, month, day: 1 }, adjust);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextFirst = fromHijri({ year: nextYear, month: nextMonth, day: 1 }, adjust);
  const days = Math.round((nextFirst.getTime() - first.getTime()) / MS_PER_DAY);
  // حماية من أي انحراف غير متوقع في المحرّك.
  return days === 29 || days === 30 ? days : 30;
}

export function addHijriMonths(
  y: number,
  m: number,
  delta: number,
): { year: number; month: number } {
  const total = y * 12 + (m - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ------------------------------------------------------------------ */
/*  المناسبات الإسلامية                                                */
/* ------------------------------------------------------------------ */

export type OccasionKind = "eid" | "blessed" | "fast" | "event";

export type Occasion = {
  id: string;
  title: string;
  note?: string;
  kind: OccasionKind;
  /** يوم هجري ثابت في السنة. */
  month: number;
  day: number;
  /** عدد الأيام التي تستمرها المناسبة (١ = يوم واحد). */
  span?: number;
};

/** المناسبات الهجرية الثابتة — مرتّبة حسب السنة الهجرية. */
export const OCCASIONS: Occasion[] = [
  {
    id: "new-year",
    title: "رأس السنة الهجرية",
    note: "غرّة محرّم",
    kind: "event",
    month: 1,
    day: 1,
  },
  { id: "tasua", title: "تاسوعاء", note: "صيام مسنون", kind: "fast", month: 1, day: 9 },
  {
    id: "ashura",
    title: "عاشوراء",
    note: "صيام يُكفّر السنة الماضية",
    kind: "fast",
    month: 1,
    day: 10,
  },
  {
    id: "mawlid",
    title: "المولد النبوي",
    note: "١٢ ربيع الأول على المشهور، والتاريخ مختلف فيه",
    kind: "event",
    month: 3,
    day: 12,
  },
  {
    id: "isra",
    title: "الإسراء والمعراج",
    note: "٢٧ رجب على المشهور، والتاريخ مختلف فيه",
    kind: "event",
    month: 7,
    day: 27,
  },
  /* بلا وسم «وقت فاضل»: قواعد محتوى المواسم لا تُثبت فضيلة بلا دليل متفق عليه. */
  { id: "nisf-shaban", title: "النصف من شعبان", kind: "event", month: 8, day: 15 },
  {
    id: "ramadan",
    title: "غرّة رمضان",
    note: "بداية شهر الصيام",
    kind: "blessed",
    month: 9,
    day: 1,
  },
  { id: "badr", title: "ذكرى غزوة بدر", note: "١٧ رمضان", kind: "event", month: 9, day: 17 },
  {
    id: "last-ten",
    title: "العشر الأواخر",
    /* ليلة القدر لا تُحدَّد (قاعدة المواسم): تُتحرّى في العشر كلها. والعشر حتى
     * آخر الشهر، ٢٩ كان أو ٣٠. */
    note: "تُتحرّى فيها ليلة القدر",
    kind: "blessed",
    month: 9,
    day: 21,
    span: 10,
  },
  { id: "eid-fitr", title: "عيد الفطر", note: "غرّة شوّال", kind: "eid", month: 10, day: 1 },
  {
    id: "shawwal-six",
    title: "ست من شوّال",
    /* في شوال كله بعد يوم العيد، لا في ٢–٧ وحدها (كما في موسم شوال). */
    note: "صيام مسنون في شوال بعد يوم العيد",
    kind: "fast",
    month: 10,
    day: 2,
    span: 29,
  },
  {
    id: "hajj-ten",
    title: "العشر من ذي الحجة",
    note: "أفضل أيام العام",
    kind: "blessed",
    month: 12,
    day: 1,
    span: 9,
  },
  {
    id: "arafah",
    title: "يوم عرفة",
    note: "صيام يُكفّر سنتين لغير الحاج",
    kind: "fast",
    month: 12,
    day: 9,
  },
  { id: "eid-adha", title: "عيد الأضحى", note: "يوم النحر", kind: "eid", month: 12, day: 10 },
  {
    id: "tashreeq",
    title: "أيام التشريق",
    note: "١١–١٣ ذو الحجة",
    kind: "eid",
    month: 12,
    day: 11,
    span: 3,
  },
];

export const OCCASION_TONE: Record<OccasionKind, { dot: string; chip: string; label: string }> = {
  eid: { dot: "bg-rose-400", chip: "gradient-night", label: "عيد" },
  blessed: { dot: "bg-gold", chip: "gradient-gold", label: "وقت فاضل" },
  fast: { dot: "bg-emerald-500", chip: "gradient-primary", label: "صيام" },
  event: { dot: "bg-primary", chip: "gradient-primary", label: "مناسبة" },
};

/** مناسبات يوم هجري معيّن. */
export function occasionsForHijri(h: HijriDate): Occasion[] {
  return OCCASIONS.filter((o) => {
    if (o.month !== h.month) return false;
    const span = o.span ?? 1;
    return h.day >= o.day && h.day < o.day + span;
  });
}

/* ------------------------------------------------------------------ */
/*  الصيام                                                             */
/* ------------------------------------------------------------------ */

export type FastingInfo = {
  /** فرض (رمضان) · مسنون · منهيّ عنه · لا شيء */
  status: "obligatory" | "recommended" | "forbidden" | "none";
  reason?: string;
};

/**
 * حكم الصيام لليوم: رمضان فرض، أيام العيد والتشريق منهيّ عنها، والاثنين
 * والخميس والأيام البيض والمناسبات المسنونة صيام مستحب.
 */
export function fastingInfo(date: Date, h: HijriDate): FastingInfo {
  if (h.month === 9) return { status: "obligatory", reason: "صيام رمضان" };
  if (h.month === 10 && h.day === 1) return { status: "forbidden", reason: "عيد الفطر" };
  if (h.month === 12 && h.day >= 10 && h.day <= 13)
    return { status: "forbidden", reason: h.day === 10 ? "عيد الأضحى" : "أيام التشريق" };

  const fastOccasion = occasionsForHijri(h).find((o) => o.kind === "fast");
  if (fastOccasion) return { status: "recommended", reason: fastOccasion.title };

  if (h.day >= 13 && h.day <= 15) return { status: "recommended", reason: "الأيام البيض" };

  const weekday = date.getDay(); // 0 = الأحد
  if (weekday === 1) return { status: "recommended", reason: "صيام الاثنين" };
  if (weekday === 4) return { status: "recommended", reason: "صيام الخميس" };

  return { status: "none" };
}

/* ------------------------------------------------------------------ */
/*  المناسبات القادمة                                                  */
/* ------------------------------------------------------------------ */

export type UpcomingOccasion = Occasion & {
  date: Date;
  hijri: HijriDate;
  daysAway: number;
};

/**
 * أقرب المناسبات من اليوم. نفحص السنة الهجرية الحالية والتي تليها حتى تظهر
 * مناسبات بداية العام القادم في ديسمبر الهجري.
 */
export function upcomingOccasions(from: Date, adjust: number = 0, limit = 6): UpcomingOccasion[] {
  const todayHijri = toHijri(from, adjust);
  const startOfToday = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  const out: UpcomingOccasion[] = [];

  for (const year of [todayHijri.year, todayHijri.year + 1]) {
    for (const o of OCCASIONS) {
      const hijri: HijriDate = { year, month: o.month, day: o.day };
      const date = fromHijri(hijri, adjust);
      const daysAway = Math.round((date.getTime() - startOfToday.getTime()) / MS_PER_DAY);
      if (daysAway < 0) continue;
      out.push({ ...o, date, hijri, daysAway });
    }
  }

  return out.sort((a, b) => a.daysAway - b.daysAway).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/*  بناء شبكة الشهر                                                    */
/* ------------------------------------------------------------------ */

export type CalendarCell = {
  date: Date;
  hijri: HijriDate;
  /** ينتمي للشهر المعروض (وليس تعبئة من الشهر المجاور). */
  inMonth: boolean;
  occasions: Occasion[];
  fasting: FastingInfo;
};

/** ترتيب أيام الأسبوع في التقويم العربي: يبدأ بالسبت. */
export const WEEKDAY_LABELS = ["سبت", "أحد", "اثن", "ثلا", "أرب", "خمي", "جمع"] as const;

/** رقم العمود (٠ = السبت) ليوم من `Date#getDay()` حيث ٠ = الأحد. */
function columnIndex(date: Date): number {
  return (date.getDay() + 1) % 7;
}

function buildGrid(firstDay: Date, length: number, adjust: number): CalendarCell[] {
  const lead = columnIndex(firstDay);
  const start = shiftDays(firstDay, -lead);
  const total = Math.ceil((lead + length) / 7) * 7;

  return Array.from({ length: total }, (_, i) => {
    const raw = shiftDays(start, i);
    const date = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), 12);
    const hijri = toHijri(date, adjust);
    return {
      date,
      hijri,
      inMonth: i >= lead && i < lead + length,
      occasions: occasionsForHijri(hijri),
      fasting: fastingInfo(date, hijri),
    };
  });
}

/** شبكة شهر هجري كامل مع تعبئة الأسابيع. */
export function hijriMonthGrid(year: number, month: number, adjust: number = 0): CalendarCell[] {
  const first = fromHijri({ year, month, day: 1 }, adjust);
  return buildGrid(first, hijriMonthLength(year, month, adjust), adjust);
}

/** شبكة شهر ميلادي كامل مع تعبئة الأسابيع. */
export function gregorianMonthGrid(
  year: number,
  month: number,
  adjust: number = 0,
): CalendarCell[] {
  const first = new Date(year, month, 1, 12);
  const length = new Date(year, month + 1, 0).getDate();
  return buildGrid(first, length, adjust);
}

export const GREGORIAN_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

/** «شعبان ١٤٤٧» أو «١٥ شعبان ١٤٤٧». */
export function formatHijri(h: HijriDate, withDay = true): string {
  const head = withDay ? `${h.day} ` : "";
  return `${head}${hijriMonthName(h.month)} ${h.year}`;
}

/** مدى الشهر الهجري بالميلادي، مثل «يونيو – يوليو ٢٠٢٦». */
export function gregorianSpanLabel(cells: CalendarCell[]): string {
  const inMonth = cells.filter((c) => c.inMonth);
  if (!inMonth.length) return "";
  const first = inMonth[0].date;
  const last = inMonth[inMonth.length - 1].date;
  const fm = GREGORIAN_MONTHS[first.getMonth()];
  const lm = GREGORIAN_MONTHS[last.getMonth()];
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${fm} ${first.getFullYear()}`;
  }
  if (first.getFullYear() !== last.getFullYear()) {
    return `${fm} ${first.getFullYear()} – ${lm} ${last.getFullYear()}`;
  }
  return `${fm} – ${lm} ${last.getFullYear()}`;
}
