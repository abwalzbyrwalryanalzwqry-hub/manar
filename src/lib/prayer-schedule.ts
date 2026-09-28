/* منار — جدول أحداث الصلاة الموحّد (الأذان · الإقامة · التنبيهات).
 *
 * دالّة نقيّة بلا أيّ اعتماد على Capacitor أو المتصفح: تأخذ الإعدادات والموقع
 * وطريقة الحساب ولحظة «الآن»، وتُخرج قائمة الأحداث التي تُسلَّم للطبقة الأصلية
 * (AdhanScheduler) لتُضبط منبّهاتٍ دقيقة تعمل والتطبيق مغلق. لذلك تُختبر
 * بالكامل في `tests/unit/prayer-schedule.test.ts`.
 *
 * التدفّق لكل صلاة:
 *
 *   الأذان الأول للفجر (اختياري)
 *        ↓
 *   دخول الوقت ── الأذان (صوت)            أو  إشعار دخول الوقت (نصّ)
 *        ↓
 *   تنبيه قبل الإقامة (نصّ، اختياري)
 *        ↓
 *   الإقامة (صوت من مكتبة الإقامة وحدها)
 *
 * كل مرحلة مستقلّة بمفتاحها: تعطيل الأذان لا يُعطّل الإقامة ولا تنبيهها.
 * والأصوات منفصلة: حدث «adhan» لا يحمل إلا صوت أذان، وحدث «iqama» لا يحمل
 * إلا صوتاً من `iqamah-library.ts`، وحدث «notice» بلا صوت إطلاقاً.
 *
 * منع التكرار: لكل حدث مفتاح فريد مقروء (`fajr_iqamah_2026_09_23`) ومعرّف
 * رقمي مشتقّ من التاريخ نفسه لا من ترتيب اليوم، فإعادة البناء مرّتين تُنتج
 * القائمة ذاتها بالمعرّفات ذاتها — والطبقة الأصلية تستبدل ولا تُضيف.
 */

import { formatArTime, toArabicDigits } from "./format";
import { displayPrefs } from "./display-prefs";
import { PRE_PRAYER_TITLE, minutesAr, prePrayerBody } from "./notification-text";
import {
  computePrayerTimes,
  PRAYER_LABELS,
  PRAYER_ORDER,
  type LocationState,
  type PrayerKey,
  type Settings,
} from "./prayer";
import {
  REMINDER_OPTIONS,
  resolveAdhanForPrayer,
  resolveIqamaForPrayer,
  type AdhanSettings,
} from "./adhan-settings";
import { adhanVariantUrl } from "./adhan-sound";
import { getIqamahSound } from "./iqamah-library";

export type AlarmKind = "adhan" | "iqama" | "notice";

/** نوع الحدث داخل الجدول — أدقّ من `kind` الذي تفهمه الطبقة الأصلية. */
export type AlarmRole =
  | "fajr_first_adhan"
  | "adhan"
  | "prayer_notice"
  | "iqamah_reminder"
  | "iqamah"
  /** التنبيه قبل الصلاة بدقائق `minutes` (منذ المرحلة ٢٨ في الجدول الأصلي نفسه). */
  | "reminder"
  /** «تذكير الفجر» المستقلّ. */
  | "fajr_reminder"
  /** تذكير أذكار/وِرد (يبنيه `native-notifications.ts`، معرّفه من `dailyEventId`). */
  | "daily"
  /** «افتح منار لتجديد المواقيت» قبل نفاد الجدول المضبوط. */
  | "renew";

