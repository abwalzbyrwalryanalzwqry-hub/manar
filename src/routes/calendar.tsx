import { createFileRoute } from "@tanstack/react-router";
import {
  Arabesque,
  Icon,
  icons,
  Screen,
  ScreenHeader,
  SectionLabel,
} from "@/components/manar/shell";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "التقويم — منار" }] }),
  component: CalendarScreen,
});

const DAY_LABELS = ["س", "ج", "خ", "أ", "ث", "ا", "ح"]; // Sat..Fri starting Saturday

function CalendarScreen() {
  const today = 15;
  const events: Record<number, { color: string }> = {
    1: { color: "bg-primary" },
    13: { color: "bg-gold" },
    15: { color: "bg-primary" },
    27: { color: "bg-rose-400" },
  };

  return (
    <Screen>
      <ScreenHeader title="التقويم" subtitle="هجري · ميلادي" backTo="/more" />

      {/* Hero strip with today's date */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-12 -top-10 h-56 w-56 text-white/15" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">اليوم</div>
              <div className="mt-1 font-display text-5xl font-black tabular-nums leading-none">
                ١٥
              </div>
              <div className="mt-1 font-display text-base font-light text-white/90">شعبان ١٤٤٧</div>
              <div className="text-[11px] text-white/60">الخميس · 11 يونيو 2026</div>
            </div>
            <div className="text-right text-[11px] text-white/70">
              <div>الفجر · ٠٤:٣٢</div>
              <div>المغرب · ١٨:٥٨</div>
              <div className="mt-2 inline-flex rounded-full bg-gold/90 px-2.5 py-0.5 text-[10px] text-navy">
                صيام
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar card */}
      <div className="px-4 pt-4">
        <div className="rounded-[28px] border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground">
              <Icon d={icons.chevron} size={14} />
            </button>
            <div className="text-center">
              <div className="font-display text-base font-medium">شعبان ١٤٤٧</div>
              <div className="text-[10px] text-muted-foreground">يونيو 2026</div>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground">
              <span className="rotate-180">
                <Icon d={icons.chevron} size={14} />
              </span>
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {DAY_LABELS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
              const isToday = d === today;
              const e = events[d];
              return (
                <button
                  key={d}
                  className={`aspect-square rounded-xl transition relative ${
                    isToday
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    <span className="text-xs font-medium tabular-nums">{d}</span>
                    {e && (
                      <span
                        className={`mt-0.5 h-1 w-1 rounded-full ${isToday ? "bg-white" : e.color}`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex justify-center gap-4 border-t border-border pt-4 text-[10px] text-muted-foreground">
            <Legend dot="bg-primary" label="مناسبة" />
            <Legend dot="bg-gold" label="ليلة فاضلة" />
            <Legend dot="bg-rose-400" label="عيد" />
          </div>
        </div>
      </div>

      <SectionLabel hint="٣ قادمة">المناسبات القادمة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {[
          {
            d: "١",
            m: "رمضان",
            g: "27 يونيو",
            t: "بداية شهر رمضان",
            days: "بعد ١٢ يوم",
            c: "gradient-primary",
          },
          {
            d: "٢٧",
            m: "رمضان",
            g: "23 يوليو",
            t: "ليلة القدر (مرجح)",
            days: "بعد ٣٨ يوم",
            c: "gradient-gold",
          },
          {
            d: "١",
            m: "شوال",
            g: "31 يوليو",
            t: "عيد الفطر",
            days: "بعد ٤٦ يوم",
            c: "gradient-night",
          },
        ].map((e) => (
          <div
            key={e.t}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <div
              className={`flex h-16 w-14 flex-col items-center justify-center rounded-2xl ${e.c} text-white shadow-soft`}
            >
              <span className="font-display text-xl font-black leading-none">{e.d}</span>
              <span className="mt-1 text-[9px] opacity-80">{e.m}</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{e.t}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <Icon d={icons.calendar} size={11} /> {e.g} · {e.days}
              </div>
            </div>
            <span className="rotate-180 text-muted-foreground">
              <Icon d={icons.chevron} size={14} />
            </span>
          </div>
        ))}
      </div>
    </Screen>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}
