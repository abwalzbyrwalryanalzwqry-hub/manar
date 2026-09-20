import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Icon, icons, Screen, ScreenHeader, Skeleton } from "@/components/manar/shell";
import { useSurahText } from "@/hooks/use-surah-text";
import {
  parseTafsir,
  TAFSIR_EDITIONS,
  toArabicDigits,
  useSurahTafsir,
  useTafsirEdition,
} from "@/lib/quran";
import { SURAH_META } from "@/lib/quran/metadata";
import { addBookmark, isBookmarked, removeBookmark, useBookmarks } from "@/lib/quran/bookmarks";

export const Route = createFileRoute("/quran/tafsir")({
  head: () => ({
    meta: [
      { title: "التفسير — منار" },
      {
        name: "description",
        content: "تفسير كل آية من التفسير الميسّر والمختصر في التفسير، بدون إنترنت.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { surah?: number; ayah?: number } => {
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
    };
    return { surah: num(search.surah), ayah: num(search.ayah) };
  },
  component: TafsirScreen,
});

function TafsirScreen() {
  const params = Route.useSearch();
  const navigate = useNavigate();
  const { slug, edition, select } = useTafsirEdition();

  const [surah, setSurah] = useState(() =>
    params.surah && params.surah >= 1 && params.surah <= 114 ? params.surah : 1,
  );
  const [ayah, setAyah] = useState(() => (params.ayah && params.ayah > 0 ? params.ayah : 1));

  const meta = SURAH_META[surah - 1];
  const text = useSurahText(surah);
  const tafsir = useSurahTafsir(slug, surah);
  useBookmarks();

  // Keep the ayah inside range when the surah changes.
  useEffect(() => {
    setAyah((a) => Math.min(Math.max(1, a), meta.ayatCount));
  }, [meta.ayatCount]);

  // Reflect the current position in the URL so the screen is shareable.
  useEffect(() => {
    navigate({ to: "/quran/tafsir", search: { surah, ayah }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, ayah]);

  const ayahText = useMemo(() => {
    if (text.status !== "ready") return null;
    return text.data.ayahs.find((a) => a.n === ayah) ?? null;
  }, [ayah, text]);

  const blocks = useMemo(() => {
    const raw = tafsir.status === "ready" ? tafsir.data[String(ayah)] : undefined;
    return raw ? parseTafsir(raw) : [];
  }, [ayah, tafsir]);

  const saved = isBookmarked(surah, ayah);

  return (
    <Screen>
      <ScreenHeader
        title="التفسير"
        subtitle={`${edition.nameAr} · ${edition.authorAr}`}
        backTo="/quran"
        action={
          <Link
            to="/quran/mushaf"
            search={{ surah, ayah, mode: "surah" }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft"
            aria-label="فتح في المصحف"
          >
            <Icon d={icons.quran} size={18} />
          </Link>
        }
      />

      {/* Edition switch */}
      <div className="px-5">
        <div className="glass grid grid-cols-2 gap-1 rounded-full border border-border/60 p-1.5 shadow-soft">
          {TAFSIR_EDITIONS.map((e) => (
            <button
              key={e.slug}
              onClick={() => select(e.slug)}
              className={`rounded-full py-2 text-[12px] font-medium transition active:scale-95 ${
                slug === e.slug
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground"
              }`}
            >
              {e.nameAr}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
          {edition.descAr}
        </p>
      </div>

      {/* Surah + ayah pickers */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-5">
        <select
          value={surah}
          onChange={(e) => {
            setSurah(Number(e.target.value));
            setAyah(1);
          }}
          className="w-full rounded-2xl border border-border/60 bg-card/70 px-3 py-3 text-sm outline-none"
          dir="rtl"
        >
          {SURAH_META.map((s) => (
            <option key={s.id} value={s.id}>
              {toArabicDigits(s.id)}. {s.nameAr}
            </option>
          ))}
        </select>
        <select
          value={ayah}
          onChange={(e) => setAyah(Number(e.target.value))}
          className="rounded-2xl border border-border/60 bg-card/70 px-3 py-3 text-sm tabular-nums outline-none"
          dir="rtl"
        >
          {Array.from({ length: meta.ayatCount }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              آية {toArabicDigits(n)}
            </option>
          ))}
        </select>
      </div>

      {/* Ayah navigation */}
      <div className="mt-3 flex items-center justify-between px-5">
        <button
          onClick={() => setAyah((a) => Math.max(1, a - 1))}
          disabled={ayah <= 1}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-2 text-[11px] transition disabled:opacity-40 active:scale-95"
        >
          <Icon d={icons.chevron} size={14} />
          السابقة
        </button>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {toArabicDigits(ayah)} / {toArabicDigits(meta.ayatCount)}
        </span>
        <button
          onClick={() => setAyah((a) => Math.min(meta.ayatCount, a + 1))}
          disabled={ayah >= meta.ayatCount}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-2 text-[11px] transition disabled:opacity-40 active:scale-95"
        >
          التالية
          <span className="rotate-180">
            <Icon d={icons.chevron} size={14} />
          </span>
        </button>
      </div>

      {/* Ayah text */}
      <section className="mt-5 px-5">
        <div className="relative overflow-hidden rounded-[28px] border border-gold/25 bg-card/70 p-5 shadow-elegant backdrop-blur-xl">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-gold">
            <span>سورة {meta.nameAr}</span>
            <span className="tabular-nums">الآية {toArabicDigits(ayah)}</span>
          </div>
          {text.status === "loading" && <Skeleton className="mt-4 h-20 rounded-2xl" />}
          {text.status === "error" && (
            <p className="mt-4 text-[12px] text-destructive">تعذّر تحميل نص السورة.</p>
          )}
          {ayahText && (
            <p className="mt-4 text-center font-quran text-[19px] leading-[2.2] text-foreground">
              {ayahText.t}
            </p>
          )}
          {ayahText && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                صفحة {toArabicDigits(ayahText.p)} · الجزء {toArabicDigits(ayahText.j)}
              </span>
              <button
                onClick={() => {
                  if (saved) removeBookmark(surah, ayah);
                  else
                    addBookmark({
                      surah,
                      ayah,
                      page: ayahText.p,
                      juz: ayahText.j,
                      text: ayahText.t,
                      tag: "tadabbur",
                    });
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                  saved
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border/60 bg-background/70 text-muted-foreground"
                }`}
              >
                <Icon d={icons.bookmark} size={13} />
                {saved ? "محفوظة" : "حفظ الآية"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Tafsir body */}
      <section className="mt-4 px-5">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-soft backdrop-blur-xl">
          {tafsir.status === "loading" && (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 rounded-full" />
              ))}
            </div>
          )}

          {tafsir.status === "error" && (
            <div className="text-center">
              <p className="text-[12px] text-destructive">{tafsir.error.message}</p>
              <button
                onClick={tafsir.retry}
                className="mt-3 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-[12px] font-medium text-primary"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {tafsir.status === "ready" && blocks.length === 0 && (
            <p className="text-center text-[12px] text-muted-foreground">
              لا يوجد نص تفسير لهذه الآية في هذه النسخة — جرّب النسخة الأخرى.
            </p>
          )}

          {blocks.map((b, i) =>
            b.kind === "heading" ? (
              <div key={i} className="mt-4 flex items-center gap-2 first:mt-0">
                <span className="h-px w-4 bg-gold" />
                <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold">
                  {b.text}
                </h3>
              </div>
            ) : b.kind === "bullet" ? (
              <div key={i} className="mt-2 flex gap-2 text-[13.5px] leading-[2] text-foreground/90">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <p>{b.text}</p>
              </div>
            ) : (
              <p key={i} className="mt-2.5 text-[13.5px] leading-[2] text-foreground/90">
                {b.text}
              </p>
            ),
          )}

          <div className="mt-5 border-t border-border/50 pt-3 text-[10px] leading-relaxed text-muted-foreground">
            المصدر: {edition.nameAr} — {edition.authorAr} · النص من مكتبة{" "}
            <a
              href={edition.sourceUrl}
              className="text-gold underline"
              target="_blank"
              rel="noreferrer"
            >
              QUL / tarteel
            </a>
          </div>
        </div>
      </section>
    </Screen>
  );
}
