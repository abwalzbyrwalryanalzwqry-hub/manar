/* منار — بطاقة حالة منظومة الصلاة: الأذان · الإقامة · التنبيهات.
 *
 * تعرض ما سيحدث فعلاً لا ما يتمنّاه المستخدم: كل مرحلة بمفتاحها المستقل،
 * وداخل أندرويد عددُ الأحداث المضبوطة فعلاً في النظام وحالة إذن المنبّهات
 * الدقيقة. الألوان من هوية منار نفسها: الأخضر الزمرّدي للمفعّل، ولون التحذير
 * المعتمد في السمة لغير المفعّل.
 */

import { useEffect, useState } from "react";
import { Icon, icons } from "@/components/manar/shell";
import type { AdhanSettings } from "@/lib/adhan-settings";
import { iqamahLabel } from "@/lib/iqamah-library";
import { toArabicDigits } from "@/lib/format";
import {
  isNativeShell,
  nativeAdhanStatus,
  openNativeNotificationSettings,
  requestExactAlarms,
  type NativeAdhanStatus,
} from "@/lib/native-notifications";
import { adhanVerdict } from "@/lib/alert-permissions";
import { agoAr } from "@/lib/notification-text";

type Row = { label: string; on: boolean; detail: string; feminine: boolean };

function rowsFor(s: AdhanSettings): Row[] {
  const soundOn = s.soundEnabled && !s.silentMode;
  const noticeParts: string[] = [];
  if (s.prayerNoticeEnabled) noticeParts.push("دخول الوقت");
  if (s.remindersEnabled && s.reminderMinutes.length) noticeParts.push("قبل الصلاة");
  if (s.iqamaReminderEnabled) noticeParts.push("قبل الإقامة");
  return [
    {
      label: "الأذان",
      on: s.adhanEnabled,
      feminine: false,
      detail: s.adhanEnabled ? (soundOn ? "بالصوت المختار" : "بلا صوت") : "",
    },
    {
      label: "الإقامة",
      on: s.iqamaEnabled,
      feminine: true,
      detail: s.iqamaEnabled
        ? soundOn && s.iqamaSoundEnabled
          ? iqamahLabel(s.iqamaVariant)
          : "إشعار بلا صوت"
        : "",
    },
    {
      label: "التنبيهات",
      on: noticeParts.length > 0,
      feminine: true,
      detail: noticeParts.join(" · "),
    },
  ];
}

const relTime = (ms: number) => agoAr(ms);

/** «آخر تعذّر قبل كذا» إن كان خلال الأيام السبعة الماضية وبعد آخر منحٍ للإذن. */
function recentFailure(n: NativeAdhanStatus): string | null {
  const at = n.playbackFailedAt ?? 0;
  if (!at || Date.now() - at > 7 * 86_400_000) return null;
  // مُنح الإذن بعد التعذّر: السبب زال، فلا نُبقي التحذير.
  if (n.playbackFailedReason === "background_start" && adhanVerdict(n) === "ok") return null;
  return `آخر تعذّر ${relTime(at)}`;
}

export function AlertSystemStatus({ settings }: { settings: AdhanSettings }) {
  const [native, setNative] = useState<NativeAdhanStatus | null>(null);
  const inNative = isNativeShell();

  useEffect(() => {
    if (!inNative) return;
    let alive = true;
    const refresh = () =>
      void nativeAdhanStatus().then((s) => {
        if (alive) setNative(s);
      });
    refresh();
    window.addEventListener("manar:schedule-synced", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.removeEventListener("manar:schedule-synced", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [inNative]);

  const rows = rowsFor(settings);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon d={icons.bell} size={14} />
        </span>
        <div className="text-sm font-medium">حالة المنظومة</div>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.on ? "bg-primary" : "bg-destructive"}`}
            />
            <span className="w-16 shrink-0 text-xs font-medium">{r.label}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                r.on ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
              }`}
            >
              {r.on ? "مفعّل" : "غير مفعّل"}
              {r.feminine ? "ة" : ""}
            </span>
            <span className="min-w-0 flex-1 truncate text-left text-[10px] text-muted-foreground">
              {r.detail}
            </span>
          </div>
        ))}
      </div>

      {inNative && native && (
        <div className="mt-3 border-t border-border pt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>
              مُجدوَل في النظام: {toArabicDigits(native.pendingAdhan ?? native.pending)} أذان ·{" "}
              {toArabicDigits(native.pendingIqama ?? 0)} إقامة ·{" "}
              {toArabicDigits(native.pendingNotice ?? 0)} تنبيه
            </span>
            {native.lastScheduledAt ? <span>{relTime(native.lastScheduledAt)}</span> : null}
          </div>
          <div className="mt-1">
            إعادة الجدولة تلقائية: عند فتح التطبيق وتغيير الإعدادات وإعادة التشغيل
          </div>
          {native.notificationsAllowed === false && (
            <button
              onClick={() =>
                void openNativeNotificationSettings().then(() =>
                  nativeAdhanStatus().then(setNative),
                )
              }
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-right text-destructive"
            >
              <span>الإشعارات معطّلة لمنار من إعدادات النظام — لن يظهر أيّ تنبيه مكتوب.</span>
              <span className="shrink-0 font-medium">فتح الإعدادات</span>
            </button>
          )}
          {adhanVerdict(native) !== "ok" && (
            <button
              onClick={() =>
                void requestExactAlarms().then(() => nativeAdhanStatus().then(setNative))
              }
              className={`mt-2 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-right ${
                adhanVerdict(native) === "silent"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-gold/40 bg-gold/10 text-foreground"
              }`}
            >
              <span>
                {adhanVerdict(native) === "silent"
                  ? "إذن «المنبّهات والتذكيرات» غير ممنوح — لن يُسمع الأذان والتطبيق مغلق، يصل إشعاراً مكتوباً فقط"
                  : "إذن «المنبّهات والتذكيرات» غير ممنوح — قد يتأخّر الأذان والإقامة دقائق"}
              </span>
              <span className="shrink-0 text-primary">منح</span>
            </button>
          )}
          {recentFailure(native) && (
            <div className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-destructive">
              {native.playbackFailedReason === "background_start"
                ? `${recentFailure(native)}: منع النظام صوت الأذان لغياب إذن المنبّهات الدقيقة، فوصل إشعاراً مكتوباً.`
                : `${recentFailure(native)}: تعذّر تشغيل صوت الأذان، فوصل إشعاراً مكتوباً.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
