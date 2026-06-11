import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon, icons, Screen, StatusBar, Mark } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/home")({
  head: () => ({ meta: [{ title: "الرئيسية — منار" }] }),
  component: Home,
});

function Home() {
  return (
    <Screen>
      <StatusBar />
      {/* Greeting */}
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <p className="text-xs text-muted-foreground">السلام عليكم</p>
          <h1 className="font-display text-2xl font-medium">عبدالله</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft">
            <Icon d={icons.search} size={18} />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-soft">
            <Icon d={icons.bell} size={18} />
          </button>
        </div>
      </div>

      {/* Hero: time + next prayer */}
      <div className="px-5 pt-5">
        <div className="gradient-hero relative overflow-hidden rounded-[28px] p-6 text-white shadow-elegant">
          <div className="pattern-arabesque absolute inset-0 opacity-25" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] tracking-widest backdrop-blur">القادمة</div>
              <Mark size={26} tone="light" />
            </div>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.3em] text-white/60">صلاة العصر</div>
              <div className="font-display text-6xl font-black tabular-nums tracking-tight">١٥:٤٢</div>
              <div className="mt-2 text-xs font-light text-white/80">باقي ٢ ساعة و ١٢ دقيقة</div>
            </div>
            <div className="mt-6 border-t border-white/15 pt-4">
              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/60">
                <span>التوقيت الحالي</span>
                <span>الموقع</span>
              </div>
              <div className="mt-1 flex justify-between text-sm font-light">
                <span className="tabular-nums">١٣:٣٠</span>
                <span>الرياض · KSA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date pills */}
      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
        <DatePill label="هجري" value="١٥ شعبان ١٤٤٧" />
        <DatePill label="ميلادي" value="11 يونيو 2026" />
      </div>

      {/* Quick actions */}
      <SectionLabel>اختصارات سريعة</SectionLabel>
      <div className="grid grid-cols-4 gap-3 px-5">
        {[
          { l: "القرآن", i: icons.quran, to: "/quran" },
          { l: "الأذكار", i: icons.azkar, to: "/azkar" },
          { l: "القِبلة", i: icons.qibla, to: "/qibla" },
          { l: "التقويم", i: icons.calendar, to: "/calendar" },
        ].map((q) => (
          <Link key={q.l} to={q.to} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:shadow-elegant">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Icon d={q.i} size={22} />
            </span>
            <span className="text-[11px] text-muted-foreground">{q.l}</span>
          </Link>
        ))}
      </div>

      {/* Daily Verse */}
      <SectionLabel hint="آية اليوم">القرآن الكريم</SectionLabel>
      <div className="px-5">
        <div className="glass relative overflow-hidden rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gold">سورة الكهف · ١٠</span>
            <span className="text-xs text-muted-foreground">٤٥ ثانية قراءة</span>
          </div>
          <p className="mt-4 text-right font-display text-lg leading-loose">
            ﴿ رَبَّنَا آتِنَا مِنْ لَدُنْكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا ﴾
          </p>
          <div className="mt-4 flex gap-2">
            <button className="flex-1 rounded-full bg-primary py-2 text-xs font-medium text-primary-foreground">استمع</button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border"><Icon d={icons.bookmark} size={16} /></button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border"><Icon d={icons.share} size={16} /></button>
          </div>
        </div>
      </div>

      {/* Daily Hadith */}
      <SectionLabel hint="حديث اليوم">السنة النبوية</SectionLabel>
      <div className="px-5">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold">
            <span className="h-1 w-6 bg-gold" /> صحيح البخاري
          </div>
          <p className="mt-3 font-display text-base leading-loose">
            «إنما الأعمال بالنيات، وإنما لكل امرئٍ ما نوى»
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            رواه عمر بن الخطاب رضي الله عنه
          </p>
        </div>
      </div>

      <div className="h-6" />
    </Screen>
  );
}

function DatePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <div className="text-[10px] uppercase tracking-widest text-gold">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mt-6 mb-3 flex items-center justify-between px-5">
      <h2 className="text-sm font-medium">{children}</h2>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
