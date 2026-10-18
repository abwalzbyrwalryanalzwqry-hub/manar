/* منار — مواصفة «فنّ الويدجت»: الخطوط والمفردات المشتركة بين الويب والأصلي.
 *
 * لماذا؟ ويدجت أندرويد يُرسم في عملية المُشغّل، ولا يقبل خطاً مخصّصاً في
 * `TextView` (أوقفت جوجل ذلك أمنياً)، وترخيص خط ثمانية يمنع تحويل ملفاته أو
 * تقليصها. الحلّ: الواجهة (WebView) ترسم الكلمات بخطوط التطبيق نفسها على
 * `canvas` وتسلّمها صوراً، والأصلي يركّب منها الأسطر (`WidgetArt.java`). الصور
 * نصّ مرسوم لا ملفات خط، فلا يمسّ الترخيص ولا يزيد حجم التطبيق.
 *
 * التركيب كلمةً كلمة مطابق بصرياً للسطر الكامل: التشكيل العربي داخل الكلمة،
 * ولا وصل بين الكلمات. والأرقام تُركَّب حرفاً حرفاً (لا تشكيل فيها) فيبني
 * الأصلي أي عدّاد أو وقت دون الرجوع إلى الويب.
 *
 * أي تغيير هنا يجب أن يطابقه `WidgetWords.java` و`WidgetArt.java`
 * (يتحقّق `tests/unit/widget-art-spec.test.ts`).
 */

/** إصدار المواصفة: تغييره يفرض إعادة رسم الصور على كل الأجهزة. */
export const ART_SPEC_VERSION = 3;

export type LineStyleId = "B" | "M" | "R" | "N" | "S";
export type ParaStyleId = "Q" | "Z";

export interface LineStyle {
  /** متغيّر CSS لعائلة الخط (يشمل البدائل كما في `styles.css`). */
  family: "--font-sans" | "--font-display" | "--font-quran";
  weight: number;
  /** حجم الرسم بالبكسل — أكبر من أكبر حجم عرض حتى يبقى النص حادّاً. */
  px: number;
  /** أسطر الأرقام فقط (العدّاد الكبير) — لا مفردات. */
  digitsOnly?: boolean;
}

export const LINE_STYLES: Record<LineStyleId, LineStyle> = {
  /** العناوين وأسماء الصلوات. */
  B: { family: "--font-sans", weight: 700, px: 60 },
  /** الأوقات والنصوص الأساسية. */
  M: { family: "--font-sans", weight: 500, px: 56 },
  /** الأسطر الثانوية: التاريخ، المدينة، المرجع. */
  R: { family: "--font-sans", weight: 400, px: 48 },
  /** الأرقام الكبيرة: العدّاد، المسبحة. */
  N: { family: "--font-sans", weight: 700, px: 120, digitsOnly: true },
  /** خط العرض (Serif Display): اليوم الهجري والشهر في ويدجت التقويم. */
  S: { family: "--font-display", weight: 700, px: 88 },
};

export interface ParaStyle {
  family: LineStyle["family"];
  weight: number;
  px: number;
  /** ارتفاع السطر نسبةً إلى الحجم. */
  lineHeight: number;
  /** عرض الفقرة بالبكسل عند الرسم (= ٣٠٠dp × ٣). */
  width: number;
}

export const PARA_STYLES: Record<ParaStyleId, ParaStyle> = {
  /** الآيات: خط المصحف كما في `--font-quran`. */
  Q: { family: "--font-quran", weight: 400, px: 46, lineHeight: 1.95, width: 900 },
  /** نصوص الأذكار: خط العرض كما في صفحة الأذكار. */
  Z: { family: "--font-display", weight: 400, px: 42, lineHeight: 1.9, width: 900 },
};

/** الأرقام والرموز التي تُرسم حرفاً حرفاً في كل نمط. */
export const DIGIT_CHARS = "٠١٢٣٤٥٦٧٨٩0123456789:/.٪%+−-×";

/**
 * المفردات التي يركّبها الأصلي وحده (العدّاد، الحالات، الأزرار). تُرسم في كل
 * أنماط الأسطر عدا N. مطابقة حرفياً لـ`WidgetWords.java`.
 */
