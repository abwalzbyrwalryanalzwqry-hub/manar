import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Arabesque, Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { ADJUSTABLE_PRAYERS, DEFAULT_IQAMA, IQAMA_CATEGORIES, useAdhanSettings } from "@/lib/adhan-settings";
import { PRAYER_LABELS, type PrayerKey } from "@/lib/prayer";
import { toArabicDigits } from "@/lib/format";
import { playIqama, stopAdhan, type IqamaVariant } from "@/lib/adhan-sound";

export const Route = createFileRoute("/iqama")({
  head: () => ({ meta: [{ title: "الإقامة — منار" }] }),
  component: IqamaSettings,
});

function IqamaSettings() {
  const { settings, update, updateDeep } = useAdhanSettings();
  const [playing, setPlaying] = useState<IqamaVariant | null>(null);

  const previewIqama = (v: IqamaVariant) => {
    if (playing === v) { stopAdhan(); setPlaying(null); return; }
    setPlaying(v);
    playIqama(v, {
      volume: settings.volume,
      onEnd: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
  };

  const setOffset = (p: PrayerKey, v: number) =>
    updateDeep((s) => ({ ...s, iqamaOffsets: { ...s.iqamaOffsets, [p]: Math.max(0, Math.min(60, v)) } }));

  return (
    <Screen>
      <ScreenHeader title="إعدادات الإقامة" subtitle="مكتبة الإقامة والفاصل بين الأذان والإقامة" backTo="/more" />

      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-10 -top-10 h-56 w-56 text-white/15" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Icon d={icons.prayer} size={22} />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">الإقامة</div>
              <div className="font-display text-xl">٤ أنواع إقامة فاخرة</div>
              <div className="mt-0.5 text-[11px] text-white/70">ملفات صوتية حقيقية · MP3 / WAV / OGG</div>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>الإعدادات العامة</SectionLabel>
      <div className="space-y-2 px-4">
        <Toggle
          label="تفعيل تنبيه الإقامة"
          hint="إشعار عند موعد الإقامة"
          on={settings.iqamaEnabled}
          onToggle={() => update({ iqamaEnabled: !settings.iqamaEnabled })}
        />
        <Toggle
          label="صوت الإقامة"
          hint="تشغيل ملف صوت الإقامة"
          on={settings.iqamaSoundEnabled}
          onToggle={() => update({ iqamaSoundEnabled: !settings.iqamaSoundEnabled })}
        />
      </div>

      <SectionLabel hint="انقر للاستماع">مكتبة الإقامة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {IQAMA_CATEGORIES.map((c) => {
          const isSel = settings.iqamaVariant === c.id;
          const isPlaying = playing === c.id;
          return (
            <div
              key={c.id}
              className={`relative overflow-hidden rounded-2xl border transition ${
                isSel ? "border-transparent gradient-primary text-primary-foreground shadow-glow" : "border-border bg-card shadow-soft"
              }`}
            >
              {isSel && <Arabesque className="absolute -right-6 -top-6 h-32 w-32 text-white/15" />}
              <div className="relative flex items-center gap-3 p-4">
                <button
                  onClick={() => previewIqama(c.id)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition ${
                    isSel ? "border-white/30 bg-white/15 text-white" : "border-border bg-secondary text-primary"
                  }`}
                  aria-label="استماع"
                  disabled={c.id === "silent"}
                >
                  <Icon d={isPlaying ? icons.pause : icons.play} size={16} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className={`text-[11px] truncate ${isSel ? "text-white/70" : "text-muted-foreground"}`}>{c.hint}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${isSel ? "bg-white/15 text-white/80" : "bg-secondary text-muted-foreground"}`}>
                  {c.duration}
                </span>
                <button
                  onClick={() => update({ iqamaVariant: c.id })}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    isSel ? "bg-white/20 text-white" : "border border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  {isSel ? "محدد" : "اختر"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SectionLabel hint="بالدقائق">مدة الفاصل لكل صلاة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {ADJUSTABLE_PRAYERS.map((p) => {
          const v = settings.iqamaOffsets[p];
          const perVariant = settings.perPrayerIqama[p] ?? settings.iqamaVariant;
          return (
            <div key={p} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon d={icons.prayer} size={16} />
                  </span>
                  <div>
                    <div className="text-sm font-medium">{PRAYER_LABELS[p].ar}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{PRAYER_LABELS[p].en}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOffset(p, v - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground"
                    aria-label="إنقاص"
                  >−</button>
                  <div className="min-w-[64px] text-center">
                    <div className="font-display text-xl tabular-nums">{toArabicDigits(v)}</div>
                    <div className="text-[10px] text-muted-foreground">دقيقة</div>
                  </div>
                  <button
                    onClick={() => setOffset(p, v + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground"
                    aria-label="زيادة"
                  >+</button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={45}
                value={v}
                onChange={(e) => setOffset(p, Number(e.target.value))}
                className="w-full accent-[hsl(var(--primary))]"
                dir="ltr"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{toArabicDigits(0)}</span>
                <span>الإفتراضي: {toArabicDigits(DEFAULT_IQAMA[p])}</span>
                <span>{toArabicDigits(45)}</span>
              </div>
              <div className="mt-3">
                <label className="text-[10px] text-muted-foreground">صوت الإقامة لهذه الصلاة</label>
                <select
                  value={perVariant}
                  onChange={(e) =>
                    updateDeep((s) => ({
                      ...s,
                      perPrayerIqama: { ...s.perPrayerIqama, [p]: e.target.value as IqamaVariant },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  dir="rtl"
                >
                  {IQAMA_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 px-4">
        <button
          onClick={() => updateDeep((s) => ({ ...s, iqamaOffsets: { ...DEFAULT_IQAMA }, perPrayerIqama: {} }))}
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm shadow-soft"
        >
          استعادة القيم الافتراضية
        </button>
      </div>
    </Screen>
  );
}

function Toggle({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-right shadow-soft">
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
