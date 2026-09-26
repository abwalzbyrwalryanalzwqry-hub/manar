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
  /**
   * بداية الهدوء نسبةً إلى الأذان بالدقائق: سالبٌ = قبل الأذان، صفرٌ = مع
   * الأذان، موجبٌ = بعد الأذان بعدد الدقائق الذي يختاره المستخدم.
   */
  startOffset: number;
  /**
   * @deprecated للتوافق مع النسخ السابقة فقط (قبل الأذان وحده). يُشتقّ من
   * `startOffset` عند الحفظ: `max(0, -startOffset)`.
   */
  beforeMinutes: number;
  /** دقائق بعد الأذان ينتهي عندها الهدوء (دائمًا بعد البداية). */
  afterMinutes: number;
};

/** اتجاه بداية الهدوء كما يختاره المستخدم. */
export type StartDirection = "before" | "with" | "after";

/** أقصى إزاحة للبداية قبل الأذان أو بعده. */
export const START_OFFSET_LIMIT = 60;
/** أقل مدة للهدوء بين بدايته ونهايته. */
export const MIN_QUIET_MINUTES = 5;
/** أقصى نهاية بعد الأذان. */
export const END_LIMIT = 180;

export function startDirection(offset: number): StartDirection {
  return offset < 0 ? "before" : offset > 0 ? "after" : "with";
}

/** إزاحة موقّعة من اتجاه وعدد دقائق. */
export function makeStartOffset(dir: StartDirection, minutes: number): number {
  const m = Math.min(START_OFFSET_LIMIT, Math.max(1, Math.round(Math.abs(minutes) || 1)));
  return dir === "with" ? 0 : dir === "before" ? -m : m;
}

/** النهاية الفعلية: لا تسبق البداية، ولا تقلّ مدة الهدوء عن الحد الأدنى. */
export function effectiveEnd(startOffset: number, afterMinutes: number): number {
  return Math.min(END_LIMIT, Math.max(afterMinutes, startOffset + MIN_QUIET_MINUTES, 1));
}

/** يوحّد إعداد صلاة بعد أي تعديل: يضبط الحدود ويشتقّ الحقل القديم. */
export function withTiming(
  cfg: SakinahPrayerConfig,
  patch: Partial<Pick<SakinahPrayerConfig, "startOffset" | "afterMinutes">>,
): SakinahPrayerConfig {
  const startOffset = clampMinutes(
    patch.startOffset ?? cfg.startOffset,
    0,
    -START_OFFSET_LIMIT,
    START_OFFSET_LIMIT,
  );
  const afterMinutes = effectiveEnd(
    startOffset,
    clampMinutes(patch.afterMinutes ?? cfg.afterMinutes, 30, 1, END_LIMIT),
  );
  return { ...cfg, startOffset, beforeMinutes: Math.max(0, -startOffset), afterMinutes };
}

export type SakinahPreset = "prayer" | "mosque" | "custom";

