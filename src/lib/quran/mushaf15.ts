// ============================================================
// Manar — تخطيط مصحف المدينة (١٥ سطراً، طبعة V1)
// ------------------------------------------------------------
// ملف لكل صفحة في `/data/quran/mushaf15/{page}.json`، يولّده
// `scripts/build-mushaf15.py` من Quran.com بخط مجمع الملك فهد (حفص).
// تقسيم الصفحات فيه يطابق بيانات Tanzil (يتحقق السكربت آية آية).
// ============================================================

/** كلمة: [آية، نص]. علامة نهاية الآية: [آية] (يرسمها خط الحفص دائرةً برقمها). */
export type Mushaf15Token = [ayah: number, text?: string];

export type Mushaf15Line =
  | { t: "h"; s: number } // اسم السورة
  | { t: "b"; s: number } // البسملة
  | { t?: undefined; s: number; w: Mushaf15Token[] }; // سطر آيات

export interface Mushaf15Page {
  p: number;
  l: Mushaf15Line[];
}

/** البسملة برسم مجمع الملك فهد (تطابق خط الحفص المستعمل في الصفحة). */
export const QPC_BASMALA = "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ";

export const MUSHAF15_FONT = '"KFGQPC Hafs", "Amiri Quran", serif';

const BASE = "/data/quran/mushaf15";

export async function loadMushaf15Page(page: number): Promise<Mushaf15Page> {
  const res = await fetch(`${BASE}/${page}.json`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`تعذّر تحميل تخطيط الصفحة ${page} (${res.status})`);
  const data = (await res.json()) as Mushaf15Page;
  if (!data || data.p !== page || !Array.isArray(data.l)) {
    throw new Error(`تخطيط الصفحة ${page} غير صالح`);
  }
  return data;
}

export function isAyahLine(line: Mushaf15Line): line is Extract<Mushaf15Line, { w: unknown }> {
  return "w" in line;
}

/** الصفحتان الأولى والثانية مزخرفتان بأسطر قصيرة متوسطة. */
export function isOpeningPage(page: number): boolean {
  return page <= 2;
}
