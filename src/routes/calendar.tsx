import { createFileRoute } from "@tanstack/react-router";
import { Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "التقويم — منار" }] }),
  component: CalendarScreen,
});

const DAYS = ["س", "ج", "خ", "أ", "ث", "ا", "ح"];

function CalendarScreen() {
  const today = 15;
  return (
    <Screen>
      <ScreenHeader title="التقويم" subtitle="هجري · ميلادي" backTo="/more" />

      <div className="px-5">
        <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <button className="text-xs text-muted-foreground">‹ السابق</button>
            <div className="text-center">
              <div className="font-display text-lg font-medium">شعبان ١٤٤٧</div>
              <div className="text-[10px] text-muted-foreground">يونيو 2026</div>
            </div>
            <button className="text-xs text-muted-foreground">التالي ›</button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {DAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
              const isToday = d === today;
              const hasEvent = [1, 13, 27].includes(d);
              return (
                <button
                  key={d}
                  className={`aspect-square rounded-xl text-xs tabular-nums transition ${
                    isToday
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    <span className="font-medium">{d}</span>
                    {hasEvent && <span className={`mt-0.5 h-1 w-1 rounded-full ${isToday ? "bg-white" : "bg-gold"}`} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <SectionLabel>المناسبات القادمة</SectionLabel>
      <div className="space-y-2 px-5">
        {[
          { d: "١ رمضان", g: "27 يونيو", t: "بداية شهر رمضان", c: "gradient-primary" },
          { d: "٢٧ رمضان", g: "23 يوليو", t: "ليلة القدر (مرجح)", c: "gradient-gold" },
          { d: "١ شوال", g: "31 يوليو", t: "عيد الفطر", c: "gradient-night" },
        ].map((e) => (
          <div key={e.d} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-2xl ${e.c} text-white text-[10px] shadow-soft`}>
              <span className="font-display text-base font-bold">{e.d.split(" ")[0]}</span>
              <span className="opacity-80">{e.d.split(" ")[1]}</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{e.t}</div>
              <div className="text-[11px] text-muted-foreground">{e.g}</div>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
