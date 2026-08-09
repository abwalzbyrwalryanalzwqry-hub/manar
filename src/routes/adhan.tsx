import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Arabesque, Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";
import {
  ADHAN_ASSET_RIGHTS_NOTICE,
  ADHAN_LIBRARY,
  ADJUSTABLE_PRAYERS,
  TATHWEEB_LIBRARY,
  useAdhanSettings,
} from "@/lib/adhan-settings";
import {
  ADHAN_STYLES,
  ADHAN_STYLE_LABELS,
  RECITERS,
  RECITER_INFO,
  adhanVariantLabel,
  makeAdhanVariant,
  parseAdhanVariant,
  playAdhan,
  stopAdhan,
  type AdhanStyle,
  type AdhanVariant,
  type Reciter,
} from "@/lib/adhan-sound";
import { PRAYER_LABELS, type PrayerKey } from "@/lib/prayer";

export const Route = createFileRoute("/adhan")({
  head: () => ({ meta: [{ title: "مكتبة الأذان — منار" }] }),
  component: AdhanLibrary,
});

type Target = "general" | "fajr" | "first" | "second" | "tathweeb";

function AdhanLibrary() {
  const { settings, update, updateDeep } = useAdhanSettings();
  const [target, setTarget] = useState<Target>("general");
  const [style, setStyle] = useState<AdhanStyle>(() => parseAdhanVariant(settings.selectedAdhan)?.style ?? "full");
  const [playing, setPlaying] = useState<AdhanVariant | null>(null);

  const selectedForTarget: AdhanVariant =
    target === "fajr"     ? settings.fajrAdhan :
    target === "first"    ? settings.fajrFirstAdhanAudio :
    target === "second"   ? settings.fajrSecondAdhanAudio :
    target === "tathweeb" ? settings.fajrTathweebAudio :
                             settings.selectedAdhan;

  const visibleEntries = useMemo(() => {
    if (target === "tathweeb") return [] as typeof ADHAN_LIBRARY; // tathweeb uses dedicated assets
    const inStyle = ADHAN_LIBRARY.filter((e) => e.style === style);
    const supplied = inStyle.filter((e) => e.available);
    return supplied.length > 0 ? supplied : inStyle;
  }, [style, target]);

  const preview = (v: AdhanVariant) => {
    if (playing === v) { stopAdhan(); setPlaying(null); return; }
    setPlaying(v);
    playAdhan(v, {
      volume: settings.volume,
      onEnd: () => setPlaying(null),
      onError: () => setPlaying(null),
    });
  };

  const choose = (v: AdhanVariant) => {
    if (target === "fajr")     update({ fajrAdhan: v, fajrUseSeparate: true });
    else if (target === "first")    update({ fajrFirstAdhanAudio: v });
    else if (target === "second")   update({ fajrSecondAdhanAudio: v });
    else if (target === "tathweeb") update({ fajrTathweebAudio: v });
    else update({ selectedAdhan: v });
  };

  return (
    <Screen>
      <ScreenHeader title="مكتبة الأذان" subtitle="اختر صوت الأذان الحقيقي لكل صلاة" backTo="/more" />

      {/* Hero */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <Arabesque className="absolute -left-10 -top-10 h-56 w-56 text-white/15" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">المكتبة الصوتية</div>
            <div className="mt-2 font-display text-2xl">تسجيلات أذان حقيقية</div>
            <div className="mt-1 text-xs text-white/70">مكة · المدينة · الأقصى · خليجي · عام · MP3 / M4A</div>
            <div className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed text-white/80">
              {ADHAN_ASSET_RIGHTS_NOTICE}
            </div>
          </div>
        </div>
      </div>


      {/* Target switch */}
      <SectionLabel>تخصيص الصوت لـ</SectionLabel>
      <div className="px-4">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1 shadow-soft">
          {([
            { id: "general",   l: "كل الصلوات" },
            { id: "fajr",      l: "أذان الفجر" },
            { id: "first",     l: "الأذان الأول" },
            { id: "second",    l: "الأذان الثاني" },
            { id: "tathweeb",  l: "التثويب" },
          ] as { id: Target; l: string }[]).map((t) => {
            const active = target === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTarget(t.id)}
                className={`flex-1 min-w-[80px] rounded-xl py-2 text-[11px] transition ${
                  active ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                }`}
              >
                {t.l}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          المحدد حالياً: {adhanVariantLabel(selectedForTarget)}
        </p>
      </div>

      {/* Style chips — only for reciter-based targets */}
      {target !== "tathweeb" && (
        <>
          <SectionLabel>نوع الأذان</SectionLabel>
          <div className="px-4">
            <div className="grid grid-cols-3 gap-2">
              {ADHAN_STYLES.map((st) => {
                const active = st === style;
                const meta = ADHAN_STYLE_LABELS[st];
                return (
                  <button
                    key={st}
                    onClick={() => setStyle(st)}
                    className={`rounded-2xl border p-3 text-center transition ${
                      active ? "border-transparent gradient-primary text-primary-foreground shadow-glow" : "border-border bg-card shadow-soft"
                    }`}
                  >
                    <div className="text-xs font-medium">{meta.name}</div>
                    <div className={`text-[10px] ${active ? "text-white/80" : "text-muted-foreground"}`}>{meta.duration}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Library */}
      {target === "tathweeb" ? (
        <>
          <SectionLabel hint="انقر للاستماع">الصلاة خير من النوم</SectionLabel>
          <div className="space-y-2 px-4">
            {TATHWEEB_LIBRARY.map((a) => (
              <SingleAssetCard
                key={a.id}
                label={a.name}
                hint="يُلحَق بأذان الفجر تلقائياً"
                selected={selectedForTarget === a.id}
                playing={playing === a.id}
                onPreview={() => preview(a.id)}
                onChoose={() => choose(a.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <SectionLabel hint="انقر للاستماع">المؤذنون</SectionLabel>
          <div className="space-y-2 px-4 stagger">
            {visibleEntries.map((c) => {
              const isSelected = c.id === selectedForTarget;
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
                        isSelected ? "border-white/30 bg-white/15 text-white" : "border-border bg-secondary text-primary"
                      }`}
                      aria-label="استماع"
                    >
                      <Icon d={isPlaying ? icons.pause : icons.play} size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className={`text-[11px] truncate ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                        {c.reciterName} · {c.origin}
                      </div>
                      <div className={`mt-1 flex flex-wrap gap-1.5 text-[10px] ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                        <span className={`rounded-full px-2 py-0.5 ${isSelected ? "bg-white/10" : "bg-secondary"}`}>{c.styleName}</span>
                        <span className={`rounded-full px-2 py-0.5 ${isSelected ? "bg-white/10" : "bg-secondary"}`}>{c.tone}</span>
                        <span className={`rounded-full px-2 py-0.5 ${isSelected ? "bg-white/10" : "bg-secondary"}`}>{c.duration}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => choose(c.id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                        isSelected ? "bg-white/20 text-white" : "border border-primary/30 bg-primary/10 text-primary"
                      }`}
                    >
                      {isSelected ? "محدد" : "اختر"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Per-prayer audio assignment */}
      <SectionLabel hint="صوت مختلف لكل صلاة">تعيين الصوت لكل صلاة</SectionLabel>
      <div className="space-y-2 px-4">
        <Toggle
          label="استخدام نفس الصوت لجميع الصلوات"
          hint={settings.samePerPrayer ? "الجميع يستخدم الصوت الرئيسي" : "يمكنك اختيار صوت لكل صلاة"}
          on={settings.samePerPrayer}
          onToggle={() => update({ samePerPrayer: !settings.samePerPrayer })}
        />
        {!settings.samePerPrayer && (
          <div className="space-y-2">
            {ADJUSTABLE_PRAYERS.map((p) => {
              const v = settings.perPrayerAudio[p] ?? settings.selectedAdhan;
              return (
                <PerPrayerAudio
                  key={p}
                  prayer={p}
                  value={v}
                  onChange={(nv) =>
                    updateDeep((s) => ({
                      ...s,
                      perPrayerAudio: { ...s.perPrayerAudio, [p]: nv },
                    }))
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Fajr toggles */}
      <SectionLabel>إعدادات الفجر</SectionLabel>
      <div className="space-y-2 px-4">
        <Toggle
          label="استخدام أذان مخصص للفجر"
          hint="غالباً ما يُستخدم أذان الفجر بصوت مختلف"
          on={settings.fajrUseSeparate}
          onToggle={() => update({ fajrUseSeparate: !settings.fajrUseSeparate })}
        />
        <Toggle
          label="الأذان الأول للفجر"
          hint={`تنبيه قبل الفجر بـ ${settings.fajrFirstAdhanOffset} دقيقة`}
          on={settings.fajrFirstAdhanEnabled}
          onToggle={() => update({ fajrFirstAdhanEnabled: !settings.fajrFirstAdhanEnabled })}
        />
        <Toggle
          label="تثويب الفجر — الصلاة خير من النوم"
          hint="يُلحَق بأذان الفجر"
          on={settings.fajrTathweebEnabled}
          onToggle={() => update({ fajrTathweebEnabled: !settings.fajrTathweebEnabled })}
        />
        <Toggle
          label="تذكير الفجر"
          hint="تنبيه ناعم قبل صلاة الفجر"
          on={settings.fajrReminderEnabled}
          onToggle={() => update({ fajrReminderEnabled: !settings.fajrReminderEnabled })}
        />
      </div>

      <div className="h-4" />
    </Screen>
  );
}

function Toggle({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
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

function SingleAssetCard({ label, hint, selected, playing, onPreview, onChoose }: {
  label: string; hint: string; selected: boolean; playing: boolean;
  onPreview: () => void; onChoose: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        selected ? "border-transparent gradient-primary text-primary-foreground shadow-glow" : "border-border bg-card shadow-soft"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onPreview}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            selected ? "border-white/30 bg-white/15 text-white" : "border-border bg-secondary text-primary"
          }`}
        >
          <Icon d={playing ? icons.pause : icons.play} size={18} />
        </button>
        <div className="flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className={`text-[11px] ${selected ? "text-white/70" : "text-muted-foreground"}`}>{hint}</div>
        </div>
        <button
          onClick={onChoose}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
            selected ? "bg-white/20 text-white" : "border border-primary/30 bg-primary/10 text-primary"
          }`}
        >
          {selected ? "محدد" : "اختر"}
        </button>
      </div>
    </div>
  );
}

function PerPrayerAudio({ prayer, value, onChange }: {
  prayer: PrayerKey;
  value: AdhanVariant;
  onChange: (v: AdhanVariant) => void;
}) {
  const parsed = parseAdhanVariant(value);
  const reciter: Reciter = parsed?.reciter ?? "makkah";
  const style: AdhanStyle = parsed?.style ?? "full";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.prayer} size={16} />
          </span>
          <div>
            <div className="text-sm font-medium">{PRAYER_LABELS[prayer].ar}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{PRAYER_LABELS[prayer].en}</div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">{adhanVariantLabel(value)}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={reciter}
          onChange={(e) => onChange(makeAdhanVariant(e.target.value as Reciter, style))}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs"
          dir="rtl"
        >
          {RECITERS.map((r) => (
            <option key={r} value={r}>{RECITER_INFO[r].name}</option>
          ))}
        </select>
        <select
          value={style}
          onChange={(e) => onChange(makeAdhanVariant(reciter, e.target.value as AdhanStyle))}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs"
          dir="rtl"
        >
          {ADHAN_STYLES.map((s) => (
            <option key={s} value={s}>{ADHAN_STYLE_LABELS[s].name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
