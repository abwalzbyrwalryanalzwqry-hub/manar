import { createFileRoute } from "@tanstack/react-router";
import {
  Arabesque,
  Icon,
  icons,
  RingProgress,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";

export const Route = createFileRoute("/statistics")({
  head: () => ({ meta: [{ title: "الإحصائيات — منار" }] }),
  component: Statistics,
});

const WEEK = [
  { d: "س", v: 0.9 },
  { d: "ج", v: 1.0 },
  { d: "خ", v: 0.85 },
  { d: "أ", v: 1.0 },
  { d: "ث", v: 0.7 },
  { d: "ا", v: 1.0 },
  { d: "ح", v: 0.6 },
];

function Statistics() {
  return (
    <Screen>
      <ScreenHeader title="الإحصائيات" subtitle="تقدمك في رحلتك الإيمانية" backTo="/more" />

      {/* Streak hero */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-10 -top-10 h-60 w-60 text-white/15 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/60">
                <Icon d={icons.flame} size={12} /> سلسلة
              </div>
              <div className="mt-2 font-display text-6xl font-black tabular-nums leading-none">
                ٤٢
              </div>
              <div className="mt-1 text-xs font-light text-white/80">يوماً متتالياً</div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/90 px-2.5 py-0.5 text-[10px] font-medium text-navy">
                <Icon d={icons.trend} size={10} /> أعلى رقم لك
              </div>
            </div>
            <RingProgress value={0.7} size={104} stroke={4}>
              <div className="text-center">
                <div className="font-display text-2xl font-black tabular-nums">٧٠٪</div>
                <div className="text-[9px] uppercase tracking-widest text-white/60">الشهر</div>
              </div>
            </RingProgress>
          </div>
        </div>
      </div>

      {/* Weekly chart */}
      <SectionLabel hint="آخر ٧ أيام">نشاط الأسبوع</SectionLabel>
      <div className="px-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex h-36 items-end justify-between gap-2">
            {WEEK.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-full w-full items-end">
                  <div
                    className={`w-full rounded-t-xl ${i === WEEK.length - 1 ? "gradient-gold" : "gradient-primary"}`}
                    style={{ height: `${d.v * 100}%`, transition: "height 0.6s ease" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{d.d}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-[11px]">
            <div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-widest">
                المعدل
              </div>
              <div className="font-display text-base font-medium tabular-nums">٨٤٪</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-[10px] uppercase tracking-widest">
                + من الأسبوع الماضي
              </div>
              <div className="font-display text-base font-medium tabular-nums text-emerald-500">
                + ١٢٪
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <SectionLabel>هذا الأسبوع</SectionLabel>
      <div className="grid grid-cols-2 gap-3 px-4 stagger">
        <Stat icon={icons.prayer} l="الصلوات" v="٣٥" sub="من ٣٥" tone="gradient-primary" />
        <Stat icon={icons.quran} l="آيات مقروءة" v="٤٢٧" sub="+ ١٢٠ هذا الأسبوع" />
        <Stat icon={icons.azkar} l="الأذكار" v="١٤٢" sub="ذكر يومياً" />
        <Stat icon={icons.heart} l="النوافل" v="٢٨" sub="ركعة" tone="gradient-gold" />
      </div>

      {/* Achievements */}
      <SectionLabel hint="٣ مفتوحة">الإنجازات</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {[
          { t: "مواظب الفجر", d: "٣٠ يوماً متتالياً", p: 100, done: true },
          { t: "قارئ الكهف", d: "كل جمعة لمدة شهر", p: 75 },
          { t: "حافظ الأذكار", d: "صباح ومساء يومياً", p: 50 },
        ].map((a) => (
          <div key={a.t} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${a.done ? "gradient-gold text-navy shadow-gold" : "bg-secondary text-primary"}`}
                >
                  <Icon d={icons.star} size={18} />
                </span>
                <div>
                  <div className="text-sm font-medium">{a.t}</div>
                  <div className="text-[10px] text-muted-foreground">{a.d}</div>
                </div>
              </div>
              <div className="text-xs font-medium text-primary tabular-nums">{a.p}٪</div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${a.done ? "gradient-gold" : "gradient-primary"}`}
                style={{ width: `${a.p}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

function Stat({
  icon,
  l,
  v,
  sub,
  tone,
}: {
  icon: string;
  l: string;
  v: string;
  sub: string;
  tone?: string;
}) {
  const accent = tone ?? "";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-20 blur-2xl ${accent || "bg-primary"}`}
      />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="relative mt-3 font-display text-3xl font-black tabular-nums">{v}</div>
      <div className="relative text-xs font-medium">{l}</div>
      <div className="relative mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
