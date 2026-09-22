/* منار — «سكينة»: أوقات للصلاة بلا مقاطعات.
 *
 * هذا الملف يملك الإعداد وحساب فترات الهدوء، ولا يملك التنفيذ: التنفيذ في
 * الطبقة الأصلية (منبّهات دقيقة ووضع عدم الإزعاج). والفارق جوهريّ — لو حسبنا
 * أوقات ساعةٍ ثابتة وخزّناها لانحرفت الميزة كلّما تحرّكت المواقيت أو سافر
 * المستخدم. فنخزّن نسبةً إلى الصلاة (الصلاة، دقائق قبل، دقائق بعد) ونُشتقّ
 * الأوقات المطلقة من مصدر المواقيت القائم في التطبيق (`computePrayerTimes`)
 * كل مرة.
 */

import { useCallback, useEffect, useState } from "react";

import {
  computePrayerTimes,
  PRAYER_LABELS,
  type CalcMethodKey,
  type LocationState,
  type PrayerKey,
  type Settings,
} from "@/lib/prayer";

/** صلوات سكينة الخمس — الشروق ليس صلاةً فلا فترة له. */
export type SakinahPrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const SAKINAH_PRAYERS: SakinahPrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export type SakinahPrayerConfig = {
  enabled: boolean;
  /** دقائق قبل الأذان — صفرٌ يعني «مع الأذان». */
  beforeMinutes: number;
  /** دقائق بعد الأذان تستمر فيها السكينة. */
  afterMinutes: number;
};

export type SakinahPreset = "prayer" | "mosque" | "custom";

export type SakinahSettings = {
  enabled: boolean;
  preset: SakinahPreset;
  prayers: Record<SakinahPrayerKey, SakinahPrayerConfig>;
  /** أيام الأسبوع المفعّلة، ٠ = الأحد … ٦ = السبت. */
  weekdays: number[];
  /** إعداد مستقلّ لصلاة الجمعة (الخطبة أطول من الصلاة). */
  jumuahSeparate: boolean;
  jumuahBeforeMinutes: number;
  jumuahAfterMinutes: number;
  /** ما يُسمح له بالمرور أثناء الهدوء. */
  allowPriority: boolean;
  alarmsOnly: boolean;
  totalSilence: boolean;
  /** أثناء سكينة — أذان منار وإقامته. */
  muteAdhanDuringSakinah: boolean;
  /** تواريخ استُثنيت بطلب المستخدم، «استثناء اليوم». */
  skipDates: string[];
};

export const SAKINAH_PRESET_LABELS: Record<SakinahPreset, { label: string; hint: string }> = {
  prayer: { label: "🕌 وضع الصلاة", hint: "قبل ٥، وبعد ٣٠ دقيقة" },
  mosque: { label: "🤫 وضع المسجد", hint: "قبل ١٥، وبعد ٤٥ دقيقة" },
  custom: { label: "⚙️ مخصص", hint: "كما تضبطه بنفسك" },
};

/** خيارات البداية كما يراها المستخدم — لا حقول رقمية حرّة إلا «مخصص». */
export const START_OPTIONS = [0, 1, 3, 5, 10, 15] as const;
/** خيارات النهاية. */
export const END_OPTIONS = [10, 20, 30, 45, 60] as const;

export const DEFAULT_SAKINAH: SakinahSettings = {
  enabled: false,
  preset: "prayer",
  prayers: {
    fajr: { enabled: true, beforeMinutes: 5, afterMinutes: 30 },
    dhuhr: { enabled: true, beforeMinutes: 5, afterMinutes: 30 },
    asr: { enabled: true, beforeMinutes: 5, afterMinutes: 30 },
    maghrib: { enabled: true, beforeMinutes: 5, afterMinutes: 30 },
    isha: { enabled: true, beforeMinutes: 5, afterMinutes: 30 },
  },
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  jumuahSeparate: true,
  jumuahBeforeMinutes: 15,
  jumuahAfterMinutes: 60,
  allowPriority: true,
  alarmsOnly: false,
  totalSilence: false,
  muteAdhanDuringSakinah: false,
  skipDates: [],
};

