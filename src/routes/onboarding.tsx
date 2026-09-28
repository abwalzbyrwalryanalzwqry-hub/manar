import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { markOnboarded } from "@/lib/onboarding-state";
import { isNativeApp } from "@/lib/native-shell";
import { AlertPermissionRows } from "@/components/manar/alert-permissions-card";
import { useAlertPermissions } from "@/lib/use-alert-permissions";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "ابدأ — منار" }] }),
  component: Onboarding,
});

const BASE_SLIDES = [
  { t: "أوقات الصلاة", d: "إشعارات دقيقة لمواقيت الصلاة في موقعك.", i: icons.prayer },
  { t: "القرآن الكريم", d: "اقرأ، استمع، واحفظ كتاب الله الكريم.", i: icons.quran },
  { t: "الأذكار اليومية", d: "ورد يومي من أذكار الصباح والمساء.", i: icons.azkar },
];

/* داخل أندرويد فقط: شريحة أخيرة تشرح الأذونات قبل طلبها. منذ أندرويد ١٤ لا
 * يُمنح إذن المنبّهات الدقيقة تلقائياً، وبدونه لا يُسمع الأذان والتطبيق مغلق. */
const PERMISSIONS_SLIDE = {
  t: "الأذان والتطبيق مغلق",
  d: "حتى يصلك الأذان في وقته ولو أغلقت منار، اسمح له بما يلي. لا يُطلب شيءٌ آخر.",
  i: icons.bell,
};

function Onboarding() {
  const [i, setI] = useState(0);
  // بعد الترطيب فقط: الخادم لا يعرف أنه داخل التطبيق.
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  const SLIDES = native ? [...BASE_SLIDES, PERMISSIONS_SLIDE] : BASE_SLIDES;
  const last = i === SLIDES.length - 1;
  const onPermissions = native && SLIDES[i] === PERMISSIONS_SLIDE;
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
        <div
          className={`gradient-hero relative flex items-center justify-center overflow-hidden rounded-[40px] text-white shadow-elegant ${
            onPermissions ? "mb-6 h-32 w-32" : "mb-10 h-56 w-56"
          }`}
        >
          <div className="pattern-arabesque absolute inset-0 opacity-30" />
          <Icon d={SLIDES[i].i} size={onPermissions ? 48 : 72} />
        </div>
        <h2 className="font-display text-4xl font-medium">{SLIDES[i].t}</h2>
        <p className="mt-4 max-w-xs text-sm font-light leading-relaxed text-muted-foreground">
          {SLIDES[i].d}
        </p>
        {onPermissions && <PermissionsStep />}
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

function PermissionsStep() {
  const { perms, refresh } = useAlertPermissions();
  if (!perms) return null;
  return (
    <div className="mt-6 w-full max-w-sm text-right" dir="rtl">
      <AlertPermissionRows perms={perms} onChanged={() => void refresh()} />
    </div>
  );
}
