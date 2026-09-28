/* منار — صلاة الجمعة.
 *
 * قسم مستقل يخص الجمعة وحدها: موعدها (أذانها هو وقت الظهر يوم الجمعة)،
 * وإقامتها بفاصلها الخاص من إعدادات الإقامة، وسننها (الغسل، التبكير، الكهف،
 * الصلاة على النبي ﷺ، ساعة الإجابة)، وسجلّ حضورها.
 *
 * القاعدة: **لا يُحتسب شيء إلا يوم الجمعة.** التسجيل مسموح فقط حين يكون يوم
 * الصلاة الشرعي (من الفجر إلى الفجر) جمعةً. بقية الأيام تعرض موعد الجمعة
 * القادمة فقط.
 *
 * الدوال الحسابية نقيّة (تأخذ التاريخ والمواقيت) لتُختبر بلا متصفح.
 */

import { useCallback, useEffect, useState } from "react";
import { computePrayerTimes, type LocationState, type Settings } from "./prayer";
import { dayKey, prayerDayKey, recordPrayer, shiftDayKey } from "./activity-log";
import { iqamahTimeFor } from "./prayer-schedule";
import type { AdhanSettings } from "./adhan-settings";
import { durationAr } from "./notification-text";

export const JUMUAH_KEY = "manar.jumuah.v1";
export const JUMUAH_EVENT = "manar:jumuah";

/** أقصى عدد جُمَع محفوظة (سنتان). */
const MAX_FRIDAYS = 104;

export type JumuahDeedId = "attended" | "ghusl" | "early" | "kahf" | "salawat" | "dua";

export const JUMUAH_DEEDS: { id: JumuahDeedId; title: string; hint: string }[] = [
  { id: "attended", title: "صليت الجمعة", hint: "تُحتسب معها صلاة الظهر في سجلّك" },
  { id: "ghusl", title: "الغسل والطيب", hint: "قبل الخروج إلى الصلاة" },
  { id: "early", title: "التبكير إلى المسجد", hint: "قبل دخول الإمام" },
  { id: "kahf", title: "قراءة سورة الكهف", hint: "من مغرب الخميس إلى مغرب الجمعة" },
  { id: "salawat", title: "الإكثار من الصلاة على النبي ﷺ", hint: "طوال اليوم" },
  { id: "dua", title: "الدعاء في ساعة الإجابة", hint: "آخر ساعة قبل المغرب" },
];

export type JumuahDay = Partial<Record<JumuahDeedId, boolean>>;

export type JumuahPrefs = {
  /** «الجمعة» بدل «الظهر» في جدول الصلوات يوم الجمعة، مع تسجيل الحضور منه. */
  showInList: boolean;
  /** كم دقيقة قبل الأذان يُنبَّه للتبكير. */
  earlyMinutes: number;
  remindEarly: boolean;
  remindKahf: boolean;
  remindHour: boolean;
};

export type JumuahStore = { prefs: JumuahPrefs; days: Record<string, JumuahDay> };

export const EARLY_OPTIONS = [30, 45, 60, 90, 120] as const;

export const DEFAULT_JUMUAH_PREFS: JumuahPrefs = {
  showInList: true,
  earlyMinutes: 60,
  remindEarly: true,
  remindKahf: true,
  remindHour: false,
};

const DEFAULT_STORE: JumuahStore = { prefs: DEFAULT_JUMUAH_PREFS, days: {} };

/* ------------------------------------------------------------------ */
/*  التواريخ                                                           */
/* ------------------------------------------------------------------ */

const FRIDAY = 5;

