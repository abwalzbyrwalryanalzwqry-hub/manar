/* منار — بديل كسول لـ `auth-attacher.ts` في قشرة أندرويد وحدها.
 *
 * الملف الأصلي مُنشأ تلقائياً من Lovable ويستورد عميل Supabase استيراداً ثابتاً،
 * فيجرّ المكتبة كلها إلى أول ملف JavaScript. قشرة أندرويد لا خادم فيها أصلاً،
 * لكن نُبقي السلوك نفسه (إرفاق رمز الجلسة بطلبات serverFn) مع تحميل كسول.
 * يُستبدل به الأصلي في `vite.config.capacitor.ts` فقط؛ بناء الويب لا يتغيّر.
 */
import { createMiddleware } from "@tanstack/react-start";
import { loadCloud } from "./optional-client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const cloud = await loadCloud();
    const token = cloud ? (await cloud.auth.getSession()).data.session?.access_token : undefined;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
