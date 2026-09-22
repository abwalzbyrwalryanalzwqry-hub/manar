/* منار — تذكيرات الأذكار والوِرد اليومي.
 *
 * منفصلة عن تنبيهات الصلاة لأنها مختلفة في جوهرها: تنبيه الصلاة يتبع حساباً
 * فلكياً لا يملك المستخدم توقيته، أما هذه فيختار المستخدم ساعتها بنفسه — وقد
 * يربطها بصلاة (بعد الفجر، قبل المغرب) فتتحرّك معها كل يوم.
 */

import { useEffect, useState } from "react";
import { PRAYER_LABELS, type PrayerKey } from "./prayer";

/* فهرس أصوات «تذكيرات الأذكار والوِرد» وحده. لا يُقرأ منه إلا هذا القسم، ولا
 * يعرف شيئاً عن أصوات «اقتراب الصلاة» (src/lib/prayer-approach-audio.ts) —
 * فلا يمكن أن يظهر صوتٌ من إحدى الحزمتين في قائمة الأخرى. */
export const AZKAR_WIRD_AUDIO_CATEGORY = "azkar_wird_reminders";

export const REMINDER_TONES = [
  {
    id: "azkar-morning",
    name: "إشراق",
    hint: "صاعد مشرق",
    url: "/audio/reminders/azkar-morning.mp3",
  },
  {
    id: "azkar-evening",
    name: "أصيل",
    hint: "هابط دافئ",
    url: "/audio/reminders/azkar-evening.mp3",
  },
  { id: "wird", name: "تأمّل", hint: "ساكن ممتد", url: "/audio/reminders/wird.mp3" },
  {
    id: "reminder-bell",
    name: "جرس",
    hint: "جرس دافئ مزدوج",
    url: "/audio/reminders/reminder-bell.mp3",
  },
  {
    id: "reminder-default",
    name: "نداء",
    hint: "ثلاث درجات هادئة",
    url: "/audio/reminders/reminder-default.mp3",
  },
  {
    id: "reminder-chime",
    name: "نقرة",
    hint: "قصيرة محايدة",
    url: "/audio/reminders/reminder-chime.mp3",
  },
  /* حزمة «أصوات تذكيرات الأذكار والوِرد» — نداءات صوتية قصيرة. */
  {
    id: "azkar-morning-01",
    name: "أذكار الصباح",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-morning-01.mp3",
  },
  {
    id: "azkar-morning-02",
    name: "أذكارُ الصباح",
    hint: "نداء صوتي بأداء آخر",
    url: "/audio/reminders/azkar-morning-02.mp3",
  },
  {
    id: "azkar-morning-03",
    name: "حان وقت أذكار الصباح",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-morning-03.mp3",
  },
  {
    id: "azkar-evening-01",
    name: "أذكار المساء",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-evening-01.mp3",
  },
  {
    id: "azkar-evening-02",
    name: "حان وقت أذكار المساء",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-evening-02.mp3",
  },
  {
    id: "azkar-sleep-01",
    name: "أذكار النوم",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-sleep-01.mp3",
  },
  {
    id: "azkar-sleep-02",
    name: "حان وقت أذكار النوم",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-sleep-02.mp3",
  },
  {
    id: "azkar-wake-01",
    name: "أذكار الاستيقاظ من النوم",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-wake-01.mp3",
  },
  {
    id: "wird-daily-01",
    name: "لا تنسَ وِردك اليومي",
    hint: "نداء صوتي",
    url: "/audio/reminders/wird-daily-01.mp3",
  },
  {
    id: "wird-quran-01",
    name: "لا تنسَ وِردك من القرآن",
    hint: "نداء صوتي",
    url: "/audio/reminders/wird-quran-01.mp3",
  },
  {
    id: "azkar-general-01",
    name: "لا تنسَ الأذكار",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-general-01.mp3",
  },
  {
    id: "azkar-general-02",
    name: "وقت الذكر",
    hint: "نداء صوتي",
    url: "/audio/reminders/azkar-general-02.mp3",
  },
  { id: "silent", name: "صامت", hint: "إشعار بلا صوت", url: "" },
] as const;

export type ReminderToneId = (typeof REMINDER_TONES)[number]["id"];

export function toneUrl(id: ReminderToneId): string {
  return REMINDER_TONES.find((t) => t.id === id)?.url ?? "";
}

export function toneName(id: ReminderToneId): string {
  return REMINDER_TONES.find((t) => t.id === id)?.name ?? "صامت";
}

