/* منار — مكتبة أصوات الإقامة.
 *
 * هذا الفهرس هو المصدر الوحيد لأصوات الإقامة، وهو منفصلٌ تماماً عن مكتبة الأذان
 * (`adhan-library-assets.ts`): لا يستورد منها شيئاً، ولا يشير أيّ معرّف هنا إلى
 * ملفّ أذان، ولا يوجد أيّ ربطٍ احتياطي من إقامةٍ إلى أذان. اختبار
 * `tests/unit/iqamah-library.test.ts` يُسقط البناء لو تسرّب مسار أذان إلى هنا.
 *
 * الملفات تسجيلاتٌ حقيقية مرفقة من المستخدم (حزمتان)، محفوظة محلياً في
 * `public/audio/iqamah/` وتُنسخ إلى `res/raw` عند بناء أندرويد
 * (scripts/sync-android-raw-audio.mjs) — فلا يمرّ تشغيلها بالشبكة أبداً.
 *
 *   iqamah_01 … iqamah_07  إقامة كاملة (Ogg Opus، أحادي، ‎~24–30 ك.ب/ث)
 *   iqamah_08 … iqamah_19  «قد قامت الصلاة» من الحرمين (AAC-LC في M4A، أحادي)
 *
 * لم يُعَد ترميز أيّ تسجيل: نُقلت التدفّقات الصوتية كما هي (stream copy)
 * وحُذفت منها البيانات الوصفية فقط، والصوت المفكوك مطابقٌ للأصل بتّاً ببتّ.
 *
 * الحقوق: موثّقة (VERIFIED) — تحقّق صاحب المشروع من حقوق استعمال هذه التسجيلات
 * ونشرها داخل منار ووثّقها (docs/audio/licenses.json).
 */

const DIR = "/audio/iqamah";

export type IqamahGroup = "full" | "qad";

export type IqamahSound = {
  /** المعرّف البرمجي الثابت — وهو نفسه اسم الملف واسم مورد أندرويد. */
  id: IqamahId;
  url: string;
  /** الاسم الظاهر للمستخدم. */
  name: string;
  hint: string;
  group: IqamahGroup;
  durationSec: number;
  format: "ogg" | "m4a";
  bytes: number;
  /** اسم المؤذن أو المسجد إن كان موثّقاً — يظهر في الاسم بدل رقم الصوت. */
  reciter?: string;
};

export const IQAMAH_IDS = [
  "iqamah_01",
  "iqamah_02",
  "iqamah_03",
  "iqamah_04",
  "iqamah_05",
  "iqamah_06",
  "iqamah_07",
  "iqamah_08",
  "iqamah_09",
  "iqamah_10",
  "iqamah_11",
  "iqamah_12",
  "iqamah_13",
  "iqamah_14",
  "iqamah_15",
  "iqamah_16",
  "iqamah_17",
  "iqamah_18",
  "iqamah_19",
] as const;

export type IqamahId = (typeof IQAMAH_IDS)[number];

export const DEFAULT_IQAMAH: IqamahId = "iqamah_01";

const AR = (n: number | string) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/* الإقامات الكاملة السبع لا يوثّق المستودع اسم مؤذنها ولا مسجدها (الحزمة وصلت
 * بلا بيانات وصفية)، فتبقى بأرقامها. متى عُرف الاسم يُمرَّر `reciter` فيظهر في
 * الواجهة بدل الرقم، ويظهر في الوصف مع المدّة. */
const full = (n: number, durationSec: number, bytes: number, reciter?: string): IqamahSound => {
  const id = `iqamah_0${n}` as IqamahId;
  return {
    id,
    url: `${DIR}/${id}.ogg`,
    name: reciter ? `إقامة الصلاة — ${reciter}` : `إقامة الصلاة — الصوت ${AR(n)}`,
    hint: reciter ? `إقامة كاملة · ${reciter}` : "إقامة كاملة",
    ...(reciter ? { reciter } : {}),
    group: "full",
    durationSec,
    format: "ogg",
    bytes,
  };
};

