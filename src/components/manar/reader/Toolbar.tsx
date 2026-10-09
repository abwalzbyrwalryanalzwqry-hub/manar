import { MORE_ACTIONS } from "@/components/manar/reader/constants";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/manar/shell";
import { icons } from "@/components/manar/shell";
import { toArabicDigits } from "@/lib/quran";
import { formatPercent } from "@/lib/format";
import { RelativeTime, SelectorPill } from "@/components/manar/reader/widgets";
import { Sep } from "@/components/manar/reader/Sep";
import { useT } from "@/lib/quran/reader-text";
import type { PaperKey } from "@/lib/quran/reading-prefs";

/** ألوان معاينة الورق في منتقي الورق. */
const PAPER_SWATCH: Record<PaperKey, string> = {
  auto: "bg-gradient-to-br from-white to-zinc-800",
  sepia: "bg-[#f3e7cf]",
  night: "bg-[#0d1210]",
  black: "bg-black",
};
const PAPERS: PaperKey[] = ["auto", "sepia", "night", "black"];

/**
 * شريط القارئ العلوي: اسم السورة، والخيارات، وتبديل السورة/المصحف.
 * الورق يُختار مباشرة من أربعة ألوان ظاهرة (كان زراً يدور بينها دون معاينة).
 */
export function ReaderToolbar({
  headerSurah,
  mode,
  paper,
  onOpenSurah,
  onEnterImmersive,
  onPaper,
  onSwitchMode,
}: {
  headerSurah: { nameAr: string; nameEn: string };
  mode: "surah" | "mushaf";
  paper: PaperKey;
  onOpenSurah: () => void;
  onEnterImmersive: () => void;
  onPaper: (paper: PaperKey) => void;
  onSwitchMode: (m: "surah" | "mushaf") => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  return (
    <>
      {/* Premium app bar */}
      <header className="sticky top-0 z-30 animate-fade-up" data-reader-header>
        <div className="mx-4 mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-full border border-border/60 bg-card/80 px-3 py-2 shadow-elegant backdrop-blur-2xl">
          <Link
            to="/quran"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 text-foreground shadow-soft transition hover:shadow-elegant active:scale-95"
            aria-label={t("mushafReader.toolbar.back")}
          >
            <span className="rotate-180">
              <Icon d={icons.back} size={18} />
            </span>
          </Link>
          <button
            onClick={onOpenSurah}
            className="min-w-0 text-center transition active:scale-[0.98]"
            aria-label={t("mushafReader.toolbar.pickSurah", { surah: headerSurah.nameAr })}
          >
            <div className="font-display text-base font-medium leading-tight truncate">
              {headerSurah.nameAr}
            </div>
            <div className="text-[0.625rem] uppercase tracking-[0.3em] text-muted-foreground">
              {headerSurah.nameEn}
              <Sep />
              {t("mushafReader.toolbar.brand")}
            </div>
          </button>
          <button
            onClick={() => setShowMore((v) => !v)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 text-foreground shadow-soft transition hover:shadow-elegant active:scale-95 ${
              showMore ? "ring-2 ring-primary/40" : ""
            }`}
            aria-label={t("mushafReader.toolbar.more")}
            aria-expanded={showMore}
          >
            <Icon d={icons.more} size={18} />
          </button>
        </div>

        {/* More options popover */}
        {showMore && (
          <div className="mx-4 mt-2 animate-scale-in rounded-2xl border border-border/60 bg-card/90 p-2 shadow-elegant backdrop-blur-2xl">
            <div className="grid grid-cols-4 gap-2">
              {MORE_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => {
                    setShowMore(false);
                    navigate({ to: a.to });
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-background/60 p-3 text-center transition hover:-translate-y-0.5 hover:shadow-soft active:scale-95"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon d={a.icon} size={16} />
                  </span>
                  <span className="text-[0.625rem] font-medium text-foreground/90">{a.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
              <button
                onClick={() => {
                  setShowMore(false);
                  onEnterImmersive();
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 text-[0.6875rem] font-medium text-foreground/90 transition active:scale-95"
              >
                <Icon d={icons.fullscreen} size={15} />
                {t("mushafReader.toolbar.fullscreen")}
              </button>
              <div
                className="flex items-center justify-around rounded-xl border border-border/50 bg-background/60 px-2 py-1.5"
                role="radiogroup"
                aria-label={t("mushafReader.paper.label")}
              >
                {PAPERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={paper === p}
                    aria-label={t(`mushafReader.paper.${p}`)}
                    title={t(`mushafReader.paper.${p}`)}
                    onClick={() => onPaper(p)}
                    className={`h-7 w-7 rounded-full border transition active:scale-90 ${PAPER_SWATCH[p]} ${
                      paper === p
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                        : "border-border"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Reading mode switch — السورة / المصحف */}
      <div className="mt-4 px-4">
        <div className="glass grid grid-cols-2 gap-1 rounded-full border border-border/60 p-1.5 shadow-soft">
          {(["surah", "mushaf"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => onSwitchMode(m)}
                className={`rounded-full py-2 text-[0.75rem] font-medium transition active:scale-95 ${
                  active
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                {m === "surah"
                  ? t("mushafReader.toolbar.surahMode")
                  : t("mushafReader.toolbar.mushafMode")}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** اختيار السورة والجزء وشريط التقدم المختصر في وضع السورة. */
export function SurahProgress({
  surahNameAr,
  ayatCount,
  juzId,
  hereAyah,
  herePage,
  updatedAt,
  progressPercent,
  onOpenSurah,
  onOpenJuz,
}: {
  surahNameAr: string;
  ayatCount: number;
  juzId: number;
  hereAyah: number;
  herePage: number | null;
  updatedAt: number;
  progressPercent: number;
  onOpenSurah: () => void;
  onOpenJuz: () => void;
}) {
  const t = useT();
  return (
    <>
      {/* Selectors row */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-4 stagger">
        <SelectorPill
          label={t("mushafReader.toolbar.surahMode")}
          value={surahNameAr}
          iconKey="quran"
          onClick={onOpenSurah}
        />
        <SelectorPill
          label={t("mushafReader.toolbar.juz")}
          value={toArabicDigits(juzId)}
          iconKey="bookmark"
          onClick={onOpenJuz}
        />
      </div>

      {/* شريط تقدم مختصر بدل البطاقة الكبيرة: النص يبدأ مبكراً */}
      <div className="mt-3 px-5" aria-label={t("mushafReader.toolbar.progress")}>
        <div className="flex items-center justify-between text-[0.625rem] tabular-nums text-muted-foreground">
          <span>
            {t("mushafReader.toolbar.ayahOf", {
              ayah: toArabicDigits(hereAyah),
              total: toArabicDigits(ayatCount),
            })}
            {herePage ? (
              <>
                <Sep />
                {t("mushafReader.meta.page", { n: toArabicDigits(herePage) })}
              </>
            ) : null}
          </span>
          <span>
            <RelativeTime at={updatedAt} />
            <Sep />
            {formatPercent(progressPercent)}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="gradient-gold h-full transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </>
  );
}