export type SakinahSettings = {
  enabled: boolean;
  preset: SakinahPreset;
  prayers: Record<SakinahPrayerKey, SakinahPrayerConfig>;
  /** أيام الأسبوع المفعّلة، ٠ = الأحد … ٦ = السبت. */
  weekdays: number[];
  /** إعداد مستقلّ لصلاة الجمعة (الخطبة أطول من الصلاة). */
  jumuahSeparate: boolean;
  /** بداية هدوء الجمعة نسبةً إلى الأذان (سالب قبل، موجب بعد). */
  jumuahStartOffset: number;
  /** @deprecated يُشتقّ من `jumuahStartOffset`. */
  jumuahBeforeMinutes: number;
  jumuahAfterMinutes: number;
  /**
   * «أصوات منار فقط»: يُكتم كل شيء في الهاتف (مكالمات، رسائل، إشعارات
   * التطبيقات، الوسائط، منبّهات التطبيقات الأخرى) ويمرّ أذان منار وإقامتها
   * وتنبيهاتها وحدها. الخيار الموصى به.
   */
  manarOnly: boolean;
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

/** دقائق البداية السريعة (قبل الأذان أو بعده) — وما سواها من المُعدِّل. */
export const START_OPTIONS = [1, 3, 5, 10, 15, 20] as const;
/** خيارات النهاية. */
export const END_OPTIONS = [10, 20, 30, 45, 60] as const;

export const DEFAULT_SAKINAH: SakinahSettings = {
  enabled: false,
  preset: "prayer",
  prayers: {
    fajr: { enabled: true, startOffset: -5, beforeMinutes: 5, afterMinutes: 30 },
    dhuhr: { enabled: true, startOffset: -5, beforeMinutes: 5, afterMinutes: 30 },
    asr: { enabled: true, startOffset: -5, beforeMinutes: 5, afterMinutes: 30 },
    maghrib: { enabled: true, startOffset: -5, beforeMinutes: 5, afterMinutes: 30 },
    isha: { enabled: true, startOffset: -5, beforeMinutes: 5, afterMinutes: 30 },
  },
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  jumuahSeparate: true,
  jumuahStartOffset: -15,
  jumuahBeforeMinutes: 15,
  jumuahAfterMinutes: 60,
  manarOnly: true,
  allowPriority: false,
  alarmsOnly: false,
  totalSilence: false,
  muteAdhanDuringSakinah: false,
  skipDates: [],
};

const PRESET_VALUES: Record<Exclude<SakinahPreset, "custom">, { start: number; after: number }> = {
  prayer: { start: -5, after: 30 },
  mosque: { start: -15, after: 45 },
};

/** يُطبّق نمطاً جاهزاً على الصلوات كلّها دون أن يلمس ما عدا التوقيت. */
export function applyPreset(s: SakinahSettings, preset: SakinahPreset): SakinahSettings {
  if (preset === "custom") return { ...s, preset };
  const v = PRESET_VALUES[preset];
  const prayers = { ...s.prayers };
  for (const p of SAKINAH_PRAYERS) {
    prayers[p] = withTiming(prayers[p], { startOffset: v.start, afterMinutes: v.after });
  }
  /* النمطان الجاهزان يُبقيان أذان منار وتنبيهاتها ويكتمان ما سواها. */
  return {
    ...s,
    preset,
    prayers,
    manarOnly: true,
    alarmsOnly: false,
    totalSilence: false,
    allowPriority: false,
  };
}

export type SakinahFilter = "manar" | "priority" | "alarms" | "none";

/** نمط المنع الذي تفهمه الطبقة الأصلية. */
export function filterMode(s: SakinahSettings): SakinahFilter {
  if (s.totalSilence) return "none";
  if (s.alarmsOnly) return "alarms";
  if (s.manarOnly) return "manar";
  return "priority";
}

/** الحقول المنطقية المقابلة لكل نمط — مصدر واحد للواجهة. */
export function filterPatch(
  mode: SakinahFilter,
): Pick<SakinahSettings, "manarOnly" | "allowPriority" | "alarmsOnly" | "totalSilence"> {
  return {
    manarOnly: mode === "manar",
    allowPriority: mode === "priority",
    alarmsOnly: mode === "alarms",
    totalSilence: mode === "none",
  };
}

export const FILTER_LABELS: Record<SakinahFilter, string> = {
  manar: "أصوات منار فقط",
  priority: "السماح بالمكالمات المهمة والمنبّهات",
  alarms: "المنبّهات فقط",
  none: "صمت كامل",
};

/** هل يمرّ صوت أذان منار في هذا النمط؟ الصمت الكامل يكتم كل شيء بلا استثناء. */
export function adhanAudible(s: SakinahSettings): boolean {
  return filterMode(s) !== "none" && !s.muteAdhanDuringSakinah;
}

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
      const offset = jumuah ? s.jumuahStartOffset : cfg.startOffset;
      const after = effectiveEnd(offset, jumuah ? s.jumuahAfterMinutes : cfg.afterMinutes);

      /* البداية قد تكون قبل الأذان أو معه أو بعده بدقائق يختارها المستخدم. */
      const start = at + offset * 60_000;
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

/** وصف البداية وحدها: «مع الأذان» أو «قبل الأذان ٥ دقائق» أو «بعد الأذان ١٠ دقائق». */
export function describeStart(offset: number, digits: (v: string | number) => string): string {
  if (offset === 0) return "مع الأذان";
  const m = Math.abs(offset);
  return `${offset < 0 ? "قبل" : "بعد"} الأذان ${digits(m)} ${minutesWord(m)}`;
}

/** وصف التوقيت بالعربية كما يُقرأ في البطاقة. */
export function describeTiming(
  cfg: Pick<SakinahPrayerConfig, "startOffset" | "afterMinutes">,
  digits: (v: string | number) => string,
) {
  const end = effectiveEnd(cfg.startOffset, cfg.afterMinutes);
  return `يبدأ ${describeStart(cfg.startOffset, digits)}، وينتهي بعد الأذان ${digits(end)} ${minutesWord(end)}`;
}

/* ---------------------------- التخزين ---------------------------- */

const LS_KEY = "manar.sakinah.v1";
/** يستمع له الجسر ليُعيد بناء الجدول فور تغيّر أي إعداد. */
export const SAKINAH_EVENT = "manar:sakinah";
const EVT = SAKINAH_EVENT;

export function normalize(raw: unknown): SakinahSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SAKINAH;
  const p = raw as Partial<SakinahSettings>;
  const prayers = { ...DEFAULT_SAKINAH.prayers };
  for (const key of SAKINAH_PRAYERS) {
    const v = p.prayers?.[key];
    if (!v) continue;
    const def = prayers[key];
    prayers[key] = withTiming(
      { ...def, enabled: typeof v.enabled === "boolean" ? v.enabled : def.enabled },
      {
        startOffset: legacyOffset(v.startOffset, v.beforeMinutes, def.startOffset),
        afterMinutes: clampMinutes(v.afterMinutes, def.afterMinutes, 1, END_LIMIT),
      },
    );
  }
  const jumuahStartOffset = clampMinutes(
    legacyOffset(p.jumuahStartOffset, p.jumuahBeforeMinutes, DEFAULT_SAKINAH.jumuahStartOffset),
    DEFAULT_SAKINAH.jumuahStartOffset,
    -START_OFFSET_LIMIT,
    START_OFFSET_LIMIT,
  );
  const jumuahAfter = effectiveEnd(
    jumuahStartOffset,
    clampMinutes(p.jumuahAfterMinutes, DEFAULT_SAKINAH.jumuahAfterMinutes, 1, END_LIMIT),
  );
  const totalSilence = p.totalSilence === true;
  const alarmsOnly = !totalSilence && p.alarmsOnly === true;
  /* الإعداد المحفوظ قبل «أصوات منار فقط»: من لم يختر نمطًا صريحًا (المنبّهات
   * أو الصمت الكامل) ينتقل إلى الخيار الموصى به، لأن «المكالمات المهمة» القديم
   * كان يكتم تنبيهات منار نفسها. */
  const manarOnly =
    typeof p.manarOnly === "boolean"
      ? p.manarOnly && !totalSilence && !alarmsOnly
      : !totalSilence && !alarmsOnly;
  return {
    ...DEFAULT_SAKINAH,
    ...p,
    prayers,
    weekdays:
      Array.isArray(p.weekdays) && p.weekdays.length
        ? p.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : DEFAULT_SAKINAH.weekdays,
    jumuahStartOffset,
    jumuahBeforeMinutes: Math.max(0, -jumuahStartOffset),
    jumuahAfterMinutes: jumuahAfter,
    manarOnly,
    totalSilence,
    alarmsOnly,
    allowPriority: !manarOnly && !totalSilence && !alarmsOnly,
    skipDates: Array.isArray(p.skipDates) ? p.skipDates.filter((v) => typeof v === "string") : [],
  };
}