export const NATIVE_PHRASES: readonly string[] = [
  // الصلوات
  "الفجر",
  "الشروق",
  "الظهر",
  "العصر",
  "المغرب",
  "العشاء",
  "الجمعة",
  // العدّ والحالات
  "متبقٍّ",
  "بعد",
  "حان الآن",
  "دخل وقت",
  "الإقامة بعد",
  "أُقيمت الصلاة",
  "الصلاة القادمة",
  "ساعة",
  "ساعتين",
  "ساعات",
  "دقيقة",
  "دقيقتين",
  "دقائق",
  "دقيقة واحدة",
  "ساعة واحدة",
  "و",
  "أقل من دقيقة",
  "س",
  "د",
  "ص",
  "م",
  "هـ",
  "·",
  "،",
  "/",
  // عناوين الويدجتات
  "مواقيت اليوم",
  "آية اليوم",
  "أذكار الصباح",
  "أذكار المساء",
  "التالي",
  "اكتملت أذكار الوقت",
  "المسبحة",
  "ابدأ تسبيحاً من منار",
  "سبحان الله",
  "اضغط للتسبيح",
  "بلغت الهدف",
  "صلواتي اليوم",
  "من",
  "صلّيت",
  "أحسنت، أتممت صلوات اليوم",
  "التقويم الهجري",
  "الختمة",
  "اليوم",
  "يوم",
  "ورد اليوم",
  "أتممت ورد اليوم",
  "متابعة القراءة",
  "ابدأ ختمة من منار",
  "الموسم",
  "رمضان",
  "الإفطار",
  "السحور",
  "الإمساك",
  "بقي",
  "أيام",
  "يوماً",
  "يومان",
  "غداً",
  "المصحف",
  "الأذكار",
  "القبلة",
  "التسبيح",
  "افتح منار لتحديث المواقيت",
  "افتح منار لتجديد المواقيت",
  "منار",
];

/** كلمات عبارة بالمسافات. */
export function phraseWords(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/** هل في النص حروف لاتينية؟ يُرسم كاملاً حينها (ترتيب الكلمات LTR لا يُركَّب RTL). */
export function hasLatin(s: string): boolean {
  return /[A-Za-z]/.test(s);
}

/** هل الكلمة أرقام ورموز فقط؟ تُركَّب حرفاً حرفاً. */
export function isDigitRun(word: string): boolean {
  if (!word) return false;
  for (const ch of word) if (!DIGIT_CHARS.includes(ch)) return false;
  return true;
}

/** FNV-1a ٣٢ بت بصيغة hex — مفتاح الفقرات وبصمة الحزمة. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** مفتاح فقرة (آية أو ذكر) في الحزمة — يحسبه الويب ويحمله في اللقطة. */
export function paraKey(style: ParaStyleId, text: string): string {
  return `${style}${fnv1a(`${ART_SPEC_VERSION}|${style}|${text}`)}`;
}

/**
 * ما تحتاجه الحزمة: لكل نمط سطر مجموعة نصوص (تُرسم كاملة إن احتوت لاتينياً،
 * وإلا كلمةً كلمة)، والفقرات. تجمعه `collectArt` من اللقطة.
 */
export interface ArtRequest {
  lines: Record<LineStyleId, Set<string>>;
  paras: Map<string, { style: ParaStyleId; text: string }>;
}

export function emptyArtRequest(): ArtRequest {
  return {
    lines: { B: new Set(), M: new Set(), R: new Set(), N: new Set(), S: new Set() },
    paras: new Map(),
  };
}

/** يضيف نصّ سطر إلى نمط: كاملاً إن كان لاتينياً، وكلماته غير الرقمية دائماً. */
export function addLine(req: ArtRequest, style: LineStyleId, text: string | undefined | null) {
  if (!text) return;
  const set = req.lines[style];
  if (hasLatin(text)) set.add(text.trim());
  for (const w of phraseWords(text)) {
    if (!isDigitRun(w)) set.add(w);
    else continue;
  }
}

export function addPara(req: ArtRequest, style: ParaStyleId, text: string | undefined | null) {
  if (!text) return;
  req.paras.set(paraKey(style, text), { style, text });
}

/** بصمة الطلب: إن طابقت ما عند الأصلي فلا داعي لإعادة الرسم. */
export function artHash(req: ArtRequest, fontsSignature: string): string {
  const parts: string[] = [`v${ART_SPEC_VERSION}`, fontsSignature];
  for (const id of Object.keys(req.lines).sort() as LineStyleId[]) {
    parts.push(`${id}:${[...req.lines[id]].sort().join("\u0001")}`);
  }
  parts.push([...req.paras.keys()].sort().join(","));
  return fnv1a(parts.join("\u0002"));
}