export type ManarAlarmEvent = {
  /** معرّف رقمي ثابت للحدث (≤ ٩٩٬٩٩٩) — مشتقّ من التاريخ والصلاة والدور. */
  id: number;
  /** مفتاح فريد مقروء: `<صلاة>_<دور>_<سنة>_<شهر>_<يوم>`. */
  key: string;
  /** اللحظة المطلقة (ميلي ثانية). */
  at: number;
  /** اسم مورد res/raw، أو "" للصمت. */
  sound: string;
  title: string;
  body: string;
  kind: AlarmKind;
  role: AlarmRole;
  prayer: PrayerKey;
  /**
   * قناة الإشعار لحدث «notice»: "adhan"/"iqama" لقناتي الصلاة (باهتزازٍ أو
   * بدونه حسب الإعداد)، أو معرّف قناة تذكيرٍ كامل (`manar_approach_…`).
   */
  channel?: "adhan" | "iqama" | (string & {});
  /** بعد انتهاء الأذان يبقى إشعار دخول الوقت (إن كان مفعّلاً). */
  notice?: boolean;
  /** مقطعٌ يُشغَّل بعد الصوت مباشرة (التثويب بعد أذان الفجر) — اسم مورد res/raw. */
  follow?: string;
  /** دقائق التنبيه قبل الصلاة (لـ`reminder` و`fajr_reminder`). */
  minutes?: number;
  /** ما يرافق الإشعار في أندرويد (`NoticeMeta.java`). */
  meta?: NoticeMeta;
};

/**
 * مسار النقر، وزرّ «صلّيت» (الصلاة ويومها بصيغة سجل النشاط)، و«ذكّرني لاحقاً».
 * يطابق `NoticeMeta.java`.
 */
export type NoticeMeta = {
  route?: string;
  prayer?: PrayerKey;
  prayedDay?: string;
  snooze?: number;
};

/** يوم الصلاة بصيغة سجل النشاط (`2026-09-23`). */
export function logDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * مدى LocalNotifications (الأذكار والوِرد، المواسم، الجمعة). كان ٧ أيام؛ صار ١٤
 * بحدٍّ أعلى `LN_CAP`. التنبيه قبل الصلاة خرج منها إلى الجدول الأصلي (٣٠ يوماً).
 */
export const SCHEDULE_DAYS_AHEAD = 14;
/** أقصى عدد إشعارات LocalNotifications مضبوطة معاً (حدّ أندرويد ٥٠٠ للتطبيق). */
export const LN_CAP = 240;
/** مدى فترات «سكينة» — يطابق الافتراضي في `computeSakinahWindows`. */
export const SAKINAH_DAYS_AHEAD = 7;

/**
 * متى يُنبَّه «افتح منار لتجديد المواقيت»: قبل نهاية أقصر جدولٍ فعّال بيومين.
 * بلا سكينة ولا تذكيرات LocalNotifications يبقى على جدول الأذان (undefined).
 */
export function renewPlan(o: {
  lnItems: number;
  sakinah: boolean;
}): { day: number; body: string } | undefined {
  if (o.sakinah) {
    return {
      day: SAKINAH_DAYS_AHEAD - 2,
      body: "فترات «سكينة» المحفوظة على جوالك تنتهي بعد يومين. افتح التطبيق مرة ليُحسب ما بعدها.",
    };
  }
  if (o.lnItems > 0) {
    return {
      day: SCHEDULE_DAYS_AHEAD - 2,
      body: "تذكيرات الأذكار والمواسم المحفوظة على جوالك تنتهي بعد يومين. افتح التطبيق مرة ليُحسب ما بعدها.",
    };
  }
  return undefined;
}

/**
 * مدى جدول الأذان والإقامة المسلَّم لـ`AdhanScheduler`. يُحفظ كله على الجهاز،
 * ولا يُضبط منه في النظام إلا ٤٨ ساعة متحرّكة، فيستمر الأذان شهراً كاملاً دون
 * فتح التطبيق بلا اقتراب من حدّ المنبّهات.
 */
export const ADHAN_DAYS_AHEAD = 30;