export function isFriday(d: Date): boolean {
  return d.getDay() === FRIDAY;
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** مفتاح الجمعة القادمة (أو اليوم إن كان جمعة). */
export function nextFridayKey(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  d.setDate(d.getDate() + ((FRIDAY - d.getDay() + 7) % 7));
  return dayKey(d);
}

/**
 * مفتاح الجمعة التي يجوز التسجيل لها الآن، أو null.
 *
 * يوم الصلاة من الفجر إلى الفجر: ليلة السبت قبل الفجر ما زالت تُحسب للجمعة،
 * وليلة الجمعة قبل الفجر ما زالت للخميس فلا تسجيل فيها.
 */
export function markableFridayKey(now: Date, fajrToday?: Date | null): string | null {
  const key = prayerDayKey(now, fajrToday);
  return isFriday(fromKey(key)) ? key : null;
}

/* ------------------------------------------------------------------ */
/*  الجدول الزمني للجمعة                                              */
/* ------------------------------------------------------------------ */

export type JumuahTimeline = {
  /** مفتاح الجمعة `YYYY-MM-DD`. */
  key: string;
  date: Date;
  /** وقت التبكير المقترح (قبل الأذان بـ`earlyMinutes`). */
  earlyAt: Date;
  /** الأذان = وقت الظهر يوم الجمعة، وتبدأ معه الخطبة. */
  adhanAt: Date;
  /** الإقامة بفاصل الجمعة، أو null إن كانت إقامة الجمعة مطفأة. */
  iqamaAt: Date | null;
  /** نافذة سورة الكهف: من مغرب الخميس إلى مغرب الجمعة. */
  kahfFrom: Date;
  kahfTo: Date;
  /** ساعة الإجابة: آخر ساعة قبل المغرب (لا تبدأ قبل العصر). */
  hourFrom: Date;
  hourTo: Date;
};

export function jumuahTimeline(
  key: string,
  location: LocationState,
  calc: Settings,
  adhan: AdhanSettings,
  prefs: JumuahPrefs,
): JumuahTimeline {
  const date = fromKey(key);
  const fri = computePrayerTimes(location, calc, date);
  const thu = computePrayerTimes(location, calc, fromKey(shiftDayKey(key, -1)));
  const early = Math.max(0, Math.round(prefs.earlyMinutes));
  const lastHour = new Date(fri.maghrib.getTime() - 60 * 60_000);
  return {
    key,
    date,
    earlyAt: new Date(fri.dhuhr.getTime() - early * 60_000),
    adhanAt: fri.dhuhr,
    iqamaAt: iqamahTimeFor(adhan, "dhuhr", fri.dhuhr),
    kahfFrom: thu.maghrib,
    kahfTo: fri.maghrib,
    hourFrom: lastHour > fri.asr ? lastHour : fri.asr,
    hourTo: fri.maghrib,
  };
}

/* ------------------------------------------------------------------ */
/*  الإحصاء                                                            */
/* ------------------------------------------------------------------ */

export type JumuahStats = {
  /** جُمَع متتالية حضرها، تنتهي بآخر جمعة مضت أو بجمعة اليوم إن سُجّلت. */
  streak: number;
  /** حضوره في آخر ١٢ جمعة. */
  last12: number;
  /** آخر ٨ جُمَع من الأقدم إلى الأحدث. */
  recent: { key: string; attended: boolean; deeds: number }[];
  total: number;
};

/** آخر جمعة انقضى يومها أو جمعة اليوم. */
function latestFridayKey(todayKey: string): string {
  const d = fromKey(todayKey);
  d.setDate(d.getDate() - ((d.getDay() - FRIDAY + 7) % 7));
  return dayKey(d);
}

export function jumuahStats(days: Record<string, JumuahDay>, todayKey: string): JumuahStats {
  const latest = latestFridayKey(todayKey);
  // جمعة اليوم لم تُسجَّل بعد لا تقطع السلسلة.
  let cursor = latest === todayKey && !days[latest]?.attended ? shiftDayKey(latest, -7) : latest;
  let streak = 0;
  while (days[cursor]?.attended) {
    streak += 1;
    cursor = shiftDayKey(cursor, -7);
  }
  const recent: JumuahStats["recent"] = [];
  let last12 = 0;
  for (let i = 11; i >= 0; i -= 1) {
    const k = shiftDayKey(latest, -7 * i);
    const d = days[k] ?? {};
    if (d.attended) last12 += 1;
    if (i < 8) {
      recent.push({
        key: k,
        attended: !!d.attended,
        deeds: JUMUAH_DEEDS.filter((x) => d[x.id]).length,
      });
    }
  }
  const total = Object.values(days).filter((d) => d.attended).length;
  return { streak, last12, recent, total };
}

/* ------------------------------------------------------------------ */
/*  التخزين                                                            */
/* ------------------------------------------------------------------ */

const isKey = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);

export function normalizeJumuah(raw: unknown): JumuahStore {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<JumuahStore>;
  const p = (r.prefs ?? {}) as Partial<JumuahPrefs>;
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  const early = Number(p.earlyMinutes);
  const prefs: JumuahPrefs = {
    showInList: bool(p.showInList, DEFAULT_JUMUAH_PREFS.showInList),
    earlyMinutes: (EARLY_OPTIONS as readonly number[]).includes(early)
      ? early
      : DEFAULT_JUMUAH_PREFS.earlyMinutes,
    remindEarly: bool(p.remindEarly, DEFAULT_JUMUAH_PREFS.remindEarly),
    remindKahf: bool(p.remindKahf, DEFAULT_JUMUAH_PREFS.remindKahf),
    remindHour: bool(p.remindHour, DEFAULT_JUMUAH_PREFS.remindHour),
  };
  const days: Record<string, JumuahDay> = {};
  for (const [k, v] of Object.entries(r.days ?? {})) {
    // يوم غير جمعة لا يُقبل حتى من ملف مستورد.
    if (!isKey(k) || !isFriday(fromKey(k)) || !v || typeof v !== "object") continue;
    const day: JumuahDay = {};
    for (const d of JUMUAH_DEEDS) if ((v as JumuahDay)[d.id] === true) day[d.id] = true;
    if (Object.keys(day).length) days[k] = day;
  }
  return { prefs, days };
}

