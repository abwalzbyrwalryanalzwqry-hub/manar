import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/prayer")({
  head: () => ({ meta: [{ title: "أوقات الصلاة — منار" }] }),
  component: Prayer,
});

const PRAYERS = [
  { ar: "الفجر", en: "Fajr", time: "٠٤:٣٢", passed: true },
  { ar: "الشروق", en: "Shuruq", time: "٠٦:٠٤", passed: true },
  { ar: "الظهر", en: "Dhuhr", time: "١٢:٢٧", passed: true },
  { ar: "العصر", en: "Asr", time: "١٥:٤٢", next: true },
  { ar: "المغرب", en: "Maghrib", time: "١٨:٥٨" },
  { ar: "العشاء", en: "Isha", time: "٢٠:٢٩" },
];

function Prayer() {
  return (
    <Screen>
      <ScreenHeader
        title="أوقات الصلاة"
        subtitle="الرياض · ١٥ شعبان ١٤٤٧"
        action={
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft">
            <Icon d={icons.settings} size={18} />
          </button>
        }
      />

      <div className="px-5">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <div className="pattern-arabesque absolute inset-0 opacity-25" />
          <div className="relative text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">القادمة</div>
            <div className="mt-2 font-display text-xl font-light">صلاة العصر</div>
            <div className="mt-3 font-display text-6xl font-black tabular-nums tracking-tight">٠٢:١٢:٤٤</div>
            <div className="mt-2 text-xs font-light text-white/70">حتى الأذان</div>
          </div>
        </div>
      </div>

      <SectionLabel hint="اليوم">جدول الصلوات</SectionLabel>
      <div className="space-y-2 px-5">
        {PRAYERS.map((p) => (
          <div
            key={p.en}
            className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition ${
              p.next
                ? "gradient-primary border-transparent text-primary-foreground shadow-glow"
                : "border-border bg-card shadow-soft"
            } ${p.passed && !p.next ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.next ? "bg-white/20" : "bg-secondary text-primary"}`}>
                <Icon d={icons.prayer} size={18} />
              </span>
              <div>
                <div className="text-sm font-medium">{p.ar}</div>
                <div className={`text-[10px] uppercase tracking-widest ${p.next ? "text-white/70" : "text-muted-foreground"}`}>{p.en}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl font-medium tabular-nums">{p.time}</div>
              <div className={`text-[10px] ${p.next ? "text-white/70" : "text-muted-foreground"}`}>
                {p.next ? "القادمة" : p.passed ? "منتهية" : "قادمة"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>الإعدادات</SectionLabel>
      <div className="space-y-2 px-5">
        {[
          { l: "طريقة الحساب", v: "أم القرى" },
          { l: "المذهب", v: "الجمهور" },
          { l: "تنبيه قبل الأذان", v: "١٠ دقائق" },
        ].map((r) => (
          <button key={r.l} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
            <span className="text-sm">{r.l}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {r.v}
              <span className="rotate-180"><Icon d={icons.chevron} size={14} /></span>
            </span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
