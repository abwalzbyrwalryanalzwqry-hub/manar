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
import {
  computePrayerTimes,
  PRAYER_LABELS,
  PRAYER_ORDER,
  type LocationState,
  type PrayerKey,
  type Settings,
} from "./prayer";
import { resolveAdhanForPrayer, resolveIqamaForPrayer, type AdhanSettings } from "./adhan-settings";
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
  /** قناة الإشعار لحدث «notice». */
  channel?: "adhan" | "iqama";
  /** بعد انتهاء الأذان يبقى إشعار دخول الوقت (إن كان مفعّلاً). */
  notice?: boolean;
  /** مقطعٌ يُشغَّل بعد الصوت مباشرة (التثويب بعد أذان الفجر) — اسم مورد res/raw. */
  follow?: string;
};

/** مدى تذكيرات LocalNotifications (قبل الصلاة، الأذكار، المواسم). */
export const SCHEDULE_DAYS_AHEAD = 7;

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
};

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

export function eventKey(prayer: PrayerKey, role: AlarmRole, day: Date): string {
  return `${prayer}_${role}_${dateKey(day)}`;
}

/** رقم اليوم المحلي منذ ١٩٧٠ — مستقلّ عن الساعة وعن التوقيت الصيفي. */
function localDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** معرّف رقمي فريد ضمن أيّ نافذة ≤ ١٠٠ يوم. */
export function eventId(prayer: PrayerKey, role: AlarmRole, day: Date): number {
  return (localDayNumber(day) % 100) * 1000 + PRAYER_ORDER.indexOf(prayer) * 100 + ROLE_CODE[role];
}

/* الأرقام ونظام الساعة يتبعان اختيار المستخدم (`display-prefs`). */
const AR = (n: number | string) => toArabicDigits(n);

function hhmm(d: Date): string {
  const suffix = displayPrefs().clock === "24" ? "" : d.getHours() < 12 ? " ص" : " م";
  return formatArTime(d) + suffix;
}

export function minutesAr(m: number): string {
  if (m === 1) return "دقيقة واحدة";
  if (m === 2) return "دقيقتان";
  if (m >= 3 && m <= 10) return `${AR(m)} دقائق`;
  return `${AR(m)} دقيقة`;
}

export type BuildOptions = {
  settings: AdhanSettings;
  location: LocationState;
  calc: Settings;
  /** لحظة البناء (ميلي ثانية) — الأحداث الماضية تُستبعد. */
  now: number;
  days?: number;
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
    day.setDate(day.getDate() + days - 2);
    const isha = computePrayerTimes(location, calc, day).isha;
    push({
      id: eventId("isha", "renew", day),
      key: eventKey("isha", "renew", day),
      role: "renew",
      prayer: "isha",
      at: isha.getTime() + 30 * 60_000,
      sound: "",
      title: "افتح منار لتجديد مواقيت الصلاة",
      body: "جدول الأذان المحفوظ على جوالك ينتهي بعد يومين. افتح التطبيق مرة ليُحسب الشهر القادم.",
      kind: "notice",
      channel: "adhan",
    });
  }

  return [...byKey.values()].sort((a, b) => a.at - b.at || a.id - b.id);
}
