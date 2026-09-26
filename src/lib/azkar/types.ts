// ============================================================
// Manar — Azkar Module
// Content source: كتاب «حصن المسلم» — د. سعيد بن علي بن وهف القحطاني
// ============================================================

/** وقت الذكر داخل باب أذكار الصباح والمساء. */
export type ZikrTime = "morning" | "evening";

/** مقطع من ذكر مركّب له عدد مستقل (مثل التسبيح ٣٣ + التحميد ٣٣ + التكبير ٣٤). */
export interface ZikrSegment {
  text: string;
  repeat: number;
}

/** مقطع قرآني يُولَّد نصه من المصحف العثماني داخل التطبيق. */
export interface QuranPassage {
  surah: number;
  from: number;
  to: number;
}

export interface Zikr {
  /** Global sequential number as printed in the book (١..٢٦٧). الأذكار المفصولة
   * من ذكر واحد (كل سورة من المعوذات) تأخذ رقمًا مشتقًا مثل ٧٦٠٢، ورقمها المطبوع في `no`. */
  id: number;
  /** رقم الذكر المطبوع في الكتاب حين يختلف عن `id` (الأذكار المفصولة). */
  no?: number;
  /** عنوان الذكر المفصول، مثل «سورة الفلق». */
  title?: string;
  /** ما يُتلى قبل النص في سطر مستقل: البسملة قبل السورة، أو الاستعاذة قبل آية الكرسي. */
  opening?: string;
  /** Verbatim Arabic text (vocalized where available in the source). */
  text: string;
  /** Recommended repetition count (1 when unspecified). Equals the sum of segments when present. */
  repeat: number;
  /** إرشاد يسبق الذكر ولا يُتلى، مثل «يبدأ برجله اليمنى، ويقول:». */
  lead?: string;
  /** إرشاد يلي الذكر ولا يُتلى، مثل «(ثلاث مرات)» أو «بعد كل صلاة». */
  note?: string;
  /** صيغة المساء حين يختلف لفظها عن صيغة الصباح (باب ٢٧). */
  evening?: string;
  /** يُقال في وقت واحد فقط (باب ٢٧). غيابه يعني الصباح والمساء معًا. */
  time?: ZikrTime;
  /** مقاطع الذكر المركّب؛ مجموع أعدادها = repeat. */
  segments?: ZikrSegment[];
  /** إن وُجد فالنص قرآني مأخوذ من المصحف (يُعرض بخط المصحف). */
  quran?: QuranPassage[];
}

export interface AzkarChapter {
  /** Chapter number as printed in the book (١..١٣٢). */
  id: number;
  title: string;
  /** Thematic group id (see AzkarGroup). */
  group: string;
  azkar: Zikr[];
  /** Source references / takhrij lines belonging to the chapter. */
  references: string[];
}

export interface AzkarGroup {
  id: string;
  title: string;
  from: number;
  to: number;
}

export interface AzkarBookMeta {
  title: string;
  subtitle: string;
  author: string;
  edition: string;
  /** إصدار بنية الملف (٢ = بعد التصحيح عبر scripts/azkar/build-hisn.py). */
  schema?: number;
}

export interface AzkarBook {
  book: AzkarBookMeta;
  groups: AzkarGroup[];
  chapters: AzkarChapter[];
}

export interface ZikrHit {
  chapter: AzkarChapter;
  zikr: Zikr;
  /** Match score — higher is better. */
  score: number;
  /** Short excerpt around the first match. */
  excerpt: string;
  /**
   * وقت الذكر الذي تُفتح عليه النتيجة في باب الصباح والمساء: وقته إن كان خاصًا
   * بوقت، أو المساء إن طابق البحثُ لفظَ المساء وحده.
   */
  time?: ZikrTime;
}