/** الإزاحة الموقّعة، أو المشتقّة من «قبل الأذان» في النسخ القديمة. */
function legacyOffset(offset: unknown, before: unknown, fallback: number): number {
  if (typeof offset === "number" && Number.isFinite(offset)) return offset;
  if (typeof before === "number" && Number.isFinite(before)) return -Math.max(0, before);
  return fallback;
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
    const next = normalize({ ...readSakinah(), ...patch });
    writeSakinah(next);
    setState(next);
    return next;
  }, []);

  const updateDeep = useCallback((mut: (s: SakinahSettings) => SakinahSettings) => {
    const next = normalize(mut(readSakinah()));
    writeSakinah(next);
    setState(next);
    return next;
  }, []);

  const setPrayer = useCallback(
    (prayer: SakinahPrayerKey, patch: Partial<SakinahPrayerConfig>) =>
      updateDeep((s) => ({
        ...s,
        preset: "custom",
        prayers: {
          ...s.prayers,
          [prayer]: withTiming({ ...s.prayers[prayer], ...patch }, patch),
        },
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
  manar_only_applied: "فُعّل «أصوات منار فقط»: كُتم ما سوى أذان منار وتنبيهاتها",
  manar_audio_allowed: "مرّ صوت منار أثناء الهدوء",
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
