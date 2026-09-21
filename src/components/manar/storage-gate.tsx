/* منار — بوابة الإقلاع للتخزين الدائم.
 *
 * تؤخّر أول رسم للشاشة حتى تُستعاد حالة المستخدم من الطبقة الأصلية
 * (SharedPreferences). بدون هذه البوابة قد تقرأ الشاشات `localStorage` وهو فارغ
 * بعد مسح تخزين الـ WebView، فتظهر الإعدادات الافتراضية لحظة ثم تتغيّر — أو
 * الأسوأ، تُكتب الافتراضيات فوق إعدادات المستخدم الحقيقية.
 *
 * على الويب لا يوجد ما نستعيده، فتمرّ البوابة فوراً بلا أي وميض.
 *
 * الترطيب (hydration): بناء أندرويد يُمرّر `VITE_NATIVE_SHELL=1`، فيُنتج
 * الـprerender شاشة الاستعادة نفسها التي يرسمها العميل في أول إطار. بدون ذلك
 * كان HTML المُسبَق يحمل الصفحة كاملة بينما يرسم العميل شاشة الاستعادة، فيقع
 * عدم تطابق ترطيب (React #418) ويُعيد React بناء الشجرة كلها عند كل إقلاع.
 */

import { useEffect, useState, type ReactNode } from "react";
import { hydratePersistentStorage } from "@/lib/persistent-storage";
import { Mark } from "@/components/manar/shell";

/** بناء مخصّص لقشرة Capacitor (يُضبط في سكربت `build:android`). */
const NATIVE_SHELL_BUILD = import.meta.env.VITE_NATIVE_SHELL === "1";

function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
}

export function StorageGate({ children }: { children: ReactNode }) {
  // على الويب وفي الـ SSR نبدأ جاهزين: لا استعادة مطلوبة والترطيب يطابق الخادم.
  const [ready, setReady] = useState(() => !NATIVE_SHELL_BUILD && !isNativePlatform());

  useEffect(() => {
    if (ready) {
      // نضمن تثبيت المرآة حتى على الويب (لا تفعل شيئاً هناك) ثم ننتهي.
      void hydratePersistentStorage();
      return;
    }
    let cancelled = false;
    // حدّ أعلى للانتظار: لا نحبس المستخدم أمام شاشة فارغة إن تعطّلت الإضافة.
    const timeout = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 2500);
    void hydratePersistentStorage().finally(() => {
      clearTimeout(timeout);
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <span className="gradient-primary flex h-16 w-16 items-center justify-center rounded-3xl shadow-glow">
            <Mark size={34} tone="light" />
          </span>
          <span className="text-[11px] text-muted-foreground">جارٍ استعادة بياناتك…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
