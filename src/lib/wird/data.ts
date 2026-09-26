// ============================================================
// Manar — Wird Module (قسم «الوِرد») — يشارك الأذكار مصدر النص
// بيانات ثابتة مضمّنة داخل التطبيق (تعمل بدون إنترنت).
// نصوص الأذكار تُؤخذ من «حصن المسلم» (الباب ٢٧) عبر hisn-texts.ts
// المُولَّد آليًا، فلا يختلف نص الوِرد عن نص قسم الأذكار.
// ============================================================

import { HISN_WIRD_TEXTS } from "./hisn-texts";

export type WirdSessionKey = "morning" | "evening";

export interface WirdItem {
  /** ترتيب الذكر داخل الوِرد (١..ن) */
  order: number;
  /** اسم الذكر (يُعرض فوق النص) */
  name: string;
  /** نص الذكر كاملًا — بدون رقم التكرار وبدون مصدر */
  text: string;
  /** عدد التكرار المطلوب */
  repeat: number;
  /** رقم الذكر في «حصن المسلم» إن كان منه (النص يُؤخذ منه حرفيًا). */
  hisn?: number;
  /** نص قرآني (آية الكرسي والمعوذات) — وحده يُعرض بخط المصحف. */
  quran?: boolean;
  /**
   * لفظ الذكر المأخوذ من الحصن: «m» الصباح أو «e» المساء. قد يخالف وقت الوِرد
   * (التهليل التام #93 بلفظ الصباح في الوِردين).
   */
  slot?: "m" | "e";
}

export interface WirdSession {
  key: WirdSessionKey;
  title: string;
  description: string;
  items: WirdItem[];
}

type Slot = "m" | "e";

/** أذكار الباب ٢٧ القرآنية: آية الكرسي (#75) والمعوذات (#76). */
const QURAN_HISN = new Set([75, 76]);

/** نص ذكر من الباب ٢٧ في «حصن المسلم» — مصدر واحد للنص مع قسم الأذكار. */
function hisn(id: number, slot: Slot, name: string, repeat: number): WirdItem {
  const text = HISN_WIRD_TEXTS[`${id}:${slot}`];
  if (!text) throw new Error(`wird: الذكر ${id}:${slot} غير موجود في الباب ٢٧`);
  return {
    order: 0,
    name,
    text,
    repeat,
    hisn: id,
    slot,
    ...(QURAN_HISN.has(id) ? { quran: true } : {}),
  };
}

/** أذكار ليست في «حصن المسلم» — أُبقيت في الوِرد باعتماد صاحب التطبيق. */
const EXTRA_TAHMID: WirdItem = {
  order: 0,
  name: "الحمد لله",
  text: "«الْحَمْدُ لِلَّهِ»",
  repeat: 100,
};
const EXTRA_TAKBIR: WirdItem = {
  order: 0,
  name: "الله أكبر",
  text: "«اللَّهُ أَكْبَرُ»",
  repeat: 100,
};

function numbered(items: WirdItem[]): WirdItem[] {
  return items.map((it, i) => ({ ...it, order: i + 1 }));
}

/** الأذكار المشتركة بين الوِردين بلفظ الوقت المناسب. */
function common(slot: Slot): WirdItem[] {
  return [
    hisn(75, slot, "آية الكرسي", 1),
    hisn(76, slot, "الإخلاص والمعوذتان", 3),
    hisn(77, slot, "دعاء الملك لله", 1),
    hisn(78, slot, slot === "m" ? "دعاء الصباح" : "دعاء المساء", 1),
    hisn(79, slot, "سيد الاستغفار", 1),
    hisn(80, slot, "دعاء الإشهاد", 4),
    hisn(81, slot, "شكر النعمة", 1),
    hisn(82, slot, "دعاء العافية والاستعاذة من الكفر والفقر", 3),
    hisn(83, slot, "التوكل والكفاية", 7),
    hisn(84, slot, "سؤال العفو والعافية", 1),
    hisn(85, slot, "دعاء فاطر السماوات", 1),
    hisn(86, slot, "الحفظ من الضر", 3),
    hisn(87, slot, "الرضا بالله", 3),
    hisn(88, slot, "الاستغاثة بالحي القيوم", 1),
    hisn(89, slot, slot === "m" ? "سؤال خير اليوم" : "سؤال خير الليلة", 1),
    hisn(90, slot, "الفطرة", 1),
    hisn(91, slot, "سبحان الله وبحمده", 100),
    EXTRA_TAHMID,
    EXTRA_TAKBIR,
    // في الحصن «إذا أصبح»، وحديث البخاري «في يوم» — أُبقي في الوِردين باعتماد صاحب التطبيق.
    hisn(93, "m", "التهليل التام", 100),
    hisn(96, slot, "الاستغفار", 100),
    hisn(92, slot, "التهليل عشرًا", 10),
  ];
}

const MORNING_ITEMS = numbered([
  ...common("m"),
  hisn(94, "m", "تسبيح عدد الخلق", 3),
  hisn(95, "m", "سؤال العلم والرزق", 1),
  hisn(98, "m", "الصلاة على النبي ﷺ", 10),
]);

const EVENING_ITEMS = numbered([
  ...common("e"),
  hisn(97, "e", "الاستعاذة بكلمات الله", 3),
  hisn(98, "e", "الصلاة على النبي ﷺ", 10),
]);

export const WIRD_SESSIONS: Record<WirdSessionKey, WirdSession> = {
  morning: {
    key: "morning",
    title: "ورد الصباح",
    description: "أذكار وورد الصباح",
    items: MORNING_ITEMS,
  },
  evening: {
    key: "evening",
    title: "ورد المساء",
    description: "أذكار وورد المساء",
    items: EVENING_ITEMS,
  },
};

export const WIRD_SESSION_KEYS: WirdSessionKey[] = ["morning", "evening"];

export function getWirdSession(key: string): WirdSession | null {
  return key === "morning" || key === "evening" ? WIRD_SESSIONS[key] : null;
}
