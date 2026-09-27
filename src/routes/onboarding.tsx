import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { markOnboarded } from "@/lib/onboarding-state";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "ابدأ — منار" }] }),
  component: Onboarding,
});

const SLIDES = [
  { t: "أوقات الصلاة", d: "إشعارات دقيقة لمواقيت الصلاة في موقعك.", i: icons.prayer },
  { t: "القرآن الكريم", d: "اقرأ، استمع، واحفظ كتاب الله الكريم.", i: icons.quran },
  { t: "الأذكار اليومية", d: "ورد يومي من أذكار الصباح والمساء.", i: icons.azkar },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between px-5 pt-6">
        <Link to="/home" onClick={markOnboarded} className="text-xs text-muted-foreground">
          تخطي
        </Link>
        <div className="flex gap-1.5">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="gradient-hero relative mb-10 flex h-56 w-56 items-center justify-center overflow-hidden rounded-[40px] text-white shadow-elegant">
          <div className="pattern-arabesque absolute inset-0 opacity-30" />
          <Icon d={SLIDES[i].i} size={72} />
        </div>
        <h2 className="font-display text-4xl font-medium">{SLIDES[i].t}</h2>
        <p className="mt-4 max-w-xs text-sm font-light leading-relaxed text-muted-foreground">
          {SLIDES[i].d}
        </p>
      </div>

      <div className="px-6 pb-10">
        {last ? (
          <Link
            to="/home"
            onClick={markOnboarded}
            className="gradient-primary block rounded-full py-4 text-center text-sm font-medium text-primary-foreground shadow-glow"
          >
            ابدأ الآن
          </Link>
        ) : (
          <button
            onClick={() => setI(i + 1)}
            className="gradient-primary w-full rounded-full py-4 text-sm font-medium text-primary-foreground shadow-glow"
          >
            التالي
          </button>
        )}
      </div>
    </div>
  );
}
