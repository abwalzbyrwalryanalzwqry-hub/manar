import { createFileRoute, Link } from "@tanstack/react-router";
import { Arabesque, Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/quran")({
  head: () => ({
    meta: [
      { title: "القرآن الكريم — منار" },
      { name: "description", content: "المصحف، التلاوات، التفسير، العلامات والبحث في القرآن الكريم." },
    ],
  }),
  component: QuranHub,
});

type Card = {
  to: string;
  title: string;
  hint: string;
  iconKey: keyof typeof icons;
  accent: "primary" | "gold" | "night";
};

const CARDS: Card[] = [
  { to: "/quran/mushaf", title: "المصحف", hint: "تصفح المصحف الشريف كاملًا", iconKey: "quran", accent: "primary" },
  { to: "/quran/recitations", title: "التلاوات", hint: "استمع لأشهر القراء", iconKey: "play", accent: "gold" },
  { to: "/quran/tafsir", title: "التفسير", hint: "معاني وتفاسير الآيات", iconKey: "info", accent: "night" },
  { to: "/quran/bookmarks", title: "العلامات", hint: "آياتك وسورك المحفوظة", iconKey: "bookmark", accent: "gold" },
  { to: "/quran/search", title: "البحث", hint: "ابحث في آيات القرآن", iconKey: "search", accent: "primary" },
  { to: "/quran/last-read", title: "آخر قراءة", hint: "تابع من حيث توقفت", iconKey: "bookmark", accent: "night" },
];

function QuranHub() {
  return (
    <Screen>
      <ScreenHeader
        title="القرآن الكريم"
        subtitle="١١٤ سورة · ٣٠ جزءًا · ٦٢٣٦ آية"
      />

      {/* Premium hero */}
      <div className="px-5 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-[32px] p-6 text-white shadow-elegant">
          <Arabesque className="pointer-events-none absolute -left-14 -bottom-14 h-64 w-64 text-gold/25" />
          <Arabesque className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 text-white/10" />
          <div className="grain-overlay absolute inset-0" />

          <div className="relative flex items-center justify-between">
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] backdrop-blur">
              كتاب الله
            </div>
            <span className="text-[10px] text-white/60">النسخة القادمة</span>
          </div>

          <div className="relative mt-6">
            <div className="font-display text-3xl font-medium leading-snug">
              اقرأ. تدبّر. ارتقِ.
            </div>
            <p className="mt-2 max-w-[16rem] text-xs font-light leading-relaxed text-white/70">
              مساحتك القرآنية داخل منار — بتصميم فاخر يليق بكلام الله.
            </p>
          </div>

          <div className="relative mt-6 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="gradient-gold h-full w-[22%]" />
            </div>
            <span className="text-[10px] tabular-nums text-white/70">قيد التطوير</span>
          </div>
        </div>
      </div>

      <SectionLabel hint="٦ أقسام">أقسام القرآن</SectionLabel>

      <div className="grid grid-cols-2 gap-3 px-5 stagger">
        {CARDS.map((c) => (
          <QuranCard key={c.to} {...c} />
        ))}
      </div>

      <div className="mt-8 px-5">
        <div className="glass flex items-center gap-3 rounded-2xl border border-border/60 p-4 text-right">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Icon d={icons.sparkle} size={18} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">قريبًا بإذن الله</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              نُجهّز تجربة قرآنية متكاملة بمعايير منار الفاخرة.
            </p>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function QuranCard({ to, title, hint, iconKey, accent }: Card) {
  const accentClasses: Record<Card["accent"], string> = {
    primary: "from-primary/15 to-primary/0 text-primary",
    gold: "from-gold/20 to-gold/0 text-gold",
    night: "from-foreground/10 to-foreground/0 text-foreground",
  };
  return (
    <Link
      to={to}
      className="group relative flex h-40 flex-col justify-between overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-4 text-right shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <Arabesque className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 text-primary/10 opacity-70" />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentClasses[accent]}`} />

      <div className="relative flex items-start justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/70 shadow-soft ${accent === "gold" ? "text-gold" : accent === "primary" ? "text-primary" : "text-foreground"}`}>
          <Icon d={icons[iconKey]} size={20} />
        </span>
        <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          قريبًا
        </span>
      </div>

      <div className="relative">
        <div className="font-display text-lg font-medium leading-tight">{title}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </Link>
  );
}
