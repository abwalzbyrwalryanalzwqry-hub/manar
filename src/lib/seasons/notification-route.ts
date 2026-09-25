/* مواسم منار — تحويل النقر على تنبيه موسم إلى صفحة الموسم.
 * دالّة نقيّة قابلة للاختبار: تقبل حدث `localNotificationActionPerformed`
 * وتعيد معرّف الموسم إن كان التنبيه تنبيه موسم معروف، وإلا null. */

import { findSeason } from "./engine";

type ActionEvent = {
  actionId?: unknown;
  notification?: { extra?: unknown };
};

export function seasonIdFromNotificationTap(e: unknown): string | null {
  const ev = (e ?? {}) as ActionEvent;
  // «tap» هو النقر على جسم الإشعار؛ أزرار الإجراءات (مثل إيقاف الأذان) لها معرّفات أخرى.
  if (ev.actionId !== "tap") return null;
  const extra = (ev.notification?.extra ?? {}) as { kind?: unknown; season?: unknown };
  if (extra.kind !== "season" || typeof extra.season !== "string") return null;
  return findSeason(extra.season) ? extra.season : null;
}
