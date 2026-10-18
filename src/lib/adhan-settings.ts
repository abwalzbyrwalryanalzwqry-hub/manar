/* Manar — Adhan / Iqama / Notification settings store
 * Persisted to localStorage and reactive via a tiny event-based hook.
 */

import { useEffect, useState } from "react";
import { PRAYER_ORDER, type PrayerKey } from "./prayer";
import {
  ADHAN_STYLE_LABELS,
  ADHAN_STYLES,
  RECITERS,
  RECITER_INFO,
  makeAdhanVariant,
  type AdhanStyle,
  type AdhanVariant,
  type IqamaVariant,
  type Reciter,
} from "./adhan-sound";
import { migrateAdhanVariant } from "./adhan-sound";
import { ADHAN_ASSETS, LEGACY_VARIANT_MIGRATION, assetDurationLabel } from "./adhan-library-assets";
import {
  DEFAULT_IQAMAH,
  IQAMAH_SOUNDS,
  iqamahDurationLabel,
  migrateIqamahId,
  type IqamahGroup,
} from "./iqamah-library";
import {
  DEFAULT_PRAYER_APPROACH_SOUND,
  normalizeApproachSound,
  type PrayerApproachSoundId,
} from "./prayer-approach-audio";

/* ----------------------------- Catalogs ----------------------------- */

export type AdhanLibraryEntry = {
  id: AdhanVariant;
  reciter: Reciter | null;
  style: AdhanStyle;
  name: string;
  styleName: string;
  origin: string;
  reciterName: string;
  tone: string;
  duration: string;
  /** true = a real supplied recording exists for this entry. */
  available: boolean;
  rightsStatus?: "VERIFIED";
};

/** Supplied recordings (MANAR_AUDIO_PACKAGE) mapped into the existing entry shape. */
const SUPPLIED_ENTRIES: AdhanLibraryEntry[] = ADHAN_ASSETS.filter(
  (a) => a.style !== null && (a.slot === "adhan" || a.slot === "fajr_second"),
).map<AdhanLibraryEntry>((a) => ({
  id: a.id,
  reciter: null,
  style: a.style as AdhanStyle,
  name: a.name,
  styleName: a.role,
  origin: a.region,
  reciterName: a.role,
  tone: a.format.toUpperCase(),
  duration: assetDurationLabel(a),
  available: true,
  rightsStatus: "VERIFIED",
}));

/** Pre-existing catalog entries — preserved with their original ids. */
const LEGACY_ENTRIES: AdhanLibraryEntry[] = RECITERS.flatMap((r) =>
  ADHAN_STYLES.map<AdhanLibraryEntry>((s) => ({
    id: makeAdhanVariant(r, s),
    reciter: r,
    style: s,
    name: RECITER_INFO[r].name,
    styleName: ADHAN_STYLE_LABELS[s].name,
    origin: RECITER_INFO[r].origin,
    reciterName: RECITER_INFO[r].reciter,
    tone: RECITER_INFO[r].tone,
    duration: ADHAN_STYLE_LABELS[s].duration,
    available: false,
  })),
).filter((e) => !LEGACY_VARIANT_MIGRATION[e.id as string]);

export const ADHAN_LIBRARY: AdhanLibraryEntry[] = [...SUPPLIED_ENTRIES, ...LEGACY_ENTRIES];

/** Tathweeb (الصلاة خير من النوم) recordings supplied by the package. */
export const TATHWEEB_LIBRARY = ADHAN_ASSETS.filter((a) => a.slot === "tathweeb");

export type IqamaCategory = {
  id: IqamaVariant;
  name: string;
  hint: string;
  shortName: string;
  shortHint: string;
  duration: string;
  group: IqamahGroup;
};

/** أصوات الإقامة كما تعرضها الواجهة — مشتقّة من مكتبة الإقامة المستقلة وحدها. */
export const IQAMA_CATEGORIES: IqamaCategory[] = IQAMAH_SOUNDS.map((s) => ({
  id: s.id,
  name: s.name,
  hint: s.hint,
  shortName: s.shortName,
  shortHint: s.shortHint,
  duration: iqamahDurationLabel(s),
  group: s.group,
}));

export type ReminderMinutes = 5 | 10 | 15 | 30;
export const REMINDER_OPTIONS: ReminderMinutes[] = [5, 10, 15, 30];

/** خيارات «تنبيه قبل الإقامة» بالدقائق. */
export const IQAMA_REMINDER_OPTIONS = [2, 3, 5, 10] as const;

