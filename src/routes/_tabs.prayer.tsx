import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Arabesque, Icon, icons, RingProgress, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/prayer")({
  head: () => ({ meta: [{ title: "أوقات الصلاة — منار" }] }),
  component: Prayer,
});

const PRAYERS = [
  { ar: "الفجر", en: "Fajr", time: "٠٤:٣٢", state: "passed" },
  { ar: "الشروق", en: "Shuruq", time: "٠٦:٠٤", state: "passed" },
  { ar: "الظهر", en: "Dhuhr", time: "١٢:٢٧", state: "passed" },
  { ar: "العصر", en: "Asr", time: "١٥:٤٢", state: "next" },
  { ar: "المغرب", en: "Maghrib", time: "١٨:٥٨", state: "upcoming" },
  { ar: "العشاء", en: "Isha", time: "٢٠:٢٩", state: "upcoming" },
];

function Prayer() {
  const [bells, setBells] = useState<Record<string, boolean>>({
    Fajr: true, Shuruq: false, Dhuhr: true, Asr: true, Maghrib: true, Isha: true,
  });

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

      {/* Luxury countdown widget */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[32px] p-7 text-white shadow-elegant">
          <Arabesque className="absolute -right-12 -top-12 h-72 w-72 text-white/15 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative flex flex-col items-center">
            <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70 backdrop-blur">القادمة</div>
            <div className="mt-5">
              <RingProgress value={0.74} size={220} stroke={6}>
                <div className="text-center">
                  <div className="font-display text-2xl font-light text-white/90">صلاة العصر</div>
                  <div className="mt-2 font-display text-5xl font-black tabular-nums leading-none">٠٢:١٢</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/60">ساعة · دقيقة</div>
                </div>
              </RingProgress>
            </div>
            <div className="mt-6 flex w-full justify-between border-t border-white/15 pt-4 text-[11px]">
              <div>
                <div className="text-white/50">آذان العصر</div>
                <div className="font-display text-base tabular-nums">١٥:٤٢</div>
              </div>
              <div className="text-right">
                <div className="text-white/50">الإقامة</div>
                <div className="font-display text-base tabular-nums">١٥:٥٧</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel hint="اليوم">جدول الصلوات</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {PRAYERS.map((p) => {
          const active = p.state === "next";
          const passed = p.state === "passed";
          return (
            <div
              key={p.en}
              className={`relative overflow-hidden rounded-2xl border transition ${
                active
                  ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card shadow-soft"
              }`}
            >
              {active && <Arabesque className="absolute -right-6 -top-6 h-32 w-32 text-white/15" />}
              <div className="relative flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      active ? "bg-white/20" : "bg-secondary text-primary"
                    }`}
                  >
                    <Icon d={icons.prayer} size={18} />
                  </span>
                  <div>
                    <div className={`text-sm font-medium ${passed ? "opacity-60" : ""}`}>{p.ar}</div>
                    <div className={`text-[10px] uppercase tracking-widest ${active ? "text-white/70" : "text-muted-foreground"}`}>
                      {p.en}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`font-display text-xl font-medium tabular-nums ${passed ? "opacity-60" : ""}`}>{p.time}</div>
                    <div className={`text-[10px] ${active ? "text-white/70" : "text-muted-foreground"}`}>
                      {active ? "القادمة" : passed ? "منتهية" : "قادمة"}
                    </div>
                  </div>
                  <button
                    onClick={() => setBells((b) => ({ ...b, [p.en]: !b[p.en] }))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      active
                        ? "border-white/30 bg-white/15 text-white"
                        : bells[p.en]
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                    aria-label="notification"
                  >
                    <Icon d={bells[p.en] ? icons.bell : icons.bellOff} size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SectionLabel>الإعدادات</SectionLabel>
      <div className="space-y-2 px-4">
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
