import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/azkar")({
  head: () => ({ meta: [{ title: "الأذكار — منار" }] }),
  component: Azkar,
});

const CATS = [
  { ar: "أذكار الصباح", en: "Morning", count: 28, tone: "gradient-primary" },
  { ar: "أذكار المساء", en: "Evening", count: 28, tone: "gradient-night" },
  { ar: "أذكار النوم", en: "Sleep", count: 16, tone: "bg-navy" },
  { ar: "أذكار الاستيقاظ", en: "Waking", count: 8, tone: "gradient-gold" },
  { ar: "أذكار بعد الصلاة", en: "After Prayer", count: 12, tone: "gradient-primary" },
  { ar: "أذكار متنوعة", en: "Various", count: 40, tone: "bg-navy" },
];

function Azkar() {
  return (
    <Screen>
      <ScreenHeader title="الأذكار" subtitle="حصن المسلم اليومي" />

      {/* Counter card */}
      <div className="px-5">
        <div className="glass relative overflow-hidden rounded-[28px] p-6 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold">عداد التسبيح</div>
          <div className="mt-3 font-display text-7xl font-black text-primary tabular-nums">٣٣</div>
          <div className="mt-1 text-xs text-muted-foreground">سبحان الله</div>
          <div className="mt-5 flex justify-center gap-2">
            <button className="rounded-full border border-border bg-card px-4 py-2 text-xs">إعادة</button>
            <button className="gradient-primary rounded-full px-6 py-2 text-xs font-medium text-primary-foreground shadow-glow">+ ذكر</button>
          </div>
        </div>
      </div>

      <SectionLabel>الفئات</SectionLabel>
      <div className="grid grid-cols-2 gap-3 px-5">
        {CATS.map((c) => (
          <button key={c.en} className={`${c.tone} relative overflow-hidden rounded-3xl p-5 text-right text-white shadow-elegant`}>
            <div className="pattern-arabesque absolute inset-0 opacity-20" />
            <div className="relative">
              <Icon d={icons.azkar} size={26} />
              <div className="mt-4 font-display text-lg font-medium">{c.ar}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-white/70">{c.en}</div>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] backdrop-blur">
                {c.count} ذكر
              </div>
            </div>
          </button>
        ))}
      </div>

      <SectionLabel>ذكر اليوم</SectionLabel>
      <div className="px-5">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <p className="text-right font-display text-base leading-loose">
            «سبحان الله وبحمده، سبحان الله العظيم»
          </p>
          <p className="mt-3 text-xs text-muted-foreground">كلمتان خفيفتان على اللسان، ثقيلتان في الميزان.</p>
        </div>
      </div>
    </Screen>
  );
}
