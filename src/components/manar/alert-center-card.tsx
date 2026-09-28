/* منار — «مركز التنبيهات» (المرحلة ٣٠، م٧، م١١، ت١، ت٥).
 *
 * ما لم تكن تعرضه شاشة الإشعارات: التنبيه القادم فعلاً، والقنوات التي أطفأها
 * المستخدم من إعدادات النظام، و«تجربة شاملة» بمنبّهٍ حقيقي بعد دقيقة، وسجلّ
 * التنبيهات بنسخه، وروابط إلى التنبيهات الأخرى (الأذكار، المواسم، الجمعة، سكينة).
 */

import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { Icon, icons } from "@/components/manar/shell";
import type { AdhanSettings } from "@/lib/adhan-settings";
import {
  blockedChannelsMessage,
  describeLogEvent,
  formatAlertLog,
  nextAlertLine,
  otherAlertRows,
  testVerdict,
  testVerdictText,
  type AlertLogEvent,
  type ChannelInfo,
} from "@/lib/alert-center";
import { readReminders } from "@/lib/daily-reminders";
import { copyText } from "@/lib/developer";
import { readJumuah } from "@/lib/jumuah";
import {
  clearNativeAlertLog,
  isNativeShell,
  nativeAdhanStatus,
  nativeAlertLog,
  nativeChannelStatus,
  openNativeNotificationSettings,
  scheduleFullTest,
  type NativeAdhanStatus,
} from "@/lib/native-notifications";
import { useLocation, useSettings } from "@/lib/prayer";
import { buildPrayerAlarms } from "@/lib/prayer-schedule";
import { readSakinah } from "@/lib/sakinah";
import { readSeasonNotifyPrefs } from "@/lib/seasons/store";

const TEST_KEY = "manar:full-test";

type PendingTest = { key: string; at: number };

function readPendingTest(): PendingTest | null {
  try {
    const raw = JSON.parse(localStorage.getItem(TEST_KEY) ?? "null") as PendingTest | null;
    if (!raw || typeof raw.key !== "string" || typeof raw.at !== "number") return null;
    // نتيجة تجربة قديمة (أكثر من يوم) لا تفيد.
    return Date.now() - raw.at > 86_400_000 ? null : raw;
  } catch {
    return null;
  }
}

export function AlertCenterCard({ settings }: { settings: AdhanSettings }) {
  const inNative = isNativeShell();
  const { location } = useLocation();
  const { settings: calc } = useSettings();
  const [status, setStatus] = useState<NativeAdhanStatus | null>(null);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [log, setLog] = useState<AlertLogEvent[]>([]);
  const [test, setTest] = useState<PendingTest | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    setNow(Date.now());
    setTest(readPendingTest());
    if (!inNative) return;
    void nativeAdhanStatus().then(setStatus);
    void nativeChannelStatus().then(setChannels);
    void nativeAlertLog().then(setLog);
  }, [inNative]);

  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("manar:schedule-synced", refresh);
    // تجربة قيد الانتظار: تحديثٌ كل ١٥ ثانية حتى تظهر النتيجة.
    const id = window.setInterval(() => {
      if (readPendingTest()) refresh();
    }, 15_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("manar:schedule-synced", refresh);
      window.clearInterval(id);
    };
  }, [refresh]);

  /* التنبيه القادم: من الجدول الأصلي داخل أندرويد، ومن محرّك الويب في المتصفح. */
  let next: string | null = null;
  if (inNative) {
    next = nextAlertLine(status, now);
  } else if (location) {
    const e = buildPrayerAlarms({ settings, location, calc, now, days: 2 }).find((x) => x.at > now);
    next = e ? nextAlertLine({ nextKey: e.key, nextAt: e.at, nextTitle: e.title }, now) : null;
  }

  const blocked = blockedChannelsMessage(channels);
  const verdict = test ? testVerdict(log, test, now) : null;

  const others = otherAlertRows({
    daily: readReminders(),
    seasons: readSeasonNotifyPrefs(),
    jumuah: readJumuah().prefs,
    sakinah: readSakinah(),
  });

  const startTest = async () => {
    const r = await scheduleFullTest();
    if (!r) return;
    const t = { key: r.key, at: r.at };
    localStorage.setItem(TEST_KEY, JSON.stringify(t));
    setTest(t);
    refresh();
  };

  const recent = [...log].sort((a, b) => b.at - a.at).slice(0, 30);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.clock} size={14} />
          </span>
          <div className="text-sm font-medium">مركز التنبيهات</div>
        </div>
        <div className="text-xs" data-testid="next-alert">
          {next ?? "لا تنبيه مجدول في اليومين القادمين"}
        </div>

        {blocked && (
          <button
            onClick={() => void openNativeNotificationSettings().then(refresh)}
            className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-right text-[11px] text-destructive"
          >
            <span>{blocked}</span>
            <span className="shrink-0 font-medium">فتح الإعدادات</span>
          </button>
        )}

        {inNative && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium">تجربة شاملة</div>
                <div className="text-[10px] text-muted-foreground">
                  أذانٌ حقيقي بعد دقيقة بالمسار نفسه. أغلق التطبيق وأطفئ الشاشة.
                </div>
              </div>
              <button
                onClick={() => void startTest()}
                disabled={verdict?.state === "waiting"}
                className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] text-primary-foreground disabled:opacity-50"
              >
                ابدأ
              </button>
            </div>
            {verdict && (
              <div
                role="status"
                className={`mt-2 rounded-xl px-3 py-2 text-[11px] ${
                  verdict.state === "on-time"
                    ? "bg-primary/10 text-primary"
                    : verdict.state === "waiting"
                      ? "bg-secondary text-foreground"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {testVerdictText(verdict)}
              </div>
            )}
          </div>
        )}

        {inNative && (
          <div className="mt-3 border-t border-border pt-3">
            <button
              onClick={() => setShowLog((v) => !v)}
              aria-expanded={showLog}
              className="flex w-full items-center justify-between text-xs font-medium"
            >
              <span>سجل التنبيهات</span>
              <span className="text-[10px] text-muted-foreground">{showLog ? "إخفاء" : "عرض"}</span>
            </button>
            {showLog && (
              <div className="mt-2">
                {recent.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground">لا شيء بعد.</div>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto text-[10px] text-muted-foreground">
                    {recent.map((e, i) => (
                      <li key={`${e.at}-${i}`}>{describeLogEvent(e)}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() =>
                      void copyText(formatAlertLog(log)).then((ok) => {
                        setCopied(ok);
                        window.setTimeout(() => setCopied(false), 2000);
                      })
                    }
                    className="rounded-full border border-border px-3 py-1 text-[10px]"
                  >
                    {copied ? "نُسخ" : "نسخ السجل"}
                  </button>
                  <button
                    onClick={() => void clearNativeAlertLog().then(refresh)}
                    className="rounded-full border border-border px-3 py-1 text-[10px] text-muted-foreground"
                  >
                    مسح
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-2 text-sm font-medium">تنبيهات أخرى</div>
        <div className="divide-y divide-border">
          {others.map((r) => (
            <Link
              key={r.id}
              to={r.route}
              className="flex items-center gap-3 py-2 text-xs"
              data-testid={`other-${r.id}`}
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${r.on ? "bg-primary" : "bg-muted-foreground/40"}`}
              />
              <span className="flex-1 font-medium">{r.label}</span>
              <span className="text-[10px] text-muted-foreground">{r.detail}</span>
              <Icon d={icons.chevron} size={12} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
