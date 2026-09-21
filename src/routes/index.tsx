import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mark } from "@/components/manar/shell";
import { useAuth } from "@/lib/auth-context";
import { hasOnboarded } from "@/lib/onboarding-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منار — نور يهديك في كل وقت" },
      { name: "description", content: "تطبيق منار الإسلامي الفاخر للصلاة والقرآن والأذكار." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { user, isGuest, loading } = useAuth();
  const [returning] = useState(() => hasOnboarded());

  /* من فتح التطبيق قبل اليوم لا يُعاد تعريفه به.
   *
   * كانت هذه الشاشة تُحوّل إلى `/onboarding` دائماً، فيرى المستخدم شرائح
   * التعريف ثم شاشة الدخول في كل مرّة يفتح فيها التطبيق — حتى بعد أن دخل
   * كزائر أو بحسابه. الوجهة الآن تتبع حالته المحفوظة:
   *   • أتمّ التعريف ومعه حساب أو وضع زائر → الرئيسية مباشرةً.
   *   • أتمّ التعريف بلا حساب → شاشة الدخول (لا الشرائح ثانيةً).
   *   • أول مرّة → الشرائح.
   *
   * ننتظر انتهاء `loading` قبل القرار، وإلا حُسم الأمر قبل أن تُستعاد
   * الجلسة من التخزين فيُطرد صاحب الحساب إلى شاشة الدخول. */
  useEffect(() => {
    if (loading) return;
    const to = !returning ? "/onboarding" : user || isGuest ? "/home" : "/login";
    /* العائد لا ينتظر شاشة البداية كاملةً — ٢٢٠٠ مللي ثانية ترحيبٌ لطيف
       في المرّة الأولى وتأخيرٌ مزعج فيما بعدها. */
    const t = setTimeout(() => navigate({ to }), returning ? 600 : 2200);
    return () => clearTimeout(t);
  }, [navigate, loading, returning, user, isGuest]);

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden gradient-hero text-white">
      <div className="pattern-arabesque absolute inset-0 opacity-30" />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="flex h-28 w-28 items-center justify-center rounded-[32px] bg-white/10 backdrop-blur-xl ring-1 ring-white/20 animate-float">
          <Mark size={64} tone="light" />
        </div>
        <h1 className="mt-10 font-display text-7xl font-light tracking-tight">منار</h1>
        <p className="mt-4 text-sm font-light text-white/80">نور يهديك في كل وقت</p>
        <div className="mt-16 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gold animate-float"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        {!returning && (
          <Link
            to="/onboarding"
            className="absolute bottom-8 text-[11px] tracking-[0.3em] text-white/50"
          >
            تخطي
          </Link>
        )}
      </div>
    </div>
  );
}