export function readJumuah(): JumuahStore {
  if (typeof window === "undefined") return DEFAULT_STORE;
  try {
    const raw = window.localStorage.getItem(JUMUAH_KEY);
    return raw ? normalizeJumuah(JSON.parse(raw)) : DEFAULT_STORE;
  } catch {
    return DEFAULT_STORE;
  }
}

function writeJumuah(next: JumuahStore) {
  if (typeof window === "undefined") return;
  const keys = Object.keys(next.days).sort();
  const days = { ...next.days };
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_FRIDAYS))) delete days[k];
  try {
    window.localStorage.setItem(JUMUAH_KEY, JSON.stringify({ ...next, days }));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(JUMUAH_EVENT));
}

/**
 * يقلب عملاً في جمعة `key`. يرفض أي يوم ليس جمعة. «صليت الجمعة» يسجّل صلاة
 * الظهر في السجل اليومي أيضاً (الجمعة تُغني عن الظهر) أو يلغيها.
 */
export function toggleJumuahDeed(key: string, id: JumuahDeedId, value?: boolean): boolean {
  if (!isKey(key) || !isFriday(fromKey(key))) return false;
  const cur = readJumuah();
  const day = { ...(cur.days[key] ?? {}) };
  const next = value ?? !day[id];
  if (next) day[id] = true;
  else delete day[id];
  const days = { ...cur.days };
  if (Object.keys(day).length) days[key] = day;
  else delete days[key];
  writeJumuah({ ...cur, days });
  if (id === "attended") recordPrayer("dhuhr", next, fromKey(key));
  return true;
}

export function patchJumuahPrefs(p: Partial<JumuahPrefs>) {
  const cur = readJumuah();
  writeJumuah({ ...cur, prefs: normalizeJumuah({ prefs: { ...cur.prefs, ...p } }).prefs });
}

export function useJumuah() {
  const [store, setStore] = useState<JumuahStore>(DEFAULT_STORE);
  useEffect(() => {
    const sync = () => setStore(readJumuah());
    sync();
    window.addEventListener(JUMUAH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(JUMUAH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return {
    store,
    toggle: useCallback(
      (key: string, id: JumuahDeedId, value?: boolean) => toggleJumuahDeed(key, id, value),
      [],
    ),
    patchPrefs: useCallback((p: Partial<JumuahPrefs>) => patchJumuahPrefs(p), []),
  };
}

/* ------------------------------------------------------------------ */
/*  تنبيهات الجمعة                                                     */
/* ------------------------------------------------------------------ */

export type JumuahReminder = {
  /** ترتيب ثابت داخل الجمعة: ٠ الكهف، ١ التبكير، ٢ ساعة الإجابة. */
  slot: 0 | 1 | 2;
  key: string;
  at: Date;
  title: string;
  body: string;
};

/**
 * تنبيهات الجُمَع الواقعة بين `now` و`now + days`. ما أُنجز من عمل لا يُذكَّر به.
 * الكهف: بعد الشروق بساعة ونصف. التبكير: قبل الأذان بالمدة المختارة. ساعة
 * الإجابة: عند بدايتها.
 */
export function planJumuahReminders(o: {
  now: number;
  days: number;
  store: JumuahStore;
  timelineFor: (key: string) => JumuahTimeline;
  sunriseFor: (key: string) => Date;
}): JumuahReminder[] {
  const { prefs, days: done } = o.store;
  const out: JumuahReminder[] = [];
  const start = new Date(o.now);
  for (let i = 0; i < o.days; i += 7) {
    const probe = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
    const key = nextFridayKey(probe);
    if (out.some((r) => r.key === key)) continue;
    const t = o.timelineFor(key);
    const d = done[key] ?? {};
    const add = (r: JumuahReminder) => {
      if (r.at.getTime() > o.now && r.at.getTime() < o.now + o.days * 86_400_000) out.push(r);
    };
    if (prefs.remindKahf && !d.kahf) {
      add({
        slot: 0,
        key,
        at: new Date(o.sunriseFor(key).getTime() + 90 * 60_000),
        title: "سورة الكهف",
        body: "يوم الجمعة: نور ما بين الجمعتين لمن قرأ سورة الكهف.",
      });
    }
    if (prefs.remindEarly && !d.early && !d.attended) {
      add({
        slot: 1,
        key,
        at: t.earlyAt,
        title: "التبكير إلى الجمعة",
        body: `يتبقّى ${minutesWord(prefs.earlyMinutes)} على أذان الجمعة. الغسل والطيب ثم المسجد.`,
      });
    }
    if (prefs.remindHour && !d.dua) {
      add({
        slot: 2,
        key,
        at: t.hourFrom,
        title: "ساعة الإجابة",
        body: "آخر ساعة من يوم الجمعة قبل المغرب: أكثر من الدعاء.",
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** مدة التنبيه المبكر: «ساعة»، «ساعة ونصف»، «ساعتان»، «٤٥ دقيقة». */
export function minutesWord(m: number): string {
  return durationAr(m);
}
