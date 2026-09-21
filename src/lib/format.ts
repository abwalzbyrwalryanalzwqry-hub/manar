/* Arabic formatting helpers — Manar */

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

export function formatArTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const h12 = ((h + 11) % 12) + 1;
  return toArabicDigits(`${h12}:${String(m).padStart(2, "0")}`);
}

export function ampmAr(date: Date): string {
  return date.getHours() < 12 ? "صباحاً" : "مساءً";
}

export function formatHHMM(date: Date): string {
  return toArabicDigits(
    `${String(((date.getHours() + 11) % 12) + 1).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  );
}

/** Format a positive ms difference as Arabic HH:MM:SS */
export function formatCountdown(ms: number): { h: string; m: string; s: string; compact: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    h: toArabicDigits(String(h).padStart(2, "0")),
    m: toArabicDigits(String(m).padStart(2, "0")),
    s: toArabicDigits(String(s).padStart(2, "0")),
    compact: toArabicDigits(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    ),
  };
}

export function formatGregorianAr(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * التاريخ الهجري (أم القرى) مع إزاحة المستخدم اليدوية بالأيام.
 * الإزاحة تُدار من شاشة التقويم عبر `useHijriAdjust` في `@/lib/hijri`.
 */
export function formatHijriAr(date: Date, adjust = 0): string {
  const target = adjust === 0 ? date : new Date(date.getTime() + adjust * 86_400_000);
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(target);
}

export function formatWeekdayAr(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(date);
}
