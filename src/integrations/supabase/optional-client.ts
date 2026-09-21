/* منار — وصول اختياري إلى العميل السحابي (Supabase)
 * -----------------------------------------------------------------
 * `client.ts` (ملف مُنشأ تلقائياً من Lovable) يرمي استثناءً عند غياب
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`، وهو يفعل ذلك من داخل
 * Proxy، أي أن مجرد لمس أي خاصية مثل `supabase.auth` يرمي الاستثناء.
 *
 * منار تطبيق يعمل دون اتصال بالأساس: مواقيت الصلاة والأذان والقرآن والأذكار
 * كلها محلية بالكامل. لذلك يجب ألا يؤدي غياب إعداد السحابة إلى إسقاط الشجرة
 * كلها إلى حدود الخطأ (شاشة «تعذّر عرض هذه الشاشة»)؛ الصحيح هو تعطيل ميزات
 * الحساب والمزامنة فقط مع تسجيل السبب في الـlogs.
 *
 * هذه الوحدة لا تُخفي الخطأ: عند غياب الإعداد يُسجَّل تحذير صريح مرّة واحدة،
 * وتُبلِّغ دوال الحساب المستخدم برسالة عربية واضحة، ويبقى كل ما هو محلي يعمل.
 * عند وجود الإعداد فالسلوك مطابق تماماً للسابق.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { Database } from "./types";

export const CLOUD_UNAVAILABLE_MESSAGE =
  "خدمة الحساب غير مهيأة في هذه النسخة. جميع الميزات المحلية تعمل بشكل طبيعي.";

type Cloud = SupabaseClient<Database>;

let resolved: Cloud | null | undefined;

/** يعيد العميل السحابي، أو `null` إذا لم تُضبط متغيرات البيئة. */
export function getCloud(): Cloud | null {
  if (resolved !== undefined) return resolved;
  try {
    // لمس خاصية واحدة يكفي لتهيئة العميل داخل الـProxy (أو لرمي الاستثناء).
    void supabase.auth;
    resolved = supabase as unknown as Cloud;
  } catch (error) {
    console.warn(
      "[منار] الخدمة السحابية غير مهيأة — تعمل النسخة في وضع محلي بالكامل:",
      error instanceof Error ? error.message : error,
    );
    resolved = null;
  }
  return resolved;
}

/** هل السحابة مهيأة في هذا البناء؟ تُستخدم لإخفاء واجهات الحساب عند الحاجة. */
export function isCloudConfigured(): boolean {
  return getCloud() !== null;
}
