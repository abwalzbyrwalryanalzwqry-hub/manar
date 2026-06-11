import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/statistics")({
  head: () => ({ meta: [{ title: "الإحصائيات — منار" }] }),
  component: Statistics,
});

function Statistics() {
  return (
    <Screen>
      <ScreenHeader title="الإحصائيات" subtitle="تقدمك في رحلتك الإيمانية" backTo="/more" />

      <div className="px-5">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <div className="pattern-arabesque absolute inset-0 opacity-25" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">سلسلة المتابعة</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-6xl font-black tabular-nums">٤٢</span>
              <span className="text-sm font-light text-white/80">يوماً متتالياً</span>
            </div>
            <div className="mt-5 flex justify-between gap-1">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-12 flex-1 rounded-lg ${i < 11 ? "gradient-gold" : "bg-white/10"}`}
                  style={{ opacity: i < 11 ? 0.4 + (i / 14) * 0.6 : 0.3 }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-white/60">
              <span>قبل أسبوعين</span>
              <span>اليوم</span>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>هذا الأسبوع</SectionLabel>
      <div className="grid grid-cols-2 gap-3 px-5">
        <Stat icon={icons.prayer} l="الصلوات" v="٣٥" sub="من ٣٥" />
        <Stat icon={icons.quran} l="آيات مقروءة" v="٤٢٧" sub="+ ١٢٠ هذا الأسبوع" />
        <Stat icon={icons.azkar} l="الأذكار" v="١٤٢" sub="ذكر يومياً" />
        <Stat icon={icons.heart} l="النوافل" v="٢٨" sub="ركعة" />
      </div>

      <SectionLabel>الإنجازات</SectionLabel>
      <div className="space-y-2 px-5">
        {[
          { t: "مواظب الفجر", d: "٣٠ يوماً متتالياً", p: 100 },
          { t: "قارئ الكهف", d: "كل جمعة لمدة شهر", p: 75 },
          { t: "حافظ الأذكار", d: "صباح ومساء يومياً", p: 50 },
        ].map((a) => (
          <div key={a.t} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="gradient-gold flex h-10 w-10 items-center justify-center rounded-xl text-navy shadow-gold">
                  <Icon d={icons.star} size={18} />
                </span>
                <div>
                  <div className="text-sm font-medium">{a.t}</div>
                  <div className="text-[10px] text-muted-foreground">{a.d}</div>
                </div>
              </div>
              <div className="text-xs font-medium text-primary">{a.p}٪</div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="gradient-primary h-full" style={{ width: `${a.p}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

function Stat({ icon, l, v, sub }: { icon: string; l: string; v: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon d={icon} size={16} />
      </span>
      <div className="mt-3 font-display text-3xl font-black tabular-nums">{v}</div>
      <div className="text-xs font-medium">{l}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