/** أقصى فاصل بين الأذان والإقامة بالدقائق — حدّ واحد للشريط والزرّين والحفظ. */
export const IQAMA_OFFSET_MAX = 60;

/** أقصى فاصل لإقامة الجمعة — الخطبة قد تطول أكثر من فاصل الأيام العادية. */
export const JUMUAH_OFFSET_MAX = 90;

/* ------------------------------ Shape ------------------------------- */

export type AdhanSettings = {
  /* Adhan (global default) */
  adhanEnabled: boolean;
  selectedAdhan: AdhanVariant;

  /* Per-prayer audio assignment */
  samePerPrayer: boolean;
  perPrayerAudio: Partial<Record<PrayerKey, AdhanVariant>>;

  /* Fajr */
  fajrAdhan: AdhanVariant;
  fajrUseSeparate: boolean;
  fajrFirstAdhanEnabled: boolean;
  fajrFirstAdhanOffset: number;
  fajrFirstAdhanAudio: AdhanVariant; // dedicated audio for first call
  fajrSecondAdhanAudio: AdhanVariant; // dedicated audio for second call (defaults to fajrAdhan)
  fajrTathweebEnabled: boolean;
  fajrTathweebAudio: AdhanVariant; // dedicated audio for tathweeb
  fajrReminderEnabled: boolean;
  /** دقائق «تذكير الفجر» قبل أذان الفجر (FAJR_REMINDER_OPTIONS). */
  fajrReminderMinutes: number;

  /* Reminders */
  remindersEnabled: boolean;
  reminderMinutes: ReminderMinutes[];
  /** صوت التنبيه قبل الصلاة — من فهرس «اقتراب الصلاة» وحده. */
  reminderSound: PrayerApproachSoundId;
  /** إشعار نصّي عند دخول وقت الصلاة — مستقلّ عن صوت الأذان. */
  prayerNoticeEnabled: boolean;

  /* Iqama */
  iqamaEnabled: boolean;
  iqamaSoundEnabled: boolean;
  iqamaVariant: IqamaVariant;
  iqamaOffsets: Record<PrayerKey, number>;
  perPrayerIqama: Partial<Record<PrayerKey, IqamaVariant>>;
  /** تنبيه نصّي قبل موعد الإقامة. */
  iqamaReminderEnabled: boolean;
  iqamaReminderMinutes: number;
  /**
   * صلاة الجمعة: الخطبة تبدأ مع الأذان، فلا يصلح فاصل الظهر العادي (١٥ دقيقة)
   * لأنه يقع في منتصف الخطبة. للجمعة فاصلها الخاص، أو تُطفأ إقامتها كليّاً.
   */
  jumuahIqamaEnabled: boolean;
  jumuahIqamaOffset: number;

  /* Notifications */
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  silentMode: boolean;
  /** المستوى العام — يُطبَّق على جميع أصوات منار وإشعاراتها (0..1). */
  volume: number;
  /** مستوى الأذان (بما فيه الأذان الأول للفجر والتثويب) نسبةً إلى العام. */
  adhanVolume: number;
  /** مستوى الإقامة نسبةً إلى العام. */
  iqamaVolume: number;
  /** مستوى التنبيهات: قبل الصلاة، وتذكيرات الأذكار والوِرد. */
  reminderVolume: number;
  /**
   * رفع «صوت المنبّه» في الجوال مؤقتاً إلى الأقصى وقت الأذان والإقامة ثم
   * إعادته كما كان (أندرويد). الأذان يُشغَّل نسبةً من صوت المنبّه، فلو كان
   * منخفضاً سُمع الأذان ضعيفاً مهما رُفع مستواه في منار.
   */
  raisePhoneAlarm: boolean;
  /**
   * أولوية المنبّه (أندرويد، المرحلة ٣٢): الأذان والإقامة وتنبيهها بـ`setAlarmClock`،
   * فلا يؤخّرها وضع Doze والهاتف ساكن. ثمنه أيقونة منبّه في شريط الحالة و«المنبّه
   * القادم» على شاشة القفل. مفعّل افتراضياً.
   */
  alarmClockPriority: boolean;

  /* Per-prayer toggles */
  perPrayer: Record<PrayerKey, { adhan: boolean; reminder: boolean; iqama: boolean }>;
};

export const DEFAULT_IQAMA: AdhanSettings["iqamaOffsets"] = {
  fajr: 20,
  sunrise: 0,
  dhuhr: 15,
  asr: 15,
  maghrib: 10,
  isha: 15,
};

