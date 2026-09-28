/**
 * منار — ما يُلغى من التذكيرات المعلّقة بعد ضبط الجدول الجديد.
 *
 * المزامنة تضبط الجدول الجديد أولاً (ضبطُ معرّفٍ قائم يستبدله)، ثم تلغي فقط ما
 * كان معلّقاً في مدى منار ولم يعد في الجدول. بهذا لا تمرّ لحظة يكون فيها الجدول
 * فارغاً، فلا يضيع شيء إن أنهى النظام التطبيق في منتصف المزامنة.
 *
 * @param lo بداية مدى معرّفات منار (شاملة).
 * @param hi نهاية المدى (غير شاملة) — ما بعدها (التأجيل والتجربة) لا يُمسّ.
 */
export function staleIds(pending: number[], next: number[], lo: number, hi: number): number[] {
  const keep = new Set(next);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const id of pending) {
    if (id < lo || id >= hi || keep.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
