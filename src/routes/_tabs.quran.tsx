import { createFileRoute } from "@tanstack/react-router";
import { Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/quran")({
  head: () => ({ meta: [{ title: "القرآن الكريم — منار" }] }),
  component: Quran,
});

const SURAHS = [
  { n: 1, ar: "الفاتحة", en: "Al-Fatiha", v: 7, type: "مكية" },
  { n: 2, ar: "البقرة", en: "Al-Baqarah", v: 286, type: "مدنية" },
  { n: 3, ar: "آل عمران", en: "Al-Imran", v: 200, type: "مدنية" },
  { n: 4, ar: "النساء", en: "An-Nisa", v: 176, type: "مدنية" },
  { n: 5, ar: "المائدة", en: "Al-Ma'idah", v: 120, type: "مدنية" },
  { n: 18, ar: "الكهف", en: "Al-Kahf", v: 110, type: "مكية" },
];

function Quran() {
  return (
    <Screen>
      <ScreenHeader
        title="القرآن الكريم"
        subtitle="١١٤ سورة · ٣٠ جزءاً"
        action={
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft">
            <Icon d={icons.search} size={18} />
          </button>
        }
      />

      {/* Last read */}
      <div className="px-5">
        <div className="gradient-night relative overflow-hidden rounded-[24px] p-5 text-white shadow-elegant">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">آخر قراءة</div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="font-display text-2xl font-medium">سورة الكهف</div>
              <div className="mt-1 text-xs font-light text-white/70">الآية ٤٥ · صفحة ٢٩٩</div>
            </div>
            <button className="gradient-gold flex h-12 w-12 items-center justify-center rounded-full text-navy shadow-gold">
              <Icon d={icons.play} size={18} />
            </button>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="gradient-gold h-full w-[62%]" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-2 px-5">
        {["السور", "الأجزاء", "المفضلة"].map((t, i) => (
          <button
            key={t}
            className={`flex-1 rounded-full py-2.5 text-xs font-medium transition ${
              i === 0 ? "gradient-primary text-primary-foreground shadow-glow" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <SectionLabel>قائمة السور</SectionLabel>
      <div className="space-y-2 px-5">
        {SURAHS.map((s) => (
          <button key={s.n} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:shadow-elegant">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-center justify-center">
                <svg viewBox="0 0 40 40" className="absolute inset-0 text-primary">
                  <path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" fill="currentColor" opacity="0.1" />
                  <path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                </svg>
                <span className="relative font-display text-xs font-medium">{s.n}</span>
              </span>
              <div className="text-right">
                <div className="font-display text-base font-medium">{s.ar}</div>
                <div className="text-[10px] text-muted-foreground">{s.en} · {s.type}</div>
              </div>
            </div>
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-widest text-gold">آيات</div>
              <div className="text-sm font-medium tabular-nums">{s.v}</div>
            </div>
          </button>
        ))}
      </div>
    </Screen>
  );
}
