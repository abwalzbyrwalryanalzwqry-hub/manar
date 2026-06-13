import { createFileRoute } from "@tanstack/react-router";
import { Arabesque, Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import { DEFAULT_IQAMA, useAdhanSettings } from "@/lib/adhan-settings";
import { PRAYER_LABELS, PRAYER_ORDER, type PrayerKey } from "@/lib/prayer";
import { toArabicDigits } from "@/lib/format";

export const Route = createFileRoute("/iqama")({
  head: () => ({ meta: [{ title: "الإقامة — منار" }] }),
  component: IqamaSettings,
});

const ADJUSTABLE: PrayerKey[] = PRAYER_ORDER.filter((p) => p !== "sunrise");

function IqamaSettings() {
  const { settings, update, updateDeep } = useAdhanSettings();

  const setOffset = (p: PrayerKey, v: number) =>
    updateDeep((s) => ({ ...s, iqamaOffsets: { ...s.iqamaOffsets, [p]: Math.max(0, Math.min(60, v)) } }));

  return (
    <Screen>
      <ScreenHeader title="إعدادات الإقامة" subtitle="مدة الفاصل بين الأذان والإقامة" backTo="/more" />

      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -right-10 -top-10 h-56 w-56 text-white/15" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Icon d={icons.prayer} size={22} />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">الإقامة</div>
              <div className="font-display text-xl">تنبيه قبل الصلاة بـ دقائق</div>
              <div className="mt-0.5 text-[11px] text-white/70">يمكن تخصيص كل صلاة على حدة</div>
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
          hint="نغمة قصيرة للإقامة"
          on={settings.iqamaSoundEnabled}
          onToggle={() => update({ iqamaSoundEnabled: !settings.iqamaSoundEnabled })}
        />
      </div>

      <SectionLabel hint="بالدقائق">مدة الفاصل لكل صلاة</SectionLabel>
      <div className="space-y-2 px-4 stagger">
        {ADJUSTABLE.map((p) => {
          const v = settings.iqamaOffsets[p];
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
            </div>
          );
        })}
      </div>

      <div className="mt-6 px-4">
        <button
          onClick={() => updateDeep((s) => ({ ...s, iqamaOffsets: { ...DEFAULT_IQAMA } }))}
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