const ROLE_CODE: Record<AlarmRole, number> = {
  adhan: 1,
  fajr_first_adhan: 2,
  iqamah: 3,
  prayer_notice: 4,
  iqamah_reminder: 5,
  renew: 6,
  /* ١٠..١٣ بحسب خانة الدقائق في REMINDER_OPTIONS — انظر reminderSlot. */
  reminder: 10,
  fajr_reminder: 20,
  daily: 0,
};

/** خانة ثابتة لكل مدة تنبيه (٥، ١٠، ١٥، ٣٠) — فلا يتغيّر المعرّف بترتيب الاختيار. */
export function reminderSlot(m: number): number {
  const i = REMINDER_OPTIONS.indexOf(m as never);
  return i >= 0 ? i : 4 + (Math.abs(Math.round(m)) % 5);
}

/**
 * اسم مورد أندرويد لصوتٍ مضمَّن. `res/raw` لا يقبل إلا [a-z0-9_]، فـ
 * `/audio/library/makkah-mulla-full-1.mp3` يصير `makkah_mulla_full_1`.
 * مطابقٌ لـ`rawResourceName` في scripts/sync-android-raw-audio.mjs.
 */
export function rawResourceName(url: string | null | undefined): string {
  if (!url) return "";
  const file = url.split("/").pop();
  if (!file) return "";
  return file
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a$1");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `2026_09_23` — التاريخ المحلي للصلاة. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}`;
}

export function eventKey(prayer: PrayerKey, role: AlarmRole, day: Date, minutes?: number): string {
  const r = minutes === undefined ? role : `${role}${minutes}m`;
  return `${prayer}_${r}_${dateKey(day)}`;
}

/** رقم اليوم المحلي منذ ١٩٧٠ — مستقلّ عن الساعة وعن التوقيت الصيفي. */
function localDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/**
 * تذكيرات الأذكار والوِرد في الجدول الأصلي نفسه (منذ المرحلة ٢٩): الخانات
 * ٦٠٠..٩٤٩ من كتلة اليوم، بعد خانات الصلوات (٠..٥٢٠) وقبل ٩٩٠ (تغيّر المنطقة).
 */
export const DAILY_EVENT_BASE = 600;
export const DAILY_EVENT_MAX = 350;

export function dailyEventId(day: Date, index: number): number {
  return (localDayNumber(day) % 100) * 1000 + DAILY_EVENT_BASE + index;
}

/** معرّف رقمي فريد ضمن أيّ نافذة ≤ ١٠٠ يوم. */
export function eventId(prayer: PrayerKey, role: AlarmRole, day: Date, slot = 0): number {
  return (
    (localDayNumber(day) % 100) * 1000 + PRAYER_ORDER.indexOf(prayer) * 100 + ROLE_CODE[role] + slot
  );
}

/* الأرقام ونظام الساعة يتبعان اختيار المستخدم (`display-prefs`). */
const AR = (n: number | string) => toArabicDigits(n);

function hhmm(d: Date): string {
  const suffix = displayPrefs().clock === "24" ? "" : d.getHours() < 12 ? " ص" : " م";
  return formatArTime(d) + suffix;
}

export { minutesAr } from "./notification-text";

export type BuildOptions = {
  settings: AdhanSettings;
  location: LocationState;
  calc: Settings;
  /** لحظة البناء (ميلي ثانية) — الأحداث الماضية تُستبعد. */
  now: number;
  days?: number;
  /**
   * قناة التنبيه قبل الصلاة كما أنشأتها المزامنة (صوت المقطع، الدرجة، الاهتزاز).
   * الافتراضي `manar_reminders`؛ الويب لا يستعملها.
   */
  reminderChannel?: (prayer: PrayerKey) => string;
  /** يوم تنبيه التجديد (فهرس من اليوم) ونصّه — الافتراضي قبل نهاية `days` بيومين. */
  renew?: { day: number; body: string };
};

/** صلاة الظهر يوم الجمعة (بالتوقيت المحلي لليوم نفسه) هي صلاة الجمعة. */
export function isJumuah(prayer: PrayerKey, day: Date): boolean {
  return prayer === "dhuhr" && day.getDay() === 5;
}