/** أي أيام الأسبوع يعمل فيها التذكير — ٠ الأحد … ٦ السبت (كـ`Date.getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** أسماء الأيام مرتّبة كما تُعرض في الواجهة العربية: السبت أولاً. */
export const WEEKDAY_ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5];
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "أحد",
  1: "اثنين",
  2: "ثلاثاء",
  3: "أربعاء",
  4: "خميس",
  5: "جمعة",
  6: "سبت",
};

/**
 * توقيت التذكير: إمّا ساعة ثابتة، أو منسوب إلى صلاة فيتحرّك معها يومياً.
 *
 * النسبة إلى صلاة هي الطلب الحقيقي: من يريد وِرده «بعد الفجر» لا يريده الساعة
 * الخامسة — لأن الفجر يتقدّم ويتأخّر نحو ساعة على مدار السنة.
 */
export type ReminderTiming =
  | { mode: "clock"; hour: number; minute: number }
  | { mode: "prayer"; prayer: PrayerKey; offset: number };

export type DailyReminder = {
  id: string;
  /** اسم يظهر للمستخدم؛ التذكيرات المبنيّة لها أسماء ثابتة. */
  name: string;
  enabled: boolean;
  timing: ReminderTiming;
  tone: ReminderToneId;
  days: Weekday[];
  /** المسار الذي يُفتح عند لمس الإشعار. */
  route: string;
  /** نصّ الإشعار. */
  body: string;
};

export type DailyRemindersState = {
  /** مفتاح عام يُسكِت كل هذه التذكيرات دون فقدان إعداداتها. */
  enabled: boolean;
  items: DailyReminder[];
};

/* التذكيرات المبنيّة افتراضياً. أوقاتها منسوبة إلى الصلاة لا إلى الساعة،
 * لأن أذكار الصباح بعد الفجر وأذكار المساء بعد العصر هي المعروف شرعاً. */
export const DEFAULT_REMINDERS: DailyReminder[] = [
  {
    id: "azkar-morning",
    name: "أذكار الصباح",
    enabled: true,
    timing: { mode: "prayer", prayer: "fajr", offset: 45 },
    tone: "azkar-morning",
    days: [...ALL_DAYS],
    route: "/azkar",
    body: "حان وقت أذكار الصباح",
  },
  {
    id: "azkar-evening",
    name: "أذكار المساء",
    enabled: true,
    timing: { mode: "prayer", prayer: "asr", offset: 30 },
    tone: "azkar-evening",
    days: [...ALL_DAYS],
    route: "/azkar",
    body: "حان وقت أذكار المساء",
  },
  {
    id: "wird",
    name: "الوِرد اليومي",
    enabled: true,
    timing: { mode: "prayer", prayer: "fajr", offset: 20 },
    tone: "wird",
    days: [...ALL_DAYS],
    route: "/wird",
    body: "وِردك من القرآن ينتظرك",
  },
  {
    id: "wird-night",
    name: "وِرد قبل النوم",
    enabled: false,
    timing: { mode: "prayer", prayer: "isha", offset: 60 },
    tone: "reminder-bell",
    days: [...ALL_DAYS],
    route: "/wird",
    body: "أذكار النوم ووِرد الليل",
  },
  {
    id: "sleep-azkar",
    name: "أذكار النوم",
    enabled: false,
    timing: { mode: "clock", hour: 22, minute: 30 },
    tone: "reminder-chime",
    days: [...ALL_DAYS],
    route: "/azkar",
    body: "لا تنم قبل أذكار النوم",
  },
];

const DEFAULTS: DailyRemindersState = { enabled: true, items: DEFAULT_REMINDERS };

const KEY = "manar.daily-reminders.v1";
const EVENT = "manar:daily-reminders";

/* -------------------------------- حراسة -------------------------------- */

function clampInt(v: unknown, lo: number, hi: number, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.trunc(n))) : fb;
}

function normalizeTiming(raw: unknown, fb: ReminderTiming): ReminderTiming {
  const t = raw as Partial<ReminderTiming> | undefined;
  if (t?.mode === "clock") {
    return {
      mode: "clock",
      hour: clampInt((t as { hour?: unknown }).hour, 0, 23, 6),
      minute: clampInt((t as { minute?: unknown }).minute, 0, 59, 0),
    };
  }
  if (t?.mode === "prayer") {
    const p = (t as { prayer?: unknown }).prayer;
    return {
      mode: "prayer",
      prayer: (typeof p === "string" && p in PRAYER_LABELS ? p : "fajr") as PrayerKey,
      offset: clampInt((t as { offset?: unknown }).offset, -120, 240, 0),
    };
  }
  return fb;
}