const qad = (
  n: number,
  place: "مكة المكرمة" | "المدينة المنورة",
  prayer: "الفجر" | "المغرب" | "العشاء",
  year: number,
  durationSec: number,
  bytes: number,
): IqamahSound => {
  const id = `iqamah_${String(n).padStart(2, "0")}` as IqamahId;
  return {
    id,
    url: `${DIR}/${id}.m4a`,
    name: `إقامة الصلاة — الصوت ${AR(n)}`,
    hint: `${place === "مكة المكرمة" ? "الحرم المكي" : "الحرم النبوي"} · ${prayer} ${AR(year)}`,
    group: "qad",
    durationSec,
    format: "m4a",
    bytes,
  };
};

export const IQAMAH_SOUNDS: IqamahSound[] = [
  full(1, 43.54, 148217),
  full(2, 46.46, 169942),
  full(3, 45.35, 159194),
  full(4, 32.36, 110889),
  full(5, 39.55, 144157),
  full(6, 64.32, 247894),
  full(7, 36.6, 136823),
  qad(8, "مكة المكرمة", "الفجر", 2024, 7.11, 59329),
  qad(9, "مكة المكرمة", "الفجر", 2026, 10.22, 84954),
  qad(10, "مكة المكرمة", "المغرب", 2024, 6.03, 50783),
  qad(11, "مكة المكرمة", "المغرب", 2025, 5.58, 47079),
  qad(12, "مكة المكرمة", "المغرب", 2026, 6.13, 51306),
  qad(13, "مكة المكرمة", "العشاء", 2026, 10.39, 86381),
  qad(14, "المدينة المنورة", "الفجر", 2025, 6.39, 53620),
  qad(15, "المدينة المنورة", "الفجر", 2026, 5.47, 46070),
  qad(16, "المدينة المنورة", "المغرب", 2024, 9.62, 79967),
  qad(17, "المدينة المنورة", "المغرب", 2026, 7.49, 62634),
  qad(18, "المدينة المنورة", "العشاء", 2024, 7.41, 61859),
  qad(19, "المدينة المنورة", "العشاء", 2026, 10.28, 85427),
];

export const IQAMAH_GROUP_LABELS: Record<IqamahGroup, { title: string; hint: string }> = {
  full: { title: "الإقامة كاملة", hint: "التسجيل الكامل للإقامة" },
  qad: { title: "قد قامت الصلاة", hint: "مقاطع قصيرة من الحرمين" },
};

const BY_ID = new Map<string, IqamahSound>(IQAMAH_SOUNDS.map((s) => [s.id, s]));

export function isIqamahId(v: unknown): v is IqamahId {
  return typeof v === "string" && BY_ID.has(v);
}

export function getIqamahSound(id: string | null | undefined): IqamahSound | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/**
 * معرّفات الإقامة القديمة ← أقرب صوتٍ جديد. كانت الإقامة القديمة تستعمل مقاطع
 * من مكتبة الأذان (حيّ على الصلاة، التكبير) ونغمتين مولَّدتين؛ لا يبقى منها
 * شيء، فكل اختيارٍ محفوظ يُنقل إلى تسجيل إقامةٍ حقيقي حتى لا يصمت أحد.
 */
export const LEGACY_IQAMA_MIGRATION: Record<string, IqamahId> = {
  iqama_full: "iqamah_01",
  iqama_masjid: "iqamah_02",
  iqama_qad: "iqamah_09",
  iqama_short: "iqamah_15",
  tone_iqama: "iqamah_09",
  tone_iqama_short: "iqamah_15",
};

/** يحوّل أيّ قيمة محفوظة إلى معرّف إقامة صالح (أو null إن لم تكن معروفة). */
export function migrateIqamahId(v: unknown): IqamahId | null {
  if (isIqamahId(v)) return v;
  if (typeof v === "string" && LEGACY_IQAMA_MIGRATION[v]) return LEGACY_IQAMA_MIGRATION[v];
  return null;
}

export function iqamahDurationLabel(s: IqamahSound): string {
  const m = Math.floor(s.durationSec / 60);
  const sec = Math.round(s.durationSec % 60);
  return AR(`${m}:${String(sec).padStart(2, "0")}`);
}

export function iqamahLabel(id: string | null | undefined): string {
  return getIqamahSound(id)?.name ?? "إقامة الصلاة";
}
