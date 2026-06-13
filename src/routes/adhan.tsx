import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Arabesque, Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { ADHAN_CATEGORIES, useAdhanSettings } from "@/lib/adhan-settings";
import type { AdhanVariant } from "@/lib/adhan-sound";
import { playAdhan, stopAdhan } from "@/lib/adhan-sound";

export const Route = createFileRoute("/adhan")({
  head: () => ({ meta: [{ title: "مكتبة الأذان — منار" }] }),
  component: AdhanLibrary,
});

type Target = "general" | "fajr";

function AdhanLibrary() {
  const { settings, update } = useAdhanSettings();
  const [target, setTarget] = useState<Target>("general");
  const [playing, setPlaying] = useState<AdhanVariant | null>(null);

  const selected = target === "fajr" ? settings.fajrAdhan : settings.selectedAdhan;

  const preview = (v: AdhanVariant) => {
    if (playing === v) { stopAdhan(); setPlaying(null); return; }
    setPlaying(v);
    playAdhan(v, { volume: settings.volume, onEnd: () => setPlaying(null) });
  };
  const choose = (v: AdhanVariant) => {
    if (target === "fajr") update({ fajrAdhan: v, fajrUseSeparate: true });
    else update({ selectedAdhan: v });
  };

  return (
    <Screen>
      <ScreenHeader title="مكتبة الأذان" subtitle="اختر صوت الأذان لكل صلاة" backTo="/more" />

      {/* Hero */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -left-10 -top-10 h-56 w-56 text-white/15" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">المكتبة الصوتية</div>
            <div className="mt-2 font-display text-2xl">٥ أصوات أذان فاخرة</div>
            <div className="mt-1 text-xs text-white/70">جودة عالية · استماع مسبق · يعمل بدون إنترنت</div>
          </div>
        </div>
      </div>

      {/* Target switch */}
      <div className="mt-5 px-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1 shadow-soft">
          {([
            { id: "general" as Target, l: "كل الصلوات" },
            { id: "fajr"    as Target, l: "أذان الفجر" },
          ]).map((t) => {
            const active = target === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTarget(t.id)}
                className={`rounded-xl py-2.5 text-xs transition ${
                  active ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                }`}
              >
                {t.l}
              </button>
            );
          })}
        </div>
        {target === "fajr" && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            يمكن اختيار أذان مخصص لصلاة الفجر فقط
          </p>
        )}
      </div>

      <SectionLabel hint="انقر للاستماع">الأصوات المتاحة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {ADHAN_CATEGORIES.map((c) => {
          const isSelected = c.id === selected;
          const isPlaying = playing === c.id;
          return (
            <div
              key={c.id}
              className={`relative overflow-hidden rounded-2xl border transition ${
                isSelected
                  ? "border-transparent gradient-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card shadow-soft"
              }`}
            >
              {isSelected && <Arabesque className="absolute -right-6 -top-6 h-32 w-32 text-white/15" />}
              <div className="relative flex items-center gap-3 p-4">
                <button
                  onClick={() => preview(c.id)}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition ${
                    isSelected
                      ? "border-white/30 bg-white/15 text-white"
                      : "border-border bg-secondary text-primary"
                  }`}
                  aria-label="استماع"
                >
                  <Icon d={isPlaying ? icons.pause : icons.play} size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className={`text-[11px] truncate ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                    {c.reciter} {c.origin !== "—" ? `· ${c.origin}` : ""}
                  </div>
                  <div className={`mt-1 flex gap-2 text-[10px] ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                    {c.tone !== "—" && <span className={`rounded-full px-2 py-0.5 ${isSelected ? "bg-white/10" : "bg-secondary"}`}>{c.tone}</span>}
                    {c.duration !== "—" && <span className={`rounded-full px-2 py-0.5 ${isSelected ? "bg-white/10" : "bg-secondary"}`}>{c.duration}</span>}
                  </div>
                </div>
                <button
                  onClick={() => choose(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "border border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  {isSelected ? "محدد" : "اختر"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SectionLabel>إعدادات الفجر</SectionLabel>
      <div className="space-y-2 px-4">
        <Row
          label="استخدام أذان مخصص للفجر"
          hint="غالباً ما يُستخدم أذان الفجر بصوت مختلف"
          on={settings.fajrUseSeparate}
          onToggle={() => update({ fajrUseSeparate: !settings.fajrUseSeparate })}
        />
        <Row
          label="تذكير الفجر"
          hint="تنبيه ناعم قبل صلاة الفجر"
          on={settings.fajrReminderEnabled}
          onToggle={() => update({ fajrReminderEnabled: !settings.fajrReminderEnabled })}
        />
      </div>
    </Screen>
  );
}

function Row({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-right shadow-soft"
    >
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? "gradient-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${on ? "right-0.5" : "right-[22px]"}`} />
      </span>
    </button>
  );
}