function normalizeItem(raw: unknown, fb: DailyReminder): DailyReminder {
  const r = (raw ?? {}) as Partial<DailyReminder>;
  const days = Array.isArray(r.days)
    ? (r.days.filter((d) => ALL_DAYS.includes(d as Weekday)) as Weekday[])
    : fb.days;
  return {
    id: fb.id,
    name: typeof r.name === "string" && r.name.trim() ? r.name : fb.name,
    enabled: typeof r.enabled === "boolean" ? r.enabled : fb.enabled,
    timing: normalizeTiming(r.timing, fb.timing),
    tone: REMINDER_TONES.some((t) => t.id === r.tone) ? (r.tone as ReminderToneId) : fb.tone,
    /* قائمة أيام فارغة تعني تذكيراً لا يعمل أبداً وهو غالباً خطأ حفظ، فنرجع
     * للأيام الافتراضية بدل إسكات التذكير بلا سبب ظاهر للمستخدم. */
    days: days.length ? days : fb.days,
    route: fb.route,
    body: fb.body,
  };
}

export function readReminders(): DailyRemindersState {
  if (typeof window === "undefined") return DEFAULTS;
  let parsed: { enabled?: unknown; items?: unknown } = {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    return DEFAULTS;
  }
  const stored = Array.isArray(parsed.items) ? (parsed.items as Partial<DailyReminder>[]) : [];
  /* نبني القائمة من التذكيرات المعروفة لا من المحفوظ: هكذا يحصل من حدّث
   * التطبيق على أي تذكير جديد، ولا يبقى في تخزينه تذكير أُزيل من الشيفرة. */
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
    items: DEFAULT_REMINDERS.map((d) =>
      normalizeItem(
        stored.find((s) => s?.id === d.id),
        d,
      ),
    ),
  };
}

export function writeReminders(next: DailyRemindersState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDailyReminders() {
  const [state, setState] = useState<DailyRemindersState>(DEFAULTS);

  useEffect(() => {
    const sync = () => setState(readReminders());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const commit = (next: DailyRemindersState) => {
    setState(next);
    writeReminders(next);
  };

  const setEnabled = (enabled: boolean) => commit({ ...readReminders(), enabled });

  const patch = (id: string, p: Partial<DailyReminder>) => {
    const cur = readReminders();
    commit({
      ...cur,
      items: cur.items.map((it) => (it.id === id ? { ...it, ...p } : it)),
    });
  };

  const toggleDay = (id: string, day: Weekday) => {
    const cur = readReminders();
    const item = cur.items.find((i) => i.id === id);
    if (!item) return;
    const has = item.days.includes(day);
    const days = has ? item.days.filter((d) => d !== day) : [...item.days, day];
    /* لا نسمح بإفراغ القائمة كلها: التذكير الذي لا يعمل في أي يوم مُربِك —
     * إسكاته يكون بمفتاحه لا بحذف أيامه واحداً واحداً. */
    if (!days.length) return;
    patch(id, { days: days.sort((a, b) => a - b) });
  };

  const reset = () => commit(DEFAULTS);

  return { state, setEnabled, patch, toggleDay, reset };
}

/* ------------------------------ الحساب ------------------------------ */

/**
 * وقت التذكير في يوم بعينه.
 *
 * `prayerTimeFor` تُمرَّر من الخارج فتُغني هذه الوحدة عن معرفة الموقع وطريقة
 * الحساب، وتبقى قابلة للاختبار وحدها.
 */
export function reminderTimeOn(
  r: DailyReminder,
  date: Date,
  prayerTimeFor: (p: PrayerKey, d: Date) => Date,
): Date | null {
  if (!r.days.includes(date.getDay() as Weekday)) return null;
  if (r.timing.mode === "clock") {
    const d = new Date(date);
    d.setHours(r.timing.hour, r.timing.minute, 0, 0);
    return d;
  }
  const base = prayerTimeFor(r.timing.prayer, date);
  return new Date(base.getTime() + r.timing.offset * 60_000);
}

/** وصف التوقيت للعرض — نصّ واحد يفهمه المستخدم بلا شرح. */
export function describeTiming(t: ReminderTiming, digits: (s: string | number) => string): string {
  if (t.mode === "clock") {
    const h24 = t.hour;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const suffix = h24 < 12 ? "صباحاً" : "مساءً";
    return `${digits(h12)}:${digits(String(t.minute).padStart(2, "0"))} ${suffix}`;
  }
  const label = PRAYER_LABELS[t.prayer].ar;
  if (t.offset === 0) return `مع ${label}`;
  const mins = Math.abs(t.offset);
  const unit =
    mins % 60 === 0 && mins >= 60
      ? `${digits(mins / 60)} ${mins === 60 ? "ساعة" : "ساعات"}`
      : `${digits(mins)} دقيقة`;
  return t.offset > 0 ? `بعد ${label} بـ${unit}` : `قبل ${label} بـ${unit}`;
}
