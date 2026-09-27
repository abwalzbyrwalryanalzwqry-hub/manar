import { useEffect, useState } from "react";
import { toast } from "sonner";
import { icons } from "@/components/manar/shell";
import { ConfirmSheet } from "@/components/manar/confirm-sheet";
import { useAuth } from "@/lib/auth-context";
import {
  hasPendingChanges,
  KEY_EVENTS,
  needsAccountChoice,
  releaseDeviceOwnership,
  stampLocalChanges,
  syncNow,
  syncOnLogin,
  wipeLocalSyncedData,
} from "@/lib/cloud-sync";

/** مهلة تجميع التعديلات المتتالية قبل الرفع. */
const PUSH_DEBOUNCE_MS = 3000;
/**
 * مفاتيح «ساخنة» تتغيّر مع كل نقرة عدّاد أو صفحة مصحف. رفعها بعد ٣ ثوانٍ من
 * كل توقّف كان يعني طلب شبكة كل بضع ثوانٍ أثناء القراءة، مع بصمة JSON كبيرة
 * لكل المفاتيح في كل نقرة — وهو من أسباب سخونة الهاتف أثناء الأذكار. تُجمع
 * الآن وتُرفع بعد هدوءٍ أطول، وفوراً عند مغادرة التطبيق.
 */
const HOT_KEYS = new Set([
  "manar.azkar.progress.v1",
  "manar.wird.progress.v1",
  "manar.activity.v1",
  "manar.quran.history.v1",
]);
const HOT_PUSH_DEBOUNCE_MS = 45_000;
/** تجميع أحداث النقرات المتتالية قبل حساب البصمات. */
const STAMP_DEBOUNCE_MS = 1200;

/** الحدث ← مفاتيحه. */
const EVENT_KEYS: Record<string, string[]> = Object.entries(KEY_EVENTS).reduce(
  (acc, [key, evt]) => {
    (acc[evt] ??= []).push(key);
    return acc;
  },
  {} as Record<string, string[]>,
);
/** عند العودة إلى التطبيق نسحب تعديلات الأجهزة الأخرى إن مضى هذا الوقت. */
const RESUME_PULL_MS = 5 * 60 * 1000;

/* النسخة السابقة كانت تستمع لحدث `storage` بمفاتيح تبدأ بـ `manar-`، لكن:
 *   ١) حدث `storage` لا يُطلَق في النافذة نفسها التي كتبت — أي لا يُطلَق أبداً
 *      داخل تطبيق أندرويد (نافذة واحدة).
 *   ٢) مفاتيح منار تبدأ بـ `manar.` لا `manar-`.
 * فلم يكن هناك رفع تلقائي فعلياً، والاعتماد كان على `beforeunload` الذي لا
 * يُطلَق عند إغلاق التطبيق من أندرويد. الآن نستمع لأحداث الوحدات نفسها. */

export function CloudSyncBridge() {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  /* بيانات حساب آخر على الجهاز تنتظر قرار المستخدم قبل أي مزامنة. */
  const [choice, setChoice] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) {
      setChoice(false);
      return;
    }
    const check = () => setChoice(needsAccountChoice(window.localStorage, userId));
    check();
    window.addEventListener("manar:account-choice", check);
    return () => window.removeEventListener("manar:account-choice", check);
  }, [userId]);

  const resolve = async (mode: "mine" | "merge" | "leave") => {
    if (!userId) return;
    setBusy(true);
    try {
      if (mode === "leave") {
        await signOut();
        return;
      }
      if (mode === "mine") wipeLocalSyncedData();
      else releaseDeviceOwnership(window.localStorage);
      setChoice(false);
      await syncOnLogin(userId);
      toast.success(mode === "mine" ? "استُعيدت بيانات حسابك" : "دُمجت بيانات الجهاز في حسابك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت المزامنة");
    } finally {
      setBusy(false);
      setChoice(needsAccountChoice(window.localStorage, userId));
    }
  };

  // الرصد يعمل دائماً — حتى قبل الدخول — لتُختم التعديلات بوقتها الحقيقي.
  useEffect(() => {
    stampLocalChanges(window.localStorage);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stampTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSync = 0;
    /** مفاتيح تغيّرت ولم تُختم بعد؛ `null` = كلها (حدث storage من تبويب آخر). */
    let dirty: Set<string> | null = new Set();
    /** موعد الرفع المجدول (لا يُؤجَّل الرفع العادي بسبب نقرات ساخنة لاحقة). */
    let pushAt = 0;

    const run = () => {
      if (!userId) return;
      lastSync = Date.now();
      syncNow(userId).catch((e) => console.warn("[منار] فشلت المزامنة", e));
    };

    const flushStamp = (): boolean => {
      if (stampTimer) clearTimeout(stampTimer);
      stampTimer = null;
      const keys = dirty;
      dirty = new Set();
      if (keys && keys.size === 0) return false;
      const changed = stampLocalChanges(window.localStorage, Date.now(), keys ?? undefined);
      if (!changed || !userId) return changed;
      const hotOnly = keys != null && [...keys].every((k) => HOT_KEYS.has(k));
      const at = Date.now() + (hotOnly ? HOT_PUSH_DEBOUNCE_MS : PUSH_DEBOUNCE_MS);
      /* رفعٌ عادي قريب لا يؤجّله رفعٌ ساخن أبعد؛ والعكس يُقدَّم. */
      if (!timer || at < pushAt || !hotOnly) {
        if (timer) clearTimeout(timer);
        pushAt = at;
        timer = setTimeout(() => {
          timer = null;
          run();
        }, at - Date.now());
      }
      return changed;
    };

    const onChange = (e: Event) => {
      if (e.type === "storage") dirty = null;
      else if (dirty) for (const k of EVENT_KEYS[e.type] ?? []) dirty.add(k);
      if (stampTimer) clearTimeout(stampTimer);
      stampTimer = setTimeout(flushStamp, STAMP_DEBOUNCE_MS);
    };

    const onVisibility = () => {
      if (!userId) return;
      if (document.visibilityState === "hidden") {
        flushStamp();
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
      if (stampTimer) clearTimeout(stampTimer);
    };
  }, [userId]);

  return (
    <ConfirmSheet
      open={choice}
      blocking
      busy={busy}
      icon={icons.user}
      title="على هذا الجهاز بيانات حساب آخر"
      body="الإعدادات والتقدّم المحفوظة هنا تخصّ حساباً سُجّل به سابقاً على هذا الجهاز. اختر ما يحدث لها قبل مزامنة حسابك — لن يُرفع شيء قبل اختيارك."
      actions={[
        {
          label: "استخدم بيانات حسابي فقط",
          hint: "تُمسح بيانات الحساب السابق من الجهاز وتُستعاد نسختك من السحابة",
          onSelect: () => void resolve("mine"),
        },
        {
          label: "ادمج بيانات هذا الجهاز في حسابي",
          hint: "تُضاف إعدادات الحساب السابق وتقدّمه إلى حسابك",
          tone: "plain",
          onSelect: () => void resolve("merge"),
        },
        {
          label: "تسجيل الخروج",
          tone: "danger",
          onSelect: () => void resolve("leave"),
        },
      ]}
      onCancel={() => undefined}
    />
  );
}
