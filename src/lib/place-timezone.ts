/* منار — المنطقة الزمنية للموقع المختار (المرحلة ٣٣).
 *
 * المواقيت لحظاتٌ مطلقة، والأذان يُضبط على ساعة الجهاز، فيصل في لحظته الصحيحة
 * أيّاً كانت المنطقة. لكن العرض بساعة الجهاز: من اختار «القاهرة» وجهازه على
 * توقيت مكة يرى الفجر بساعة مكة. والأخطر: جهازٌ منطقته الزمنية خاطئة وساعته
 * مضبوطة يدوياً «لتبدو صحيحة» يُطلق الأذان متأخّراً أو مبكّراً بساعات.
 *
 * هنا نعرف منطقة الموقع (IANA) ونقارن إزاحتها بإزاحة الجهاز في اللحظة نفسها،
 * فتظهر شارة تشرح الفرق. لا نعيد تنسيق الأوقات بمنطقة المدينة: الأذان يتبع
 * ساعة الجهاز، وعرض ساعةٍ غيرها يجعل ما يُرى يخالف ما يُسمع.
 */

import type { LocationState } from "@/lib/prayer";

/** دول بمنطقة زمنية واحدة — بالاسم العربي كما في `arab-places.ts` و`cities.ts`. */
const COUNTRY_TZ: Record<string, string> = {
  السعودية: "Asia/Riyadh",
  الإمارات: "Asia/Dubai",
  قطر: "Asia/Qatar",
  الكويت: "Asia/Kuwait",
  البحرين: "Asia/Bahrain",
  عُمان: "Asia/Muscat",
  اليمن: "Asia/Aden",
  العراق: "Asia/Baghdad",
  الأردن: "Asia/Amman",
  لبنان: "Asia/Beirut",
  سوريا: "Asia/Damascus",
  فلسطين: "Asia/Hebron",
  مصر: "Africa/Cairo",
  السودان: "Africa/Khartoum",
  ليبيا: "Africa/Tripoli",
  تونس: "Africa/Tunis",
  الجزائر: "Africa/Algiers",
  المغرب: "Africa/Casablanca",
  موريتانيا: "Africa/Nouakchott",
  الصومال: "Africa/Mogadishu",
  جيبوتي: "Africa/Djibouti",
  "جزر القمر": "Indian/Comoro",
  تركيا: "Europe/Istanbul",
  إيران: "Asia/Tehran",
  باكستان: "Asia/Karachi",
  بنغلاديش: "Asia/Dhaka",
  الهند: "Asia/Kolkata",
  ماليزيا: "Asia/Kuala_Lumpur",
  سنغافورة: "Asia/Singapore",
  أفغانستان: "Asia/Kabul",
  بريطانيا: "Europe/London",
  فرنسا: "Europe/Paris",
  ألمانيا: "Europe/Berlin",
  بلجيكا: "Europe/Brussels",
  هولندا: "Europe/Amsterdam",
  إسبانيا: "Europe/Madrid",
  إيطاليا: "Europe/Rome",
  السويد: "Europe/Stockholm",
  /* كما يكتبها Nominatim بالعربية (مواقع حُدّدت تلقائياً قبل حفظ `tz`). */
  "المملكة العربية السعودية": "Asia/Riyadh",
  "الإمارات العربية المتحدة": "Asia/Dubai",
  عمان: "Asia/Muscat",
  "سلطنة عمان": "Asia/Muscat",
  "المملكة المغربية": "Africa/Casablanca",
  "المملكة المتحدة": "Europe/London",
  "الأراضي الفلسطينية": "Asia/Hebron",
};

/** مدن في دولٍ متعدّدة المناطق (من `cities.ts`)، وقطاع غزة. */
const CITY_TZ: Record<string, string> = {
  موسكو: "Europe/Moscow",
  نيويورك: "America/New_York",
  ديترويت: "America/Detroit",
  شيكاغو: "America/Chicago",
  "لوس أنجلوس": "America/Los_Angeles",
  تورنتو: "America/Toronto",
  مونتريال: "America/Toronto",
  سيدني: "Australia/Sydney",
  جاكرتا: "Asia/Jakarta",
  غزة: "Asia/Gaza",
  "شمال غزة": "Asia/Gaza",
  "خان يونس": "Asia/Gaza",
  رفح: "Asia/Gaza",
  "دير البلح": "Asia/Gaza",
};