/** اسم الصلاة كما يظهر في الإشعار والواجهة — «الجمعة» بدل «الظهر» يوم الجمعة. */
export function prayerLabelOn(prayer: PrayerKey, day: Date): string {
  return isJumuah(prayer, day) ? "الجمعة" : PRAYER_LABELS[prayer].ar;
}

/**
 * فاصل الإقامة بالدقائق لصلاةٍ في يومٍ معيّن، أو null إن لم تكن لها إقامة
 * (الشروق، أو فاصل صفر، أو إقامة الجمعة مطفأة).
 */
export function iqamahOffsetFor(s: AdhanSettings, prayer: PrayerKey, day: Date): number | null {
  if (prayer === "sunrise") return null;
  if (isJumuah(prayer, day)) {
    if (!s.jumuahIqamaEnabled) return null;
    const j = Math.round(Number(s.jumuahIqamaOffset));
    return Number.isFinite(j) && j > 0 ? j : null;
  }
  const offset = Math.round(Number(s.iqamaOffsets[prayer] ?? 0));
  return Number.isFinite(offset) && offset > 0 ? offset : null;
}

/** وقت الإقامة لصلاةٍ في يومٍ معيّن، أو null إن لم تكن لها إقامة. اليوم يُؤخذ من وقت الأذان نفسه. */
export function iqamahTimeFor(s: AdhanSettings, prayer: PrayerKey, adhanAt: Date): Date | null {
  const offset = iqamahOffsetFor(s, prayer, adhanAt);
  if (offset === null || !Number.isFinite(adhanAt.getTime())) return null;
  return new Date(adhanAt.getTime() + offset * 60_000);
}

/**
 * الصلوات التي لن يصلها «تنبيه قبل الإقامة» لأن مدّته تساوي فاصلها أو تزيد عليه
 * (التنبيه يجب أن يقع بين الأذان والإقامة). تعرضها الواجهة حتى لا يُلغى التنبيه
 * دون علم المستخدم. `day` يحدّد هل تُحسب الجمعة بفاصلها الخاص.
 */
export function iqamahReminderSkipped(
  s: AdhanSettings,
  day: Date = new Date(),
): { prayer: PrayerKey; label: string; offset: number }[] {
  if (!s.iqamaReminderEnabled) return [];
  const m = Math.round(s.iqamaReminderMinutes);
  const out: { prayer: PrayerKey; label: string; offset: number }[] = [];
  for (const prayer of PRAYER_ORDER) {
    if (prayer === "sunrise") continue;
    if (s.perPrayer[prayer]?.iqama === false) continue;
    const offset = iqamahOffsetFor(s, prayer, day);
    if (offset !== null && m >= offset) {
      out.push({ prayer, label: prayerLabelOn(prayer, day), offset });
    }
  }
  return out;
}

/**
 * دقائق «تذكير الفجر» قبل أذان الفجر، أو null إن كان مطفأً أو مكرّراً لتنبيهٍ
 * قبل الصلاة بالدقائق نفسها (فلا يصل إشعاران في اللحظة ذاتها).
 */
