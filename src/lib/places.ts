/* منار — طبقة البحث والاستدلال فوق قاعدة المواقع.
 *
 * تجمع بين القاعدة العربية الكاملة (`arab-places.ts`) والمدن العالمية
 * (`cities.ts`) في فهرس واحد مسطّح، وتبنيه مرةً واحدةً عند أول استعمال.
 */

import { ARAB_COUNTRIES } from "@/lib/arab-places";
import { CITIES } from "@/lib/cities";
import type { LocationState } from "@/lib/prayer";

export type PlaceKind = "region" | "city";

export type Place = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  /** اسم المحافظة التي يتبعها المكان — يُعرض للتمييز بين المتشابهات. */
  region?: string;
  /** شكل مبسّط للاسم يُستعمل في المطابقة فقط. */
  key: string;
  /** شكل مبسّط لاسم الدولة. */
  countryKey: string;
  /** السكان بالآلاف — لترتيب البحث وترجيح الاستدلال العكسي. */
  pop: number;
};

/**
 * تبسيط الاسم للبحث. المستخدم لا يكتب الهمزات ولا التاء المربوطة كما هي في
 * البيانات: من يكتب "الاحساء" يجب أن يجد "الأحساء"، ومن يكتب "مكه" يجد
 * "مكة". ومن يكتب بلا "ال" التعريف يجب أن يجد المعرَّف كذلك.
 */
export function normalizeAr(s: string): string {
  return (
    s
      // التشكيل والتطويل ومحارف اتجاه النص
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
      .replace(/[\u200B-\u200F\u061C\u2066-\u2069\uFEFF]/g, "")
      // توحيد الهمزات وألف الوصل
      .replace(/[أإآٱٲٳا]/g, "ا")
      .replace(/[ىي]/g, "ي")
      .replace(/[ؤئ]/g, "ء")
      .replace(/ة/g, "ه")
      .replace(/[\u0629]/g, "ه")
      // الفواصل: المسافات والشُرَط تُلغى فتتطابق "بني ملال - خنيفرة" مع "بنيملال"
      .replace(/[\s\-‐-―_/,.()]+/g, "")
      .toLowerCase()
  );
}

/** حذف "ال" التعريف من البداية — بعد التبسيط. */
function stripAl(s: string): string {
  return s.startsWith("ال") && s.length > 4 ? s.slice(2) : s;
}

let cache: Place[] | null = null;

export function allPlaces(): Place[] {
  if (cache) return cache;
  const out: Place[] = [];

  for (const country of ARAB_COUNTRIES) {
    const ck = normalizeAr(country.name);
    for (const r of country.regions) {
      out.push({
        city: r.n,
        country: country.name,
        lat: r.lat,
        lng: r.lng,
        kind: "region",
        key: normalizeAr(r.n),
        countryKey: ck,
        pop: r.p,
      });
      for (const [name, lat, lng, pop] of r.c) {
        out.push({
          city: name,
          country: country.name,
          lat,
          lng,
          kind: "city",
          region: r.n,
          key: normalizeAr(name),
          countryKey: ck,
          pop,
        });
      }
    }
  }

  /* المدن العالمية: نضيف ما ليس في القاعدة العربية أصلاً حتى لا يتكرّر. */
  const seen = new Set(out.map((p) => `${p.key}|${p.countryKey}`));
  for (const c of CITIES) {
    const key = normalizeAr(c.city);
    const ck = normalizeAr(c.country ?? "");
    if (seen.has(`${key}|${ck}`)) continue;
    seen.add(`${key}|${ck}`);
    out.push({
      city: c.city,
      country: c.country ?? "",
      lat: c.lat,
      lng: c.lng,
      kind: "city",
      key,
      countryKey: ck,
      /* المدن العالمية المضمَّنة كلها عواصم أو مدن كبرى؛ نعطيها وزناً يضعها
       * في مرتبة المدن الكبيرة دون أن يفوق بيانات GeoNames الحقيقية. */
      pop: 500,
    });
  }

  cache = out;
  return out;
}

export function arabCountryNames(): string[] {
  return ARAB_COUNTRIES.map((c) => c.name);
}

export function regionsOf(countryName: string) {
  return ARAB_COUNTRIES.find((c) => c.name === countryName)?.regions ?? [];
}

/**
 * بحث مرتّب بالصلة. الترتيب مقصود: المطابقة التامة، فالبداية، فالاحتواء —
 * وداخل كل رتبة تتقدّم المحافظة على المدينة، فمن يكتب "تعز" يريد المحافظة
 * لا قريةً اسمها يحتوي "تعز".
 */
export function searchPlaces(query: string, limit = 60): Place[] {
  const q = normalizeAr(query).trim();
  if (!q) return [];
  const qs = stripAl(q);

  const scored: { p: Place; score: number }[] = [];
  for (const p of allPlaces()) {
    const k = p.key;
    const ks = stripAl(k);
    let score: number;
    if (k === q || ks === qs) score = 0;
    else if (k.startsWith(q) || ks.startsWith(qs)) score = 1;
    else if (k.includes(q) || ks.includes(qs)) score = 2;
    else if (p.countryKey.startsWith(q) || p.countryKey === q) score = 3;
    else if (p.countryKey.includes(q)) score = 4;
    else continue;
    if (p.kind === "region") score -= 0.5;
    scored.push({ p, score });
  }

  /* داخل الرتبة نفسها: الأكثر سكاناً أولاً. من يكتب "الحديدة" يريد المدينة
   * المعروفة لا قريةً تحمل الاسم نفسه. ثم الأقصر اسماً عند التساوي. */
  scored.sort(
    (a, b) => a.score - b.score || b.p.pop - a.p.pop || a.p.city.length - b.p.city.length,
  );
  return scored.slice(0, limit).map((s) => s.p);
}

export function toLocation(p: Place, source: LocationState["source"] = "manual"): LocationState {
  return { city: p.city, country: p.country, lat: p.lat, lng: p.lng, source };
}

/* --------------------- الاستدلال العكسي دون إنترنت --------------------- */

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * أقرب مكان معروف لإحداثيات الجهاز — يسمّي الموقع بلا إنترنت.
 *
 * يعيد المدينة ومحافظتها معاً عند وجودها، فيعرف المستخدم أنه في
 * «الحوطة · لحج» لا في «الحوطة» المجهولة.
 */
export function nearestPlace(lat: number, lng: number, maxKm = 120): Place | null {
  let best: Place | null = null;
  let bestScore = Infinity;
  for (const p of allPlaces()) {
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (km > maxKm) continue;
    /* أقرب نقطة ليست دائماً الاسم الصحيح: من يقف وسط القاهرة تقع أقرب نقطة
     * إليه على حيٍّ صغير لا يعرفه أحد، بينما اسم "القاهرة" هو الوصف الصحيح.
     * فنخصم من المسافة رصيداً يتناسب مع شهرة المكان (لوغاريتم السكان)،
     * بحدٍّ أقصى ٢٥ كم حتى لا تبتلع عاصمةٌ بعيدة موقعاً له اسم أقرب وأدقّ. */
    const fame = Math.min(25, Math.log10(Math.max(1, p.pop)) * 9);
    /* عند التعادل نرجّح المدينة على المحافظة: "الدار البيضاء" وصفٌ لموقع
     * المستخدم أدقّ من "الدار البيضاء - سطات". */
    const score = km - fame - (p.kind === "city" ? 1 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