/** رموز ISO من Nominatim (`country_code`) للدول ذات المنطقة الواحدة. */
const ISO_TZ: Record<string, string> = {
  sa: "Asia/Riyadh",
  ae: "Asia/Dubai",
  qa: "Asia/Qatar",
  kw: "Asia/Kuwait",
  bh: "Asia/Bahrain",
  om: "Asia/Muscat",
  ye: "Asia/Aden",
  iq: "Asia/Baghdad",
  jo: "Asia/Amman",
  lb: "Asia/Beirut",
  sy: "Asia/Damascus",
  eg: "Africa/Cairo",
  sd: "Africa/Khartoum",
  ly: "Africa/Tripoli",
  tn: "Africa/Tunis",
  dz: "Africa/Algiers",
  ma: "Africa/Casablanca",
  mr: "Africa/Nouakchott",
  so: "Africa/Mogadishu",
  dj: "Africa/Djibouti",
  km: "Indian/Comoro",
  tr: "Europe/Istanbul",
  ir: "Asia/Tehran",
  pk: "Asia/Karachi",
  bd: "Asia/Dhaka",
  in: "Asia/Kolkata",
  my: "Asia/Kuala_Lumpur",
  sg: "Asia/Singapore",
  af: "Asia/Kabul",
  gb: "Europe/London",
  fr: "Europe/Paris",
  de: "Europe/Berlin",
  be: "Europe/Brussels",
  nl: "Europe/Amsterdam",
  it: "Europe/Rome",
  se: "Europe/Stockholm",
};

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** منطقة دولةٍ من رمزها (ISO 3166-1 alpha-2)، أو null إن تعدّدت مناطقها. */
export function timeZoneForCountryCode(code: string | undefined): string | null {
  return (code && ISO_TZ[code.toLowerCase()]) || null;
}

/** منطقة الموقع: المحفوظة معه، ثم المدينة، ثم الدولة. null إن لم تُعرف. */
export function timeZoneOf(loc: Pick<LocationState, "city" | "country" | "tz">): string | null {
  if (isValidTimeZone(loc.tz)) return loc.tz;
  const byCity = CITY_TZ[loc.city];
  if (byCity) return byCity;
  return (loc.country && COUNTRY_TZ[loc.country]) || null;
}

/** إزاحة منطقةٍ عن UTC بالدقائق في لحظة معيّنة (تحترم التوقيت الصيفي). */
export function zoneOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const base = Math.floor(at.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - base) / 60_000);
}

export function deviceOffsetMinutes(at: Date): number {
  return -at.getTimezoneOffset();
}

export type ZoneMismatch = {
  tz: string;
  /** المدينة ناقص الجهاز بالدقائق: موجبٌ = المدينة تسبق الجهاز. */
  diffMinutes: number;
  cityOffset: number;
  deviceOffset: number;
};

/** فرق منطقة الموقع عن منطقة الجهاز الآن، أو null إن تطابقتا أو لم تُعرف. */
export function zoneMismatch(
  loc: Pick<LocationState, "city" | "country" | "tz">,
  at: Date = new Date(),
): ZoneMismatch | null {
  const tz = timeZoneOf(loc);
  if (!tz) return null;
  let cityOffset: number;
  try {
    cityOffset = zoneOffsetMinutes(tz, at);
  } catch {
    return null;
  }
  const deviceOffset = deviceOffsetMinutes(at);
  const diffMinutes = cityOffset - deviceOffset;
  return diffMinutes === 0 ? null : { tz, diffMinutes, cityOffset, deviceOffset };
}

/** «غرينتش+٣» / «غرينتش−٥:٣٠» — بلا أرقام؛ المستدعي يحوّلها. */
export function gmtLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "غرينتش";
  const sign = offsetMinutes > 0 ? "+" : "−";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `غرينتش${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** «ساعة» / «ساعتين» / «٣ ساعات» / «ساعة ونصف»… بلا تحويل أرقام. */
export function hoursPhrase(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const hours =
    h === 0 ? "" : h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  const rest = m === 0 ? "" : m === 30 ? "نصف ساعة" : m === 45 ? "ثلاثة أرباع ساعة" : `${m} دقيقة`;
  if (!hours) return rest;
  if (!rest) return hours;
  return m === 30 ? `${hours} ونصف` : `${hours} و${rest}`;
}

/**
 * جملة الشارة. `gps`: الموقع هو مكان الجهاز فعلاً، فالفرق خطأ في إعداد الجهاز
 * يُفسد موعد الأذان. `manual`: قد يكون مقصوداً (متابعة مدينة أخرى).
 */
export function mismatchMessage(
  loc: Pick<LocationState, "city" | "source">,
  m: ZoneMismatch,
): { title: string; body: string; severe: boolean } {
  const ahead = m.diffMinutes > 0;
  const gap = hoursPhrase(m.diffMinutes);
  if (loc.source === "gps") {
    return {
      severe: true,
      title: "منطقة الجهاز الزمنية لا تطابق موقعك",
      body: `موقعك على ${gmtLabel(m.cityOffset)} وجهازك على ${gmtLabel(m.deviceOffset)}. الأذان يتبع ساعة الجهاز، فصحّح المنطقة الزمنية من إعدادات التاريخ والوقت (فعّل «المنطقة التلقائية»).`,
    };
  }
  return {
    severe: false,
    title: `المواقيت بساعة جهازك لا بساعة ${loc.city}`,
    body: `توقيت ${loc.city} ${ahead ? "يسبق" : "يتأخّر عن"} جهازك بـ${gap}. إن كنت في ${loc.city} فعلاً فصحّح منطقة الجهاز الزمنية، وإلا فالأوقات هنا صحيحة بساعتك أنت.`,
  };
}
