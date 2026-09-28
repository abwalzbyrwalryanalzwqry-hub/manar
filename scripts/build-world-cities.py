#!/usr/bin/env python3
"""منار — يولّد قاعدة المدن العالمية (src/lib/world-cities.ts) من GeoNames.

المصدر (رخصة CC BY 4.0): https://download.geonames.org/export/dump/
  cities15000.zip  → cities15000.txt   (المدن ≥ ١٥ ألفاً، ومعها منطقتها الزمنية)
  countryInfo.txt                      (رمز الدولة ومعرّفها في GeoNames)
  alternateNamesV2.zip                 (الأسماء العربية — يُقرأ مضغوطاً كما هو)

القواعد:
- المدن التي يزيد سكانها عن ١٠٠ ألف، خارج الدول العربية الاثنتين والعشرين
  (تلك في `arab-places.ts` بمحافظاتها ومديرياتها).
- لا تدخل مدينة بلا اسم عربي في المصدر: اسمٌ بحروف لاتينية في قائمة عربية أسوأ
  من غيابه، والمستخدم لن يبحث عنه بالعربية أصلاً.
- المنطقة الزمنية (IANA) من المصدر نفسه لكل مدينة، فتصحّ في الدول متعدّدة
  المناطق (أمريكا، روسيا، إندونيسيا، أستراليا، البرازيل، كندا…).

الاستعمال (في مجلّد فيه الملفات الثلاثة):
  python3 scripts/build-world-cities.py /path/to/geonames-dir
"""
import io
import json
import os
import re
import sys
import zipfile

MIN_POP = 100_000
SKIP_CODES = {"PPLX", "PPLH", "PPLW", "PPLQ"}  # أحياء، تاريخية، مدمّرة، مهجورة
ARAB = {
    "SA", "AE", "QA", "KW", "BH", "OM", "YE", "IQ", "JO", "LB", "SY", "PS", "EG", "SD",
    "LY", "TN", "DZ", "MA", "MR", "SO", "DJ", "KM",
    # الصحراء الغربية: مدنها (العيون، الداخلة) في جهات المغرب ضمن arab-places.
    "EH",
}
# القدس: في arab-places ضمن محافظات فلسطين، فلا تتكرّر هنا بمنطقة أخرى.
SKIP_GIDS = {"281184"}
# أسماء دول كما يعرفها القارئ العربي حين يخالفها «المفضَّل» في المصدر.
COUNTRY_OVERRIDE = {
    "US": "الولايات المتحدة",
    "GB": "المملكة المتحدة",
    "RU": "روسيا",
    "CN": "الصين",
    "KR": "كوريا الجنوبية",
    "KP": "كوريا الشمالية",
    "CD": "الكونغو الديمقراطية",
    "CG": "الكونغو",
    "CI": "ساحل العاج",
    "NL": "هولندا",
    "CZ": "التشيك",
    "IR": "إيران",
    "TR": "تركيا",
    "MM": "ميانمار",
    # مدن الأراضي المحتلّة عام ١٩٤٨ تُنسب إلى فلسطين كما في بقية التطبيق،
    # فتلتقي في البحث مع محافظات الضفة وغزّة من arab-places.
    "IL": "فلسطين",
}
NOISE = re.compile(
    r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200B-\u200F\u061C\u2066-\u2069\uFEFF]"
)
ARABIC = re.compile(r"^[\u0600-\u06FF\s\-'()]+$")
PERSIAN_ONLY = re.compile(r"[پچژگکی]")  # حروف فارسية/أردية لا تُكتب بها العربية


def clean(name: str) -> str:
    return re.sub(r"\s+", " ", NOISE.sub("", name or "")).strip()


