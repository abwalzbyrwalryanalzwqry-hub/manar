import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  hasPendingChanges,
  KEY_EVENTS,
  stampLocalChanges,
  syncNow,
  syncOnLogin,
} from "@/lib/cloud-sync";

/** مهلة تجميع التعديلات المتتالية قبل الرفع. */
const PUSH_DEBOUNCE_MS = 3000;
/** عند العودة إلى التطبيق نسحب تعديلات الأجهزة الأخرى إن مضى هذا الوقت. */
const RESUME_PULL_MS = 5 * 60 * 1000;

/* النسخة السابقة كانت تستمع لحدث `storage` بمفاتيح تبدأ بـ `manar-`، لكن:
 *   ١) حدث `storage` لا يُطلَق في النافذة نفسها التي كتبت — أي لا يُطلَق أبداً
 *      داخل تطبيق أندرويد (نافذة واحدة).
 *   ٢) مفاتيح منار تبدأ بـ `manar.` لا `manar-`.
 * فلم يكن هناك رفع تلقائي فعلياً، والاعتماد كان على `beforeunload` الذي لا
 * يُطلَق عند إغلاق التطبيق من أندرويد. الآن نستمع لأحداث الوحدات نفسها. */

export function CloudSyncBridge() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // الرصد يعمل دائماً — حتى قبل الدخول — لتُختم التعديلات بوقتها الحقيقي.
  useEffect(() => {
    stampLocalChanges(window.localStorage);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSync = 0;

    const run = () => {
      if (!userId) return;
      lastSync = Date.now();
      syncNow(userId).catch((e) => console.warn("[منار] فشلت المزامنة", e));
    };

    const onChange = () => {
      const changed = stampLocalChanges(window.localStorage);
      if (!changed || !userId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, PUSH_DEBOUNCE_MS);
    };

    const onVisibility = () => {
      if (!userId) return;
      if (document.visibilityState === "hidden") {
        stampLocalChanges(window.localStorage);
        if (hasPendingChanges(window.localStorage)) {
          if (timer) clearTimeout(timer);
          run();
        }
      } else if (Date.now() - lastSync > RESUME_PULL_MS) {
        run();
      }
    };

    const events = [...new Set(Object.values(KEY_EVENTS))];
    for (const e of events) window.addEventListener(e, onChange);
    window.addEventListener("storage", onChange); // تبويبات أخرى على الويب
    document.addEventListener("visibilitychange", onVisibility);

    if (userId) {
      lastSync = Date.now();
      syncOnLogin(userId).catch((e) => console.warn("[منار] فشلت المزامنة", e));
    }

    return () => {
      for (const e of events) window.removeEventListener(e, onChange);
      window.removeEventListener("storage", onChange);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  return null;
}
