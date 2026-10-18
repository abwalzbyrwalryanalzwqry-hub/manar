/**
 * عبارات العدّ كما يركّبها الأصلي (WidgetWords.java) — لمعاينة الويب المطابقة.
 * أي تغيير هنا يجب أن ينعكس هناك (ويتحقّق منه tests/unit/widget-words.test.ts).
 */
import { toArabicDigits } from "@/lib/format";

const digits = (n: number, latin: boolean) => (latin ? String(n) : toArabicDigits(n));

export function hoursWord(h: number, latin = false): string {
  if (h === 1) return "ساعة واحدة";
  if (h === 2) return "ساعتين";
  const mod = h % 100;
  return `${digits(h, latin)} ${mod >= 3 && mod <= 10 ? "ساعات" : "ساعة"}`;
}

export function minutesWord(m: number, latin = false): string {
  if (m === 1) return "دقيقة واحدة";
  if (m === 2) return "دقيقتين";
  const mod = m % 100;
  return `${digits(m, latin)} ${mod >= 3 && mod <= 10 ? "دقائق" : "دقيقة"}`;
}

/** «بعد ساعتين و١٥ دقيقة»، «بعد ٤٥ دقيقة»، «بعد أقل من دقيقة». */
export function afterPhrase(ms: number, latin = false): string {
  if (ms < 60_000) return "بعد أقل من دقيقة";
  const total = Math.ceil(ms / 60_000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `بعد ${hoursWord(h, latin)}${m > 0 ? ` و${minutesWord(m, latin)}` : ""}`;
  return `بعد ${minutesWord(m, latin)}`;
}
