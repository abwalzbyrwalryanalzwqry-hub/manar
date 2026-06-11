import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Arabesque, Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/quran")({
  head: () => ({ meta: [{ title: "القرآن الكريم — منار" }] }),
  component: Quran,
});

const SURAHS = [
  { n: 1, ar: "الفاتحة", en: "Al-Fatiha", v: 7, type: "مكية" },
  { n: 2, ar: "البقرة", en: "Al-Baqarah", v: 286, type: "مدنية" },
  { n: 3, ar: "آل عمران", en: "Al-Imran", v: 200, type: "مدنية" },
  { n: 4, ar: "النساء", en: "An-Nisa", v: 176, type: "مدنية" },
  { n: 18, ar: "الكهف", en: "Al-Kahf", v: 110, type: "مكية" },
  { n: 36, ar: "يس", en: "Ya-Sin", v: 83, type: "مكية" },
  { n: 55, ar: "الرحمن", en: "Ar-Rahman", v: 78, type: "مدنية" },
  { n: 67, ar: "الملك", en: "Al-Mulk", v: 30, type: "مكية" },
];

const FAVORITES = [
  { n: 1, ar: "الفاتحة" },
  { n: 36, ar: "يس" },
  { n: 67, ar: "الملك" },
  { n: 18, ar: "الكهف" },
];

const TABS = ["السور", "الأجزاء", "المفضلة"] as const;

function Quran() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("السور");

  return (
    <Screen>
      <ScreenHeader
        title="القرآن الكريم"
        subtitle="١١٤ سورة · ٣٠ جزءاً · ٦٢٣٦ آية"
        action={
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft">
            <Icon d={icons.search} size={18} />
          </button>
        }
      />

      {/* Continue reading hero */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-[28px] p-5 text-white shadow-elegant">
          <Arabesque className="absolute -left-10 -bottom-10 h-56 w-56 text-gold/25" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex items-center justify-between">
            <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.3em] backdrop-blur">متابعة القراءة</div>
            <span className="text-[10px] text-white/60">منذ ٣ ساعات</span>
          </div>
          <div className="relative mt-5 flex items-end justify-between">
            <div>
              <div className="font-display text-3xl font-medium">سورة الكهف</div>
              <div className="mt-1 text-xs font-light text-white/70">آية ٤٥ · صفحة ٢٩٩ · جزء ١٥</div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                  <div className="gradient-gold h-full w-[62%]" />
                </div>
                <span className="text-[10px] text-white/70 tabular-nums">٦٢٪</span>
              </div>
            </div>
            <button className="gradient-gold flex h-14 w-14 items-center justify-center rounded-full text-navy shadow-gold">
              <Icon d={icons.play} size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Last read mini-list */}
      <SectionLabel hint="آخر ٣">آخر قراءة</SectionLabel>
      <div className="overflow-x-auto px-4">
        <div className="flex gap-3 pb-1">
          {[
            { ar: "الكهف", n: 18, p: 62 },
            { ar: "البقرة", n: 2, p: 28 },
            { ar: "يس", n: 36, p: 45 },
          ].map((s) => (
            <button key={s.n} className="w-44 shrink-0 rounded-2xl border border-border bg-card p-4 text-right shadow-soft">
              <div className="flex items-center justify-between">
                <SurahBadge n={s.n} />
                <Icon d={icons.bookmark} size={14} />
              </div>
              <div className="mt-3 font-display text-lg font-medium">{s.ar}</div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div className="gradient-primary h-full" style={{ width: `${s.p}%` }} />
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">{s.p}٪ مكتمل</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 px-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2.5 text-xs font-medium transition ${
              tab === t ? "gradient-primary text-primary-foreground shadow-glow" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "السور" && (
        <div className="mt-4 space-y-2 px-4 stagger">
          {SURAHS.map((s) => (
            <button key={s.n} className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft transition hover:shadow-elegant">
              <div className="flex items-center gap-3">
                <SurahBadge n={s.n} />
                <div className="text-right">
                  <div className="font-display text-base font-medium">{s.ar}</div>
                  <div className="text-[10px] text-muted-foreground">{s.en} · {s.type}</div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-widest text-gold">آيات</div>
                <div className="text-sm font-medium tabular-nums">{s.v}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "الأجزاء" && (
        <div className="mt-4 grid grid-cols-3 gap-2 px-4 stagger">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((j) => (
            <button key={j} className="rounded-2xl border border-border bg-card p-3 text-center shadow-soft">
              <div className="text-[10px] uppercase tracking-widest text-gold">جزء</div>
              <div className="font-display text-2xl font-bold tabular-nums">{j}</div>
            </button>
          ))}
        </div>
      )}

      {tab === "المفضلة" && (
        <div className="mt-4 space-y-2 px-4 stagger">
          {FAVORITES.map((s) => (
            <div key={s.n} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 shadow-soft">
              <div className="flex items-center gap-3">
                <SurahBadge n={s.n} />
                <div className="font-display text-base font-medium">{s.ar}</div>
              </div>
              <span className="text-gold"><Icon d={icons.bookmark} size={16} /></span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

function SurahBadge({ n }: { n: number }) {
  return (
    <span className="relative flex h-11 w-11 items-center justify-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 text-primary">
        <path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" fill="currentColor" opacity="0.08" />
        <path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
      <span className="relative font-display text-xs font-medium tabular-nums">{n}</span>
    </span>
  );
}