const DEFAULTS: AdhanSettings = {
  adhanEnabled: true,
  selectedAdhan: "asset:makkah-mulla-1",
  samePerPrayer: true,
  perPrayerAudio: {},
  fajrAdhan: "asset:madinah-qassas",
  fajrUseSeparate: true,
  fajrFirstAdhanEnabled: false,
  fajrFirstAdhanOffset: 20,
  fajrFirstAdhanAudio: "asset:madinah-short",
  fajrSecondAdhanAudio: "asset:fajr-dossary-second",
  fajrTathweebEnabled: true,
  fajrTathweebAudio: "asset:tathweeb-madinah",
  /* كان المفتاح ظاهراً مفعّلاً ولا يفعل شيئاً؛ صار تذكيراً حقيقياً، فيبدأ مطفأً
   * حتى لا يُفاجأ أحدٌ بإشعارٍ جديد قبل الفجر. */
  fajrReminderEnabled: false,
  fajrReminderMinutes: 30,
  remindersEnabled: true,
  reminderMinutes: [15, 5],
  reminderSound: DEFAULT_PRAYER_APPROACH_SOUND,
  prayerNoticeEnabled: true,
  iqamaEnabled: true,
  iqamaSoundEnabled: true,
  iqamaVariant: DEFAULT_IQAMAH,
  iqamaOffsets: { ...DEFAULT_IQAMA },
  perPrayerIqama: {},
  iqamaReminderEnabled: false,
  iqamaReminderMinutes: 5,
  jumuahIqamaEnabled: true,
  jumuahIqamaOffset: 30,
  soundEnabled: true,
  vibrationEnabled: true,
  silentMode: false,
  volume: 1,
  adhanVolume: 1,
  iqamaVolume: 1,
  reminderVolume: 1,
  raisePhoneAlarm: false,
  alarmClockPriority: true,
  perPrayer: {
    fajr: { adhan: true, reminder: true, iqama: true },
    sunrise: { adhan: false, reminder: false, iqama: false },
    dhuhr: { adhan: true, reminder: true, iqama: true },
    asr: { adhan: true, reminder: true, iqama: true },
    maghrib: { adhan: true, reminder: true, iqama: true },
    isha: { adhan: true, reminder: true, iqama: true },
  },
};

/** خيارات «تذكير الفجر» ومدة «الأذان الأول» بالدقائق. */
export const FAJR_REMINDER_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
export const FAJR_FIRST_ADHAN_OPTIONS = [10, 15, 20, 30, 45, 60] as const;

function minutesIn(v: unknown, min: number, max: number, fb: number): number {
  if (v === null || v === "" || typeof v === "boolean") return fb;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fb;
}