export function fajrReminderMinutesFor(s: AdhanSettings): number | null {
  if (!s.fajrReminderEnabled) return null;
  const m = Math.round(s.fajrReminderMinutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  const general = s.remindersEnabled && s.perPrayer.fajr?.reminder !== false;
  if (general && s.reminderMinutes.includes(m as never)) return null;
  return m;
}

export const FAJR_REMINDER_TITLE = "تذكير الفجر";

export function fajrReminderBody(m: number): string {
  return `بقي ${minutesAr(m)} على أذان الفجر`;
}

export function buildPrayerAlarms(o: BuildOptions): ManarAlarmEvent[] {
  const { settings: s, location, calc, now } = o;
  const days = o.days ?? ADHAN_DAYS_AHEAD;
  const byKey = new Map<string, ManarAlarmEvent>();
  const soundOn = s.soundEnabled && !s.silentMode;

  const push = (e: ManarAlarmEvent) => {
    if (e.at <= now) return;
    // المفتاح نفسه لا يُضاف مرّتين أبداً — الأوّل يبقى.
    if (!byKey.has(e.key)) byKey.set(e.key, e);
  };

  for (let d = 0; d < days; d++) {
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() + d);
    const times = computePrayerTimes(location, calc, day);

    for (const prayer of PRAYER_ORDER) {
      if (prayer === "sunrise") continue;
      const per = s.perPrayer[prayer] ?? { adhan: true, reminder: true, iqama: true };
      /* يوم الجمعة: الأذان باسم «الجمعة» أيضاً. */
      const label = prayerLabelOn(prayer, day);
      /* يوم الجمعة: الإقامة وتنبيهها باسم «الجمعة» وبفاصلها الخاص. */
      const iqamaLabel = prayerLabelOn(prayer, day);
      const adhanAt = times[prayer];
      const base = (role: AlarmRole) => ({
        id: eventId(prayer, role, day),
        key: eventKey(prayer, role, day),
        role,
        prayer,
      });
      /* دخول الوقت والإقامة: النقر يفتح شاشة الصلاة، و«صلّيت» يسجّلها ليومها. */
      const prayedMeta: NoticeMeta = { route: "/prayer", prayer, prayedDay: logDayKey(day) };
      const openPrayer: NoticeMeta = { route: "/prayer" };

      /* ---------------- الأذان الأول للفجر ---------------- */
      if (prayer === "fajr" && s.adhanEnabled && per.adhan && s.fajrFirstAdhanEnabled) {
        const offset = Math.max(1, Math.round(s.fajrFirstAdhanOffset || 20));
        push({
          ...base("fajr_first_adhan"),
          at: adhanAt.getTime() - offset * 60_000,
          sound: soundOn ? rawResourceName(adhanVariantUrl(s.fajrFirstAdhanAudio)) : "",
          title: "الأذان الأول للفجر",
          body: `${location.city} · يتبقى ${minutesAr(offset)} على أذان الفجر`,
          kind: "adhan",
          meta: openPrayer,
        });
      }

      /* ---------------- دخول الوقت: أذان أو إشعار ---------------- */
      const adhanScheduled = s.adhanEnabled && per.adhan;
      if (adhanScheduled) {
        push({
          ...base("adhan"),
          at: adhanAt.getTime(),
          sound: soundOn ? rawResourceName(adhanVariantUrl(resolveAdhanForPrayer(s, prayer))) : "",
          title: `حان الآن وقت ${label}`,
          body: `${location.city} · أذان ${label}`,
          kind: "adhan",
          notice: s.prayerNoticeEnabled,
          meta: prayedMeta,
          /* التثويب يُسلسَل بعد أذان الفجر في الخدمة الأصلية نفسها (مشغّلٌ واحد). */
          ...(prayer === "fajr" && soundOn && s.fajrTathweebEnabled
            ? { follow: rawResourceName(adhanVariantUrl(s.fajrTathweebAudio)) }
            : {}),
        });
      } else if (s.prayerNoticeEnabled) {
        push({
          ...base("prayer_notice"),
          at: adhanAt.getTime(),
          sound: "",
          title: `حان الآن وقت ${label}`,
          body: `${location.city} · ${hhmm(adhanAt)}`,
          kind: "notice",
          channel: "adhan",
          meta: prayedMeta,
        });
      }

      /* ---------------- التنبيه قبل الصلاة و«تذكير الفجر» ----------------
       * كانت تُضبط في LocalNotifications لسبعة أيام وحدها؛ صارت في الجدول
       * الأصلي نفسه بنافذته المتحركة، فتمتد ثلاثين يوماً كالأذان. */
      const channel = o.reminderChannel?.(prayer) ?? "manar_reminders";
      if (s.remindersEnabled && per.reminder) {
        for (const m of new Set(s.reminderMinutes)) {
          if (!(m > 0)) continue;
          push({
            id: eventId(prayer, "reminder", day, reminderSlot(m)),
            key: eventKey(prayer, "reminder", day, m),
            role: "reminder",
            prayer,
            at: adhanAt.getTime() - m * 60_000,
            sound: "",
            title: PRE_PRAYER_TITLE,
            body: prePrayerBody(m, label),
            kind: "notice",
            channel,
            minutes: m,
            meta: openPrayer,
          });
        }
      }
      const fm = prayer === "fajr" ? fajrReminderMinutesFor(s) : null;
      if (fm !== null) {
        push({
          ...base("fajr_reminder"),
          at: adhanAt.getTime() - fm * 60_000,
          sound: "",
          title: FAJR_REMINDER_TITLE,
          body: fajrReminderBody(fm),
          kind: "notice",
          channel,
          minutes: fm,
          meta: openPrayer,
        });
      }

      /* ---------------- الإقامة وتنبيهها ---------------- */
      const iqamaAt = per.iqama ? iqamahTimeFor(s, prayer, adhanAt) : null;
      if (!iqamaAt) continue;
      const offset = Math.round((iqamaAt.getTime() - adhanAt.getTime()) / 60_000);

      if (s.iqamaReminderEnabled) {
        const m = Math.round(s.iqamaReminderMinutes);
        // التنبيه يقع بين الأذان والإقامة، وإلا فلا معنى له.
        if (m > 0 && m < offset) {
          push({
            ...base("iqamah_reminder"),
            at: iqamaAt.getTime() - m * 60_000,
            sound: "",
            title: `اقتربت إقامة ${iqamaLabel}`,
            body: `تبقى ${minutesAr(m)} على إقامة الصلاة · ${hhmm(iqamaAt)}`,
            kind: "notice",
            channel: "iqama",
            meta: openPrayer,
          });
        }
      }

      if (s.iqamaEnabled) {
        const sound = getIqamahSound(resolveIqamaForPrayer(s, prayer));
        push({
          ...base("iqamah"),
          at: iqamaAt.getTime(),
          sound: soundOn && s.iqamaSoundEnabled && sound ? rawResourceName(sound.url) : "",
          title: `إقامة ${iqamaLabel}`,
          body: "حان موعد إقامة الصلاة الآن",
          kind: "iqama",
          meta: prayedMeta,
        });
      }
    }
  }

  /* ---------------- شبكة أمان: تجديد الجدول ----------------
   * المواقيت تُحسب على الجهاز وتُسلَّم للنظام لأيام معدودة. من لم يفتح منار
   * طوال هذه المدة ينفد جدوله فيسكت الأذان بلا إنذار. قبل النهاية بيومين بعد العشاء
   * نُنبّه مرة واحدة. فتح التطبيق يستبدل الجدول كله، فيتأخّر هذا التنبيه معه
   * ولا يراه من يفتح منار بانتظام. */
  if (days >= 2 && byKey.size > 0) {
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() + Math.min(days - 2, o.renew?.day ?? days - 2));
    const isha = computePrayerTimes(location, calc, day).isha;
    push({
      id: eventId("isha", "renew", day),
      key: eventKey("isha", "renew", day),
      role: "renew",
      prayer: "isha",
      at: isha.getTime() + 30 * 60_000,
      sound: "",
      title: "افتح منار لتجديد مواقيت الصلاة",
      body:
        o.renew?.body ??
        "جدول الأذان المحفوظ على جوالك ينتهي بعد يومين. افتح التطبيق مرة ليُحسب الشهر القادم.",
      kind: "notice",
      channel: "adhan",
    });
  }

  return [...byKey.values()].sort((a, b) => a.at - b.at || a.id - b.id);
}
