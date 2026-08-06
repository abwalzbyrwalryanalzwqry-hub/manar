import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAzkarBook } from "@/hooks/use-azkar";
import { Arabesque, Icon, icons, Screen, ScreenHeader, SectionLabel } from "@/components/manar/shell";

export const Route = createFileRoute("/_tabs/azkar")({
  head: () => ({ meta: [{ title: "الأذكار — منار" }] }),
  component: Azkar,
});

const CATS = [
  { ar: "أذكار الصباح", en: "Morning", count: 28, icon: icons.sun, accent: "from-amber-300/30 to-orange-400/20" },
  { ar: "أذكار المساء", en: "Evening", count: 28, icon: icons.moon, accent: "from-indigo-400/30 to-violet-500/20" },
  { ar: "أذكار النوم", en: "Sleep", count: 16, icon: icons.bed, accent: "from-blue-400/30 to-slate-500/20" },
  { ar: "أذكار بعد الصلاة", en: "Prayer", count: 12, icon: icons.prayer, accent: "from-emerald-400/30 to-teal-500/20" },
  { ar: "أذكار السفر", en: "Travel", count: 9, icon: icons.plane, accent: "from-sky-400/30 to-cyan-500/20" },
  { ar: "أذكار متنوعة", en: "Various", count: 40, icon: icons.sparkle, accent: "from-rose-300/30 to-pink-500/20" },
];

function Azkar() {
  const [count, setCount] = useState(33);
  const { book } = useAzkarBook();
  return (
    <Screen>
      <ScreenHeader title="الأذكار" subtitle="حصن المسلم اليومي" />

      {/* Premium tasbih counter */}
      <div className="px-4 animate-fade-up">
        <div className="gradient-night relative overflow-hidden rounded-[32px] p-6 text-center text-white shadow-elegant">
          <Arabesque className="absolute -right-10 -top-10 h-72 w-72 text-gold/25 animate-spin-slow" />
          <div className="grain-overlay absolute inset-0" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">عداد التسبيح</div>
            <button
              onClick={() => setCount((c) => c + 1)}
              className="mx-auto mt-4 flex h-44 w-44 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 transition active:scale-95"
            >
              <div className="gradient-gold absolute h-44 w-44 rounded-full opacity-20 blur-2xl animate-breath" />
              <div className="text-gradient-gold relative font-display text-7xl font-black tabular-nums">
                {String(count).padStart(2, "٠")}
              </div>
            </button>
            <div className="mt-4 font-display text-base font-light text-white/90">سبحان الله وبحمده</div>
            <div className="text-[10px] text-white/50">٣٣ × ٣ مرة لكل صلاة</div>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setCount(0)} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] backdrop-blur">
                إعادة
              </button>
              <button onClick={() => setCount((c) => c + 1)} className="gradient-gold rounded-full px-6 py-2 text-[11px] font-medium text-navy shadow-gold">
                + سبّح
              </button>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel hint={book ? `${book.chapters.length} باب` : "حصن المسلم"}>أبواب حصن المسلم</SectionLabel>
      <div className="grid grid-cols-1 gap-3 px-4 stagger">
        {!book && <div className="skeleton h-24 rounded-3xl" />}
        {book?.groups.map((g) => {
          const chapters = book.chapters.filter((c) => c.group === g.id);
          const first = chapters[0];
          if (!first) return null;
          return (
            <Link
              key={g.id}
              to="/azkar/$chapter"
              params={{ chapter: String(first.id) }}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 text-right shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Icon d={icons.azkar} size={20} />
                </span>
                <span className="rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {chapters.length} باب
                </span>
              </div>
              <div className="mt-4 font-display text-base font-medium">{g.title}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{first.title}</div>
            </Link>
          );
        })}
      </div>


      <SectionLabel>ذكر اليوم</SectionLabel>
      <div className="px-4">
        <div className="glass relative overflow-hidden rounded-3xl p-5">
          <p className="text-right font-display text-lg leading-loose">
            «سبحان الله وبحمده، سبحان الله العظيم»
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن.</p>
          <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>صحيح البخاري · ٦٤٠٦</span>
            <span className="flex items-center gap-1"><Icon d={icons.heart} size={12} /> ١.٢ك</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}
