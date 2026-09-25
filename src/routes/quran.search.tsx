import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { EmptyState, Icon, icons, Screen, ScreenHeader, Skeleton } from "@/components/manar/shell";
import {
  clearRecentSearches,
  pushRecentSearch,
  quranSearchService,
  readRecentSearches,
  searchSurahNames,
  toArabicDigits,
  type AyahHit,
  type SearchScope,
} from "@/lib/quran";
import { SURAH_META } from "@/lib/quran/metadata";
import { JUZ_META } from "@/lib/quran/juz-metadata";

export const Route = createFileRoute("/quran/search")({
  head: () => ({
    meta: [
      { title: "البحث في القرآن — منار" },
      {
        name: "description",
        content: "بحث فوري في ٦٢٣٦ آية بدون تشكيل أو همزات، مع تمييز الكلمات المطابقة.",
      },
    ],
  }),
  component: QuranSearch,
});

const SUGGESTIONS = [
  "الرحمن",
  "الصبر",
  "يا أيها الذين آمنوا",
  "الجنة",
  "التقوى",
  "الوالدين",
  "الرزق",
];

const SCOPES: { key: SearchScope; label: string }[] = [
  { key: "all", label: "كل القرآن" },
  { key: "surah", label: "سورة" },
  { key: "juz", label: "جزء" },
];

function QuranSearch() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [surah, setSurah] = useState(1);
  const [juz, setJuz] = useState(1);
  const [ready, setReady] = useState(quranSearchService.ready);
  const [progress, setProgress] = useState(quranSearchService.progress);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecentSearches());
    const off = quranSearchService.onProgress((loaded, total) => setProgress({ loaded, total }));
    quranSearchService
      .build()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "تعذّر تهيئة فهرس البحث"));
    return off;
  }, []);

  // البحث يعمل على قيمة مؤجّلة حتى تبقى الكتابة سلسة على الأجهزة المتوسطة.
  const deferredQ = useDeferredValue(q);
  const trimmed = deferredQ.trim();
  const active = trimmed.length > 1;

  const { hits: results, total } = useMemo(() => {
    if (!ready || !active) return { hits: [], total: 0 };
    return quranSearchService.query(trimmed, { scope, surah, juz, limit: 100 });
  }, [active, juz, ready, scope, surah, trimmed]);

  const nameHits = useMemo(() => (active ? searchSurahNames(trimmed, 6) : []), [active, trimmed]);

  const commit = useCallback((value: string) => {
    setQ(value);
    if (value.trim().length > 1) setRecent(pushRecentSearch(value));
  }, []);

  const percent = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <Screen>
      <ScreenHeader
        title="البحث في القرآن"
        subtitle="٦٢٣٦ آية · بحث فوري بدون إنترنت"
        backTo="/quran"
      />

      <div className="px-5">
        <div className="glass flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3">
          <Icon d={icons.search} size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => commit(q)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(q);
            }}
            placeholder="اكتب كلمة أو جزءًا من آية…"
            className="flex-1 bg-transparent text-right text-sm outline-none placeholder:text-muted-foreground"
            dir="rtl"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-[11px] text-muted-foreground">
              مسح
            </button>
          )}
        </div>

        {/* Scope filter */}
        <div className="mt-3 flex items-center gap-2">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                scope === s.key
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-card/70 text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {scope === "surah" && (
          <select
            value={surah}
            onChange={(e) => setSurah(Number(e.target.value))}
            className="mt-2 w-full rounded-2xl border border-border/60 bg-card/70 px-3 py-2.5 text-sm outline-none"
            dir="rtl"
          >
            {SURAH_META.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}. {s.nameAr}
              </option>
            ))}
          </select>
        )}

        {scope === "juz" && (
          <select
            value={juz}
            onChange={(e) => setJuz(Number(e.target.value))}
            className="mt-2 w-full rounded-2xl border border-border/60 bg-card/70 px-3 py-2.5 text-sm outline-none"
            dir="rtl"
          >
            {JUZ_META.map((j) => (
              <option key={j.id} value={j.id}>
                الجزء {j.id} — {SURAH_META[j.start.surah - 1].nameAr}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Index build progress */}
      {!ready && !error && (
        <div className="mt-5 px-5">
          <div className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-soft backdrop-blur-xl">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>جارٍ تهيئة فهرس البحث…</span>
              <span className="tabular-nums">{toArabicDigits(percent)}٪</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="gradient-primary h-full transition-all duration-300"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              يُبنى الفهرس مرة واحدة من ملفات المصحف المحلية — يعمل بعدها بدون إنترنت.
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-3xl" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 px-5">
          <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-4 text-[12px] text-destructive">
            {error}
          </div>
        </div>
      )}

      {/* Idle state: recent + suggestions */}
      {ready && !active && (
        <>
          {recent.length > 0 && (
            <div className="mt-6 px-5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  بحثك الأخير
                </div>
                <button
                  onClick={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                  className="text-[10px] text-muted-foreground"
                >
                  مسح الكل
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQ(r)}
                    className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[11px]"
                  >
                    <Icon d={icons.refresh} size={12} />
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 px-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              اقتراحات
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => commit(s)}
                  className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[11px] text-gold"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Surah-name matches */}
      {ready && active && nameHits.length > 0 && (
        <div className="mt-6 px-5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            سور مطابقة
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {nameHits.map((s) => (
              <Link
                key={s.id}
                to="/quran/mushaf"
                search={{ surah: s.id, mode: "surah" }}
                className="rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[11px]"
              >
                {s.nameAr}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ayah results */}
      {ready && active && (
        <div className="mt-6 space-y-3 px-5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {toArabicDigits(total)} آية مطابقة
            {total > results.length && ` · تُعرض ${toArabicDigits(results.length)}`}
          </div>
          {results.map((hit) => (
            <ResultCard key={`${hit.surah}-${hit.ayah}`} hit={hit} />
          ))}
          {!results.length && (
            <EmptyState
              icon={icons.search}
              title="لا نتائج"
              hint="جرّب كلمة أخرى، أو وسّع نطاق البحث إلى كل القرآن."
            />
          )}
        </div>
      )}
    </Screen>
  );
}

function ResultCard({ hit }: { hit: AyahHit }) {
  const matched = new Set(hit.matches);
  return (
    <Link
      to="/quran/mushaf"
      search={{ surah: hit.surah, ayah: hit.ayah, mode: "surah" }}
      className="block rounded-3xl border border-border/60 bg-card/70 p-4 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          سورة {hit.nameAr} · الآية {toArabicDigits(hit.ayah)}
        </span>
        <span className="tabular-nums">
          صفحة {toArabicDigits(hit.page)} · جزء {toArabicDigits(hit.juz)}
        </span>
      </div>
      <p className="mt-2 font-quran text-[17px] leading-[2.1]">
        {hit.words.map((w, i) => (
          <span key={i} className={matched.has(i) ? "rounded bg-gold/20 px-0.5 text-gold" : ""}>
            {w}{" "}
          </span>
        ))}
      </p>
    </Link>
  );
}