const PRESET_VALUES: Record<
  Exclude<SakinahPreset, "custom">,
  { before: number; after: number; alarmsOnly: boolean }
> = {
  prayer: { before: 5, after: 30, alarmsOnly: false },
  mosque: { before: 15, after: 45, alarmsOnly: true },
};

/** يُطبّق نمطاً جاهزاً على الصلوات كلّها دون أن يلمس ما عدا التوقيت. */
export function applyPreset(s: SakinahSettings, preset: SakinahPreset): SakinahSettings {
  if (preset === "custom") return { ...s, preset };
  const v = PRESET_VALUES[preset];
  const prayers = { ...s.prayers };
  for (const p of SAKINAH_PRAYERS) {
    prayers[p] = { ...prayers[p], beforeMinutes: v.before, afterMinutes: v.after };
  }
  return {
    ...s,
    preset,
    prayers,
    alarmsOnly: v.alarmsOnly,
    totalSilence: false,
    allowPriority: !v.alarmsOnly,
  };
}

/** نمط المنع الذي تفهمه الطبقة الأصلية. */
export function filterMode(s: SakinahSettings): "priority" | "alarms" | "none" {
  if (s.totalSilence) return "none";
  if (s.alarmsOnly) return "alarms";
  return "priority";
}

export const FILTER_LABELS: Record<"priority" | "alarms" | "none", string> = {
  priority: "السماح بالمكالمات المهمة والمنبّهات",
  alarms: "المنبّهات فقط",
  none: "صمت كامل",
};

/* ----------------------------- الحساب ----------------------------- */

export type SakinahWindow = {
  id: number;
  /** ميلي ثانية مطلقة، مشتقّة من المواقيت لا مخزّنة. */
  start: number;
  end: number;
  /** مفتاح الصلاة، أو "jumuah" لصلاة الجمعة، أو مفاتيح مدموجة. */
  prayer: string;
  label: string;
};

export function dateKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/** معرّف ثابت لكل (يوم، صلاة) حتى يظلّ «تخطّي هذه الفترة» منسوباً إلى فترته. */
function windowId(date: Date, prayerIndex: number): number {
  return dayOfYear(date) * 16 + prayerIndex + 1;
}

/**
 * فترات الهدوء لسبعة أيام قادمة.
 *
 * تُدمج الفترات المتقاطعة في فترة واحدة متّصلة: لو تلاحقت المغرب والعشاء في
 * الشتاء لم يرتفع الهدوء بينهما دقيقةً واحدة ثم يعود.
 */
export function computeSakinahWindows(
  s: SakinahSettings,
  location: LocationState,
  calc: Settings,
  daysAhead = 7,
  from = new Date(),
): SakinahWindow[] {
  if (!s.enabled) return [];

  const out: SakinahWindow[] = [];
  const now = from.getTime();

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(from);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + d);

    if (!s.weekdays.includes(date.getDay())) continue;
    if (s.skipDates.includes(dateKey(date))) continue;

    const times = computePrayerTimes(location, calc, date);
    const isFriday = date.getDay() === 5;

    SAKINAH_PRAYERS.forEach((prayer, index) => {
      const cfg = s.prayers[prayer];
      if (!cfg.enabled) return;

      const at = times[prayer as PrayerKey]?.getTime();
      if (!at) return;

      const jumuah = isFriday && prayer === "dhuhr" && s.jumuahSeparate;
      const before = jumuah ? s.jumuahBeforeMinutes : cfg.beforeMinutes;
      const after = jumuah ? s.jumuahAfterMinutes : cfg.afterMinutes;

      const start = at - before * 60_000;
      const end = at + after * 60_000;
      if (end <= now) return;

      out.push({
        id: windowId(date, index),
        start,
        end,
        prayer: jumuah ? "jumuah" : prayer,
        label: jumuah ? "صلاة الجمعة" : PRAYER_LABELS[prayer as PrayerKey].ar,
      });
    });
  }

  return mergeWindows(out);
}

