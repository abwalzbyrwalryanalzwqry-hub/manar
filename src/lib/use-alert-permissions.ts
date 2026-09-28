/* منار — قراءة أذونات التنبيه وإصلاحها (للمكوّن `AlertPermissionRows`). */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { adhanVerdict, type AlertPermissions, type PermissionKey } from "@/lib/alert-permissions";
import {
  readAlertPermissions,
  requestBatteryExemption,
  requestExactAlarms,
  requestNotificationAccess,
} from "@/lib/native-notifications";

/** يقرأ الأذونات ويعيد قراءتها عند العودة إلى التطبيق. `null` خارج أندرويد. */
export function useAlertPermissions() {
  const [perms, setPerms] = useState<AlertPermissions | null>(null);
  const refresh = useCallback(async () => {
    const p = await readAlertPermissions();
    setPerms(p);
    return p;
  }, []);
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("resume", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("resume", onVisible);
    };
  }, [refresh]);
  return { perms, refresh };
}

type RowSpec = {
  key: PermissionKey;
  label: string;
  ok: boolean;
  why: string;
  need: "مطلوب" | "موصى به";
};

export function permissionRows(p: AlertPermissions): RowSpec[] {
  const verdict = adhanVerdict(p);
  return [
    {
      key: "notifications",
      label: "الإشعارات",
      ok: p.notifications === "granted",
      why: "لدخول الوقت والتذكيرات وزرّ إيقاف الأذان",
      need: "مطلوب",
    },
    {
      key: "exact",
      label: "المنبّهات الدقيقة",
      ok: p.exactAlarms,
      why:
        verdict === "silent"
          ? "بدونه لا يُسمع الأذان والتطبيق مغلق"
          : "ليصل الأذان في دقيقته لا متأخّراً",
      need: "مطلوب",
    },
    {
      key: "battery",
      label: "البطارية: غير مقيّد",
      ok: p.batteryUnrestricted,
      why: "حتى لا يوقف النظام منار في الخلفية",
      need: "موصى به",
    },
  ];
}

export async function fixPermission(key: PermissionKey): Promise<void> {
  if (key === "notifications") {
    const r = await requestNotificationAccess();
    if (r !== "granted") {
      toast("من «الإشعارات» فعّل «السماح بالإشعارات» لمنار، ثم ارجع", { duration: 4000 });
    }
    return;
  }
  if (key === "exact") {
    await requestExactAlarms();
    toast("فعّل «السماح بضبط المنبّهات والتذكيرات»، ثم ارجع إلى منار", { duration: 4000 });
    return;
  }
  await requestBatteryExemption();
  toast("من «البطارية» اختر «غير مقيّد» (أو «عدم التحسين» حسب جهازك)، ثم ارجع إلى منار", {
    duration: 5000,
  });
}
