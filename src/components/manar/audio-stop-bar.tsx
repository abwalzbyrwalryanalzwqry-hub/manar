/* منار — شريط «إيقاف الصوت» داخل التطبيق.
 *
 * يظهر وحده حين يكون صوت منار نفسه يُشتغل (أذان أو إقامة)، لا حين يكون صوت
 * الهاتف أو تطبيق آخر. مصدر الحالة واحد: مدير الصوت في الطبقة الأصلية يُبلّغ
 * تغيّره، فلا استطلاع كل ثانية ولا تخمين في الواجهة.
 */

import { useEffect, useState } from "react";

import { Icon, icons } from "@/components/manar/shell";
import {
  attachAudioStateListener,
  isNativeShell,
  muteNativeAudio,
  nativeAudioState,
  stopNativeAdhan,
  type ManarAudioSnapshot,
} from "@/lib/native-notifications";

export function AudioStopBar() {
  const [snapshot, setSnapshot] = useState<ManarAudioSnapshot | null>(null);

  useEffect(() => {
    if (!isNativeShell()) return;
    let detach: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const current = await nativeAudioState();
      if (!cancelled && current) setSnapshot(current);
      const off = await attachAudioStateListener((s) => setSnapshot(s));
      if (cancelled) off();
      else detach = off;
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, []);

  const playing =
    snapshot?.state === "PLAYING_AZAN" || snapshot?.state === "PLAYING_IQAMA" ? snapshot : null;
  if (!playing) return null;

  const isIqama = playing.state === "PLAYING_IQAMA";

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 px-4" dir="rtl">
      <div className="glass flex items-center gap-3 rounded-[24px] border border-gold/30 p-3 shadow-elegant">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Icon d={icons.bell} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {playing.title || (isIqama ? "الإقامة" : "الأذان")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            صوت منار يُشتغل الآن — التنبيه يبقى بعد الكتم
          </div>
        </div>
        <button
          onClick={() => void muteNativeAudio()}
          aria-label="إيقاف الصوت"
          className="gradient-primary shrink-0 rounded-full px-4 py-2 text-[11px] font-medium text-primary-foreground shadow-glow"
        >
          🔇 إيقاف الصوت
        </button>
        <button
          onClick={() => void stopNativeAdhan()}
          aria-label={isIqama ? "إيقاف الإقامة" : "إيقاف الأذان"}
          className="shrink-0 rounded-full border border-border px-3 py-2 text-[11px] text-muted-foreground"
        >
          إنهاء
        </button>
      </div>
    </div>
  );
}