/** يدمج المتقاطع والمتلاصق — الهدوء المتّصل أفضل من هدوءٍ يتقطّع ثانية. */
export function mergeWindows(windows: SakinahWindow[]): SakinahWindow[] {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: SakinahWindow[] = [];

  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) {
      last.end = Math.max(last.end, w.end);
      if (!last.label.includes(w.label)) last.label = `${last.label} و${w.label}`;
      last.prayer = `${last.prayer}+${w.prayer}`;
      continue;
    }
    merged.push({ ...w });
  }
  return merged;
}

/** الفترة الجارية الآن — تُستخدم للحالة في الواجهة قبل أن تُسأل الطبقة الأصلية. */
export function currentWindow(windows: SakinahWindow[], now = Date.now()): SakinahWindow | null {
  return windows.find((w) => now >= w.start && now < w.end) ?? null;
}

export function nextWindow(windows: SakinahWindow[], now = Date.now()): SakinahWindow | null {
  return windows.find((w) => w.start > now) ?? null;
}

export function activePrayerCount(s: SakinahSettings): number {
  return SAKINAH_PRAYERS.filter((p) => s.prayers[p].enabled).length;
}

/** جمع «دقيقة» جمعًا سليمًا — لا «٥ دقيقة». */
export function minutesWord(n: number): string {
  if (n === 1) return "دقيقة";
  if (n === 2) return "دقيقتين";
  if (n >= 3 && n <= 10) return "دقائق";
  return "دقيقة";
}

/** وصف التوقيت بالعربية كما يُقرأ في البطاقة. */
export function describeTiming(cfg: SakinahPrayerConfig, digits: (v: string | number) => string) {
  const before =
    cfg.beforeMinutes === 0
      ? "يبدأ مع الأذان"
      : `يبدأ قبل الأذان ${digits(cfg.beforeMinutes)} ${minutesWord(cfg.beforeMinutes)}`;
  return `${before}، وينتهي بعده ${digits(cfg.afterMinutes)} ${minutesWord(cfg.afterMinutes)}`;
}

/* ---------------------------- التخزين ---------------------------- */

const LS_KEY = "manar.sakinah.v1";
/** يستمع له الجسر ليُعيد بناء الجدول فور تغيّر أي إعداد. */
export const SAKINAH_EVENT = "manar:sakinah";
const EVT = SAKINAH_EVENT;

function normalize(raw: unknown): SakinahSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SAKINAH;
  const p = raw as Partial<SakinahSettings>;
  const prayers = { ...DEFAULT_SAKINAH.prayers };
  for (const key of SAKINAH_PRAYERS) {
    const v = p.prayers?.[key];
    if (!v) continue;
    prayers[key] = {
      enabled: typeof v.enabled === "boolean" ? v.enabled : prayers[key].enabled,
      beforeMinutes: clampMinutes(v.beforeMinutes, prayers[key].beforeMinutes, 0, 60),
      afterMinutes: clampMinutes(v.afterMinutes, prayers[key].afterMinutes, 1, 180),
    };
  }
  return {
    ...DEFAULT_SAKINAH,
    ...p,
    prayers,
    weekdays:
      Array.isArray(p.weekdays) && p.weekdays.length
        ? p.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : DEFAULT_SAKINAH.weekdays,
    jumuahBeforeMinutes: clampMinutes(
      p.jumuahBeforeMinutes,
      DEFAULT_SAKINAH.jumuahBeforeMinutes,
      0,
      60,
    ),
    jumuahAfterMinutes: clampMinutes(
      p.jumuahAfterMinutes,
      DEFAULT_SAKINAH.jumuahAfterMinutes,
      1,
      180,
    ),
    skipDates: Array.isArray(p.skipDates) ? p.skipDates.filter((v) => typeof v === "string") : [],
  };
}