/** هل هذه قشرة أندرويد الأصلية؟ (بلا استيراد Capacitor هنا). */
function nativeShell(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/**
 * ترحيل المرحلة ٢٦: إعداداتٌ كانت تُعرض ولا تعمل صارت تعمل. من حُفظت إعداداته
 * قبلها (بلا `fajrReminderMinutes`) نُبقي له ما كان يعيشه فعلاً:
 * «تذكير الفجر» مطفأ، و«التثويب» مطفأ في أندرويد (لم يكن يُسلسَل هناك قط).
 */
function migratePhase26(parsed: Record<string, unknown>): Partial<AdhanSettings> {
  if (parsed.fajrReminderMinutes !== undefined) return {};
  const out: Partial<AdhanSettings> = { fajrReminderEnabled: false };
  if (nativeShell()) out.fajrTathweebEnabled = false;
  return out;
}

/* ----------------------------- Storage ------------------------------ */

const LS_KEY = "manar.adhan-settings.v2";
const EVT = "manar:adhan-settings";
export const ADHAN_SETTINGS_EVENT = EVT;

function read(): AdhanSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    const mig = (v: unknown, fb: AdhanVariant): AdhanVariant =>
      typeof v === "string" ? migrateAdhanVariant(v as AdhanVariant) : fb;
    const perPrayerAudio: Partial<Record<PrayerKey, AdhanVariant>> = {};
    const iqama = readIqama(parsed);
    for (const [k, v] of Object.entries(parsed.perPrayerAudio ?? {})) {
      if (typeof v === "string")
        perPrayerAudio[k as PrayerKey] = migrateAdhanVariant(v as AdhanVariant);
    }
    return {
      ...DEFAULTS,
      ...parsed,
      selectedAdhan: mig(parsed.selectedAdhan, DEFAULTS.selectedAdhan),
      fajrAdhan: mig(parsed.fajrAdhan, DEFAULTS.fajrAdhan),
      fajrFirstAdhanAudio: mig(parsed.fajrFirstAdhanAudio, DEFAULTS.fajrFirstAdhanAudio),
      fajrSecondAdhanAudio: mig(parsed.fajrSecondAdhanAudio, DEFAULTS.fajrSecondAdhanAudio),
      fajrTathweebAudio: mig(parsed.fajrTathweebAudio, DEFAULTS.fajrTathweebAudio),
      iqamaOffsets: normalizeIqamaOffsets(parsed.iqamaOffsets),
      perPrayer: { ...DEFAULTS.perPrayer, ...(parsed.perPrayer ?? {}) },
      perPrayerAudio,
      ...iqama,
      reminderMinutes: Array.isArray(parsed.reminderMinutes)
        ? parsed.reminderMinutes
        : DEFAULTS.reminderMinutes,
      reminderSound: normalizeApproachSound(parsed.reminderSound),
      ...readVolumes(parsed),
      raisePhoneAlarm: parsed.raisePhoneAlarm === true,
      alarmClockPriority: parsed.alarmClockPriority !== false,
      fajrFirstAdhanOffset: minutesIn(
        parsed.fajrFirstAdhanOffset,
        1,
        90,
        DEFAULTS.fajrFirstAdhanOffset,
      ),
      fajrReminderMinutes: minutesIn(
        parsed.fajrReminderMinutes,
        1,
        120,
        DEFAULTS.fajrReminderMinutes,
      ),
      ...migratePhase26(parsed),
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * إعدادات الإقامة المحفوظة بعد ترحيلها إلى مكتبة الإقامة الجديدة. أيّ معرّفٍ
 * قديم يُنقل إلى تسجيل إقامةٍ حقيقي؛ ومن كان اختار «إشعار صامت» يبقى صامتاً
 * عبر مفتاح صوت الإقامة بدل أن يُفاجأ بصوت.
 */
function readIqama(parsed: Record<string, unknown>) {
  const legacySilent = parsed.iqamaVariant === "silent";
  const perPrayerIqama: Partial<Record<PrayerKey, IqamaVariant>> = {};
  const rawPer = (parsed.perPrayerIqama ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rawPer)) {
    const id = migrateIqamahId(v);
    if (id) perPrayerIqama[k as PrayerKey] = id;
  }
  const minutes = Number(parsed.iqamaReminderMinutes);
  const jumuah = Number(parsed.jumuahIqamaOffset);
  return {
    jumuahIqamaEnabled:
      typeof parsed.jumuahIqamaEnabled === "boolean"
        ? parsed.jumuahIqamaEnabled
        : DEFAULTS.jumuahIqamaEnabled,
    jumuahIqamaOffset:
      parsed.jumuahIqamaOffset !== null &&
      parsed.jumuahIqamaOffset !== "" &&
      Number.isFinite(jumuah) &&
      jumuah >= 1
        ? Math.min(JUMUAH_OFFSET_MAX, Math.round(jumuah))
        : DEFAULTS.jumuahIqamaOffset,
    iqamaVariant: migrateIqamahId(parsed.iqamaVariant) ?? DEFAULTS.iqamaVariant,
    iqamaSoundEnabled: legacySilent
      ? false
      : typeof parsed.iqamaSoundEnabled === "boolean"
        ? parsed.iqamaSoundEnabled
        : DEFAULTS.iqamaSoundEnabled,
    perPrayerIqama,
    iqamaReminderMinutes:
      Number.isFinite(minutes) && minutes >= 1 && minutes <= 30
        ? Math.round(minutes)
        : DEFAULTS.iqamaReminderMinutes,
  };
}

/**
 * فواصل الإقامة المحفوظة بعد فحصها. قيمة تالفة (نصّ، null، NaN) كانت تمرّ كما
 * هي فيُنتج `iqamahTimeFor` موعداً غير صالح (`Invalid Date`) يُسلَّم للجدولة.
 * كل قيمة غير رقمية ترجع لافتراضيّها، والرقمية تُقرَّب وتُحصر في ٠..٦٠.
 */
export function normalizeIqamaOffsets(raw: unknown): Record<PrayerKey, number> {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_IQAMA };
  for (const p of PRAYER_ORDER) {
    const v = src[p];
    // Number(null) و Number("") صفرٌ صالح في JS — نرفضهما صراحةً.
    if (v === null || v === "" || typeof v === "boolean") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out[p] = Math.max(0, Math.min(IQAMA_OFFSET_MAX, Math.round(n)));
  }
  out.sunrise = 0;
  return out;
}

