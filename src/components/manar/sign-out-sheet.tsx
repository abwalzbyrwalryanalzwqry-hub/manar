/* منار — تسجيل الخروج الموحّد.
 *
 * كان الخروج ضغطة واحدة بلا تأكيد، ويقود إلى وجهتين مختلفتين (من «المزيد» إلى
 * الدخول، ومن «الإعدادات» إلى البداية)، ويترك بيانات الحساب على الجهاز بلا
 * سؤال. الآن ورقة واحدة تُستخدم من كل مكان:
 *   · تُرفع آخر التعديلات قبل الخروج (بمهلة قصيرة) حتى لا يضيع شيء.
 *   · يختار المستخدم إبقاء بياناته على الجهاز أو مسحها منه.
 *   · الوجهة بعد الخروج دائماً شاشة الدخول.
 */

import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { icons } from "@/components/manar/shell";
import { ConfirmSheet } from "@/components/manar/confirm-sheet";
import { useAuth } from "@/lib/auth-context";
import { syncNow, wipeLocalSyncedData } from "@/lib/cloud-sync";

/** أقصى انتظار لرفع آخر التعديلات قبل الخروج. */
const FINAL_SYNC_TIMEOUT_MS = 5000;

export function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = async (wipe: boolean) => {
    setBusy(true);
    try {
      if (user) {
        await Promise.race([
          syncNow(user.id).catch(() => null),
          new Promise((r) => setTimeout(r, FINAL_SYNC_TIMEOUT_MS)),
        ]);
      }
      await signOut();
      if (wipe) wipeLocalSyncedData();
      toast.success(wipe ? "تم تسجيل الخروج ومسح بيانات الحساب من الجهاز" : "تم تسجيل الخروج");
      onClose();
      nav({ to: "/login" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmSheet
      open={open}
      busy={busy}
      icon={icons.user}
      title="تسجيل الخروج"
      body={
        <>
          تبقى نسختك محفوظة في السحابة وتعود كاملة عند الدخول مجدداً. اختر ما يحدث لبيانات هذا
          الجهاز:
        </>
      }
      actions={[
        {
          label: busy ? "جارٍ الخروج…" : "خروج مع إبقاء بياناتي على الجهاز",
          hint: "تبقى الإعدادات والتقدّم هنا وتستمر في استخدامها",
          onSelect: () => void run(false),
        },
        {
          label: "خروج ومسح بياناتي من الجهاز",
          hint: "مناسب للأجهزة المشتركة — يعود التطبيق لإعداداته الافتراضية",
          tone: "danger",
          onSelect: () => void run(true),
        },
      ]}
      onCancel={onClose}
    />
  );
}