function clampMinutes(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function readSakinah(): SakinahSettings {
  if (typeof window === "undefined") return DEFAULT_SAKINAH;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SAKINAH;
    return normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_SAKINAH;
  }
}

export function writeSakinah(next: SakinahSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

/**
 * نفس نمط بقية إعدادات منار: نبدأ من الافتراضي على الخادم وأول رسم حتى يتوافق
 * الترطيب، ثم نقرأ المخزَّن بعد التركيب.
 */
export function useSakinah() {
  const [settings, setState] = useState<SakinahSettings>(DEFAULT_SAKINAH);

  useEffect(() => {
    setState(readSakinah());
    const onChange = () => setState(readSakinah());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback((patch: Partial<SakinahSettings>) => {
    const next = { ...readSakinah(), ...patch };
    writeSakinah(next);
    setState(next);
    return next;
  }, []);

  const updateDeep = useCallback((mut: (s: SakinahSettings) => SakinahSettings) => {
    const next = mut(readSakinah());
    writeSakinah(next);
    setState(next);
    return next;
  }, []);

  const setPrayer = useCallback(
    (prayer: SakinahPrayerKey, patch: Partial<SakinahPrayerConfig>) =>
      updateDeep((s) => ({
        ...s,
        preset: "custom",
        prayers: { ...s.prayers, [prayer]: { ...s.prayers[prayer], ...patch } },
      })),
    [updateDeep],
  );

  return { settings, update, updateDeep, setPrayer };
}

/* ------------------------ ترجمة السجل ------------------------ */

const LOG_LABELS: Record<string, string> = {
  schedule_created: "تم إعداد جدول السكينة",
  schedule_updated: "تم تحديث جدول السكينة",
  quiet_started: "بدأت فترة الهدوء",
  quiet_ended: "انتهت فترة الهدوء",
  quiet_skipped: "تم تخطي الفترة",
  quiet_stopped_by_user: "أوقفها المستخدم",
  quiet_failed: "تعذّر تفعيل الهدوء",
  permission_missing: "إذن مفقود — لم يُسمح لمنار بالتحكم في عدم الإزعاج",
  permission_restored: "عاد الإذن",
  device_restarted: "أُعيد تشغيل الجهاز وأُعيد ضبط الفترات",
  timezone_changed: "تغيّر الوقت أو المنطقة الزمنية وأُعيد الحساب",
  prayer_time_updated: "تحدّثت مواقيت الصلاة وأُعيد الجدول",
  state_restored: "أُعيدت حالة الهاتف كما كانت",
  adhan_muted_by_sakinah: "كُتم الأذان لأن السكينة كانت فعّالة",
};

/** حالة الصلاة كما تُعرض في «سجل سكينة» — لا لغة تقنية. */
export type SakinahLogLine = {
  at: number;
  prayer: string;
  text: string;
  tone: "ok" | "warn" | "muted";
};

export function describeLogEvent(ev: {
  at: number;
  type: string;
  prayer: string;
  detail: string;
}): SakinahLogLine {
  const text = LOG_LABELS[ev.type] ?? "حدث في سكينة";
  const tone: SakinahLogLine["tone"] =
    ev.type === "quiet_failed" || ev.type === "permission_missing"
      ? "warn"
      : ev.type === "quiet_started" || ev.type === "quiet_ended"
        ? "ok"
        : "muted";
  const prayer =
    ev.prayer && ev.prayer in PRAYER_LABELS
      ? PRAYER_LABELS[ev.prayer as PrayerKey].ar
      : ev.prayer === "jumuah"
        ? "الجمعة"
        : "";
  return { at: ev.at, prayer, text, tone };
}

/** النوع مُعاد تصديره حتى لا تستورد الشاشات من ملف المواقيت مباشرةً. */
export type { CalcMethodKey };
