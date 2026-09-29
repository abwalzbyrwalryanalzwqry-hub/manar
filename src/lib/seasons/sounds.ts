/* منار — أصوات «تنبيهات المواسم» وحدها.
 *
 * حزمة مستقلة في `public/audio/seasons/` بقنوات إشعار ببادئتها الخاصة
 * (`manar_season_`)، فلا تختلط بنداءات الأذكار ولا بتنبيهات ما قبل الصلاة.
 * تسجيلات صاحب المشروع بصوته (انظر docs/audio/seasons.md).
 *
 * كل تنبيه موسمي يأخذ صوته من `SEASON_SOUND_BY_REMINDER` بمفتاح
 * «الموسم/التنبيه». ما لا صوت خاصاً له يأخذ أحد الصوتين الاحتياطيين:
 *   - `new`     «موسم جديد في منار»: لتنبيهات اقتراب موسم أو دخوله.
 *   - `general` الصوت الاحتياطي العام: لكل ما سواها، ولأي تنبيه يُضاف لاحقاً.
 */

export type SeasonSound = { name: string; url: string };

export const SEASON_SOUNDS = {
  general: {
    name: "الصوت الاحتياطي العام للمواسم",
    url: "/audio/seasons/season-general.mp3",
  },
  new: { name: "موسم جديد في منار", url: "/audio/seasons/season-new.mp3" },
  "friday-eve": {
    name: "غدًا الجمعة، فأكثر من الصلاة على النبي ﷺ",
    url: "/audio/seasons/season-friday-eve.mp3",
  },
  "friday-day": {
    name: "جمعة مباركة، لا تنسَ سورة الكهف",
    url: "/audio/seasons/season-friday-day.mp3",
  },
  "fast-eve": { name: "غدًا يوم يُستحبّ صيامه", url: "/audio/seasons/season-fast-eve.mp3" },
  "white-days-eve": {
    name: "غدًا أول الأيام البيض",
    url: "/audio/seasons/season-white-days-eve.mp3",
  },
} as const satisfies Record<string, SeasonSound>;

export type SeasonSoundId = keyof typeof SEASON_SOUNDS;

/** الصوت الافتراضي لما لا صوت محدّد له. */
export const DEFAULT_SEASON_SOUND: SeasonSoundId = "general";

/** صوت كل تنبيه موسمي بمفتاح `<معرّف الموسم>/<معرّف التنبيه>`. */
export const SEASON_SOUND_BY_REMINDER: Record<string, SeasonSoundId> = {
  // تسجيلات خاصة
  "friday/eve": "friday-eve",
  "friday/day": "friday-day",
  "monday-thursday/eve": "fast-eve",
  "white-days/eve": "white-days-eve",
  // اقتراب موسم أو دخوله ← «موسم جديد في منار»
  "ramadan/d-7": "new",
  "ramadan/d-3": "new",
  "ramadan/d-1": "new",
  "ramadan/first": "new",
  "shaban/first": "new",
  "dhul-hijjah/d-1": "new",
  "dhul-hijjah/first": "new",
  "muharram/new-year": "new",
  // بقية التنبيهات ← الصوت الاحتياطي العام
  "ramadan/last-ten": "general",
  "ramadan/zakat-fitr": "general",
  "dhul-hijjah/arafah": "general",
  "muharram/ashura": "general",
  "shawwal/eid": "general",
  "shawwal/six": "general",
  "dhul-hijjah/arafah-eve": "general",
  "dhul-hijjah/adha-eve": "general",
  "muharram/ashura-eve": "general",
};

/** صوت تنبيه موسمي، والاحتياطي العام لما لم يُحدَّد. */
export function seasonSoundFor(seasonId: string, reminderId: string): SeasonSoundId {
  return SEASON_SOUND_BY_REMINDER[`${seasonId}/${reminderId}`] ?? DEFAULT_SEASON_SOUND;
}

export function seasonSoundUrl(id: SeasonSoundId): string {
  return SEASON_SOUNDS[id].url;
}
