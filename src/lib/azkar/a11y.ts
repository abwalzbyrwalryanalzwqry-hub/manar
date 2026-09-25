// ============================================================
// Manar — Azkar Module
// نصوص إعلان العدّاد لقارئ الشاشة (aria-live).
// ============================================================

import { toArabicDigits } from "@/lib/format";
import type { ZikrSegment } from "./types";

const n = (x: number) => toArabicDigits(x);

/**
 * ما يُعلَن بعد ضغطة واحدة، و`before` هو العدد قبلها. في الذكر المركّب يُعلَن
 * عدد المقطع الحالي، ثم نهاية كل مقطع، ثم إتمام الذكر.
 */
export function counterAnnouncement(
  before: number,
  repeat: number,
  segments?: readonly Pick<ZikrSegment, "repeat">[],
): string {
  const next = Math.min(repeat, before + 1);
  if (next >= repeat) return `اكتمل الذكر، ${n(repeat)} من ${n(repeat)}`;
  if (segments?.length) {
    let start = 0;
    for (let i = 0; i < segments.length; i++) {
      const end = start + segments[i].repeat;
      if (next <= end) {
        const inSeg = next - start;
        const total = `المقطع ${n(i + 1)} من ${n(segments.length)}`;
        return inSeg === segments[i].repeat
          ? `اكتمل ${total}، الإجمالي ${n(next)} من ${n(repeat)}`
          : `${n(inSeg)} من ${n(segments[i].repeat)}، ${total}`;
      }
      start = end;
    }
  }
  return `${n(next)} من ${n(repeat)}`;
}