const unit = (v: unknown, fb: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fb;

/**
 * مستويات الصوت المحفوظة. قبل هذه الميزة كان `volume` حقلاً وحيداً قيمته
 * الافتراضية ٠٫٧ يؤثّر في معاينات الويب فقط، بينما كان الأذان على أندرويد
 * يُشغَّل بكامل صوته. من لم يُحرّك المؤشّر قطّ (٠٫٧ بلا الحقول الجديدة) نرفعه
 * إلى ١٠٠٪ حتى لا يخفت أذانه فجأةً بعد التحديث.
 */
function readVolumes(parsed: Record<string, unknown>) {
  const fresh = parsed.adhanVolume === undefined && parsed.iqamaVolume === undefined;
  const legacyDefault = fresh && parsed.volume === 0.7;
  return {
    volume: legacyDefault ? 1 : unit(parsed.volume, DEFAULTS.volume),
    adhanVolume: unit(parsed.adhanVolume, DEFAULTS.adhanVolume),
    iqamaVolume: unit(parsed.iqamaVolume, DEFAULTS.iqamaVolume),
    reminderVolume: unit(parsed.reminderVolume, DEFAULTS.reminderVolume),
  };
}

export type VolumeKind = "adhan" | "iqama" | "reminder";

export type VolumeLevels = Pick<
  AdhanSettings,
  "volume" | "adhanVolume" | "iqamaVolume" | "reminderVolume"
>;

/** المستوى الفعلي لفئة = العام × مستوى الفئة. */
export function effectiveVolume(s: VolumeLevels, kind: VolumeKind): number {
  const cat =
    kind === "adhan" ? s.adhanVolume : kind === "iqama" ? s.iqamaVolume : s.reminderVolume;
  return Math.min(1, Math.max(0, s.volume * cat));
}

/**
 * درجات صوت الإشعارات. على أندرويد ٨+ صوت الإشعار ملفٌّ ثابت في قناته ولا
 * يقبل تحديد مستوى، فنشحن نسخاً مخفَّضة مسبقاً من كل نغمة (scripts/
 * build-volume-levels.mjs) ونقرّب المستوى الفعلي لأقرب درجة منها.
 */
export const NOTIFICATION_LEVELS = [0, 20, 40, 60, 80, 100] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export function notificationLevel(s: VolumeLevels): NotificationLevel {
  const pct = effectiveVolume(s, "reminder") * 100;
  let best: NotificationLevel = 100;
  for (const l of NOTIFICATION_LEVELS) if (Math.abs(l - pct) < Math.abs(best - pct)) best = l;
  // صوتٌ مسموع مهما قلّ لا يُقرَّب إلى الصمت.
  return best === 0 && pct > 0 ? 20 : best;
}

function write(next: AdhanSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

export function useAdhanSettings() {
  // Start from DEFAULTS on both server and first client render so the
  // hydrated markup matches; stored settings are applied right after mount.
  const [settings, setState] = useState<AdhanSettings>(DEFAULTS);
  useEffect(() => {
    setState(read());
    const onChange = () => setState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (patch: Partial<AdhanSettings>) => {
    const next = { ...read(), ...patch };
    write(next);
    setState(next);
  };
  const updateDeep = (mut: (s: AdhanSettings) => AdhanSettings) => {
    const next = mut(read());
    write(next);
    setState(next);
  };
  return { settings, update, updateDeep };
}

export function getAdhanSettings(): AdhanSettings {
  return read();
}

/** Resolve the Adhan audio variant for a given prayer, honoring Fajr override
 *  and per-prayer assignments. */
export function resolveAdhanForPrayer(s: AdhanSettings, p: PrayerKey): AdhanVariant {
  if (p === "fajr" && s.fajrUseSeparate) return s.fajrAdhan;
  if (!s.samePerPrayer) {
    const v = s.perPrayerAudio[p];
    if (v) return v;
  }
  return s.selectedAdhan;
}

export function resolveIqamaForPrayer(s: AdhanSettings, p: PrayerKey): IqamaVariant {
  return s.perPrayerIqama[p] ?? s.iqamaVariant;
}

export const ADJUSTABLE_PRAYERS: PrayerKey[] = PRAYER_ORDER.filter((p) => p !== "sunrise");