def main(src: str) -> None:
    cities = []
    for line in open(os.path.join(src, "cities15000.txt"), encoding="utf-8"):
        f = line.rstrip("\n").split("\t")
        pop = int(f[14] or 0)
        if pop < MIN_POP or f[7] in SKIP_CODES or f[8] in ARAB or f[0] in SKIP_GIDS:
            continue
        cities.append(
            dict(gid=f[0], lat=float(f[4]), lng=float(f[5]), cc=f[8], pop=pop, tz=f[17])
        )

    country_gid = {}
    for line in open(os.path.join(src, "countryInfo.txt"), encoding="utf-8"):
        if line.startswith("#"):
            continue
        f = line.rstrip("\n").split("\t")
        if len(f) > 16 and f[16]:
            country_gid[f[0]] = f[16]

    wanted = {c["gid"] for c in cities} | set(country_gid.values())
    names: dict[str, tuple[int, str]] = {}  # gid → (rank, name); الأصغر أفضل
    with zipfile.ZipFile(os.path.join(src, "alternateNamesV2.zip")) as z:
        with z.open("alternateNamesV2.txt") as fh:
            for raw in io.TextIOWrapper(fh, encoding="utf-8"):
                f = raw.rstrip("\n").split("\t")
                if len(f) < 4 or f[2] != "ar" or f[1] not in wanted:
                    continue
                pref, short, colloq, hist = (f + [""] * 10)[4:8]
                if colloq == "1" or hist == "1":
                    continue
                name = clean(f[3])
                if not name or not ARABIC.match(name) or PERSIAN_ONLY.search(name):
                    continue
                rank = 0 if pref == "1" else (2 if short == "1" else 1)
                old = names.get(f[1])
                if old is None or rank < old[0]:
                    names[f[1]] = (rank, name)

    countries = {}
    for cc, gid in country_gid.items():
        n = COUNTRY_OVERRIDE.get(cc) or (names.get(gid) or (0, ""))[1]
        if n:
            countries[cc] = n

    rows = {}
    for c in cities:
        n = names.get(c["gid"])
        country = countries.get(c["cc"])
        if not n or not country:
            continue
        key = (n[1], c["cc"])
        if key in rows and rows[key]["pop"] >= c["pop"]:
            continue  # الاسم نفسه في الدولة نفسها: الأكبر وحده
        rows[key] = dict(c, name=n[1])

    ordered = sorted(rows.values(), key=lambda r: -r["pop"])
    ccs = sorted({r["cc"] for r in ordered})
    tzs = sorted({r["tz"] for r in ordered})
    cidx = {cc: i for i, cc in enumerate(ccs)}
    tidx = {tz: i for i, tz in enumerate(tzs)}
    tuples = [
        [r["name"], round(r["lat"], 4), round(r["lng"], 4), round(r["pop"] / 1000), cidx[r["cc"]], tidx[r["tz"]]]
        for r in ordered
    ]
    dump = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../src/lib/world-cities.ts")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(
            f"""/* منار — قاعدة المدن العالمية (المرحلة ٣٣).
 *
 * مُولَّدة آلياً من GeoNames (رخصة CC BY 4.0) بـ`scripts/build-world-cities.py` — لا
 * تعدّلها يدوياً. {len(tuples)} مدينة يزيد سكانها عن ١٠٠ ألف في {len(ccs)} دولة غير عربية،
 * بأسمائها العربية كما في المصدر، ومنطقة كلٍّ منها الزمنية.
 *
 * تُحمَّل كسولاً (`loadWorldCities` في `places.ts`)، فلا تدخل حزمة الإقلاع.
 * المصدر: https://download.geonames.org/export/dump/
 */

/** مدينة: [الاسم، خط العرض، خط الطول، السكان بالآلاف، فهرس الدولة، فهرس المنطقة الزمنية] */
export type WorldCityTuple = [string, number, number, number, number, number];

/** [رمز ISO، الاسم العربي] */
export const WORLD_COUNTRIES: [string, string][] = {dump([[cc, countries[cc]] for cc in ccs])};

export const WORLD_TIME_ZONES: string[] = {dump(tzs)};

export const WORLD_CITIES: WorldCityTuple[] = {dump(tuples)};
"""
        )
    print(f"wrote {out}: {len(tuples)} cities, {len(ccs)} countries, {len(tzs)} zones")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
