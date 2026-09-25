/* منار — فتح تذكير الأذكار والوِرد في صفحته.
 *
 * كل تذكير يحمل مساره (`/azkar` أو `/wird` …) في `extra.route`، لكن النقر عليه
 * كان يفتح التطبيق فقط. هذا المكوّن يسجّل مستمعاً واحداً عند الإقلاع وينقل إلى
 * الصفحة، وزرّ «ذكّرني لاحقاً» داخل الإشعار يؤجّله عشر دقائق. في المتصفح لا
 * يفعل شيئاً.
 */

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

import { isNativeApp } from "@/lib/native-shell";
import { attachReminderTapListener } from "@/lib/native-notifications";

export function ReminderTapBridge() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeApp()) return;
    void attachReminderTapListener((route) => {
      /* بعض الوجهات فيها استعلام (`/azkar/27?time=evening`) فتُمرَّر كرابط كامل. */
      void router.navigate({ href: route });
    });
  }, [router]);
  return null;
}
