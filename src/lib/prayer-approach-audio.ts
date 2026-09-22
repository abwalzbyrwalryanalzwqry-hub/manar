/* منار — أصوات «التنبيهات قبل الصلاة» وحدها.
 *
 * فهرسٌ مستقل عن أصوات «تذكيرات الأذكار والوِرد» (`REMINDER_TONES` في
 * src/lib/daily-reminders.ts): لا يستورد أحدهما الآخر، ولكلٍّ منهما قنوات
 * إشعار ببادئة مختلفة، فلا يمكن أن يظهر صوتٌ من إحدى الحزمتين في قسم الأخرى.
 *
 * كل مقطع في هذه الحزمة يُسمّي صلاةً بعينها («اقتربت صلاة العصر»)، فلا يصحّ
 * أن يُختار مقطعٌ واحد لكل الصلوات. الخيار «اقتربت الصلاة» يعني: لكل صلاة
 * مقطعها الذي يحمل اسمها.
 */

import type { PrayerKey } from "./prayer";

export const PRAYER_APPROACH_AUDIO_CATEGORY = "prayer_approach";

export type ApproachPrayer = Exclude<PrayerKey, "sunrise">;

/** مقاطع الحزمة — واحد لكل صلاة. */
export const PRAYER_APPROACH_CLIPS: Record<
  ApproachPrayer,
  { id: string; name: string; url: string }
> = {
  fajr: {
    id: "approach-fajr",
    name: "اقتربت صلاة الفجر",
    url: "/audio/prayer-approach/approach-fajr.mp3",
  },
  dhuhr: {
    id: "approach-dhuhr",
    name: "اقتربت صلاة الظهر",
    url: "/audio/prayer-approach/approach-dhuhr.mp3",
  },
  asr: {
    id: "approach-asr",
    name: "اقتربت صلاة العصر",
    url: "/audio/prayer-approach/approach-asr.mp3",
  },
  maghrib: {
    id: "approach-maghrib",
    name: "اقتربت صلاة المغرب",
    url: "/audio/prayer-approach/approach-maghrib.mp3",
  },
  isha: {
    id: "approach-isha",
    name: "اقتربت صلاة العشاء",
    url: "/audio/prayer-approach/approach-isha.mp3",
  },
};

/**
 * خيارات «صوت التنبيه» في قسم التنبيهات قبل الصلاة.
 *
 * `default` هو ما كان التطبيق يُشغّله قبل هذه الإضافة (قناة `manar_reminders`
 * بصوت التكبير) — يبقى الافتراضي فلا يتغيّر شيء لمن لم يختر غيره.
 */
export const PRAYER_APPROACH_SOUNDS = [
  {
    id: "default",
    name: "التكبير",
    hint: "الصوت الافتراضي",
    url: "/audio/library/segment-takbir.mp3",
  },
  {
    id: "approach-voice",
    name: "اقتربت الصلاة",
    hint: "نداء صوتي باسم كل صلاة",
    url: "",
  },
] as const;

export type PrayerApproachSoundId = (typeof PRAYER_APPROACH_SOUNDS)[number]["id"];

export const DEFAULT_PRAYER_APPROACH_SOUND: PrayerApproachSoundId = "default";

/** قيمة محفوظة غير معروفة (تخزين تالف أو إصدار أقدم) تعود للافتراضي بدل أن تُسقط التنبيه. */
export function normalizeApproachSound(v: unknown): PrayerApproachSoundId {
  return PRAYER_APPROACH_SOUNDS.some((s) => s.id === v)
    ? (v as PrayerApproachSoundId)
    : DEFAULT_PRAYER_APPROACH_SOUND;
}

/** المقطع الذي يُسمَع قبل صلاة بعينها، أو `null` إن كان الاختيار هو الافتراضي. */
export function approachClipFor(
  sound: PrayerApproachSoundId,
  prayer: PrayerKey,
): { id: string; name: string; url: string } | null {
  if (sound !== "approach-voice" || prayer === "sunrise") return null;
  return PRAYER_APPROACH_CLIPS[prayer] ?? null;
}

/** رابط المعاينة لخيار ما — للخيار الصوتي نُسمِع مقطع الصلاة المُمرَّرة. */
export function approachPreviewUrl(sound: PrayerApproachSoundId, prayer: ApproachPrayer): string {
  const clip = approachClipFor(sound, prayer);
  if (clip) return clip.url;
  return PRAYER_APPROACH_SOUNDS.find((s) => s.id === sound)?.url ?? "";
}
