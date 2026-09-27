/* منار — اقتراح طريقة الحساب حسب البلد.
 *
 * عند تحديد الموقع بـGPS، إن كانت للبلد طريقة معروفة تختلف عن المختارة، تظهر
 * بطاقة «الطريقة الشائعة في بلدك» مع زر «اعتمدها». لا تغيير صامت أبداً.
 *
 * الخريطة مأخوذة مما تنصّ عليه مكتبة adhan نفسها لكل طريقة (METHODS.md):
 * أم القرى لمكة، والمصرية، ودبي للإمارات، وقطر، والكويت، وسنغافورة لسنغافورة
 * وماليزيا وإندونيسيا، وديانت لتركيا، وطهران، وكراتشي، ولجنة رؤية الهلال
 * لأمريكا الشمالية وبريطانيا. البلدان الأخرى بلا اقتراح.
 */

import type { CalcMethodKey, LocationState } from "./prayer";

const RULES: { method: CalcMethodKey; names: string[] }[] = [
  { method: "UmmAlQura", names: ["السعودية", "saudi"] },
  { method: "Egyptian", names: ["مصر", "egypt"] },
  { method: "Dubai", names: ["الإمارات", "emirates", "uae"] },
  { method: "Qatar", names: ["قطر", "qatar"] },
  { method: "Kuwait", names: ["الكويت", "kuwait"] },
  {
    method: "Singapore",
    names: ["سنغافورة", "ماليزيا", "إندونيسيا", "اندونيسيا", "singapore", "malaysia", "indonesia"],
  },
  { method: "Turkey", names: ["تركيا", "türkiye", "turkey"] },
  { method: "Tehran", names: ["إيران", "ايران", "iran"] },
  { method: "Karachi", names: ["باكستان", "pakistan"] },
  {
    method: "MoonsightingCommittee",
    names: [
      "أمريكا",
      "الولايات المتحدة",
      "كندا",
      "بريطانيا",
      "المملكة المتحدة",
      "united states",
      "usa",
      "canada",
      "united kingdom",
    ],
  },
];

export function methodForCountry(country: string | undefined | null): CalcMethodKey | null {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return null;
  for (const r of RULES) if (r.names.some((n) => c.includes(n))) return r.method;
  return null;
}

export const METHOD_SUGGEST_KEY = "manar.method-suggest.v1";

/** الاقتراح الذي يستحق العرض الآن، أو null. */
export function methodSuggestion(
  location: LocationState,
  current: CalcMethodKey,
  dismissed: string[],
): { method: CalcMethodKey; country: string } | null {
  if (location.source !== "gps" || !location.country) return null;
  const method = methodForCountry(location.country);
  if (!method || method === current) return null;
  if (dismissed.includes(`${location.country}:${method}`)) return null;
  return { method, country: location.country };
}

export function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(METHOD_SUGGEST_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(-50) : [];
  } catch {
    return [];
  }
}

export function dismissSuggestion(country: string, method: CalcMethodKey) {
  if (typeof window === "undefined") return;
  const next = [...new Set([...readDismissed(), `${country}:${method}`])];
  try {
    window.localStorage.setItem(METHOD_SUGGEST_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
