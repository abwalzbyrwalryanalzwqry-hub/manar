/* منار — وصول اختياري وكسول إلى العميل السحابي (Supabase)
 * -----------------------------------------------------------------
 * `client.ts` (ملف مُنشأ تلقائياً من Lovable) يرمي استثناءً عند غياب
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`، وهو يفعل ذلك من داخل
 * Proxy، أي أن مجرد لمس أي خاصية مثل `supabase.auth` يرمي الاستثناء.
 *
 * منار تطبيق يعمل دون اتصال بالأساس: مواقيت الصلاة والأذان والقرآن والأذكار
 * كلها محلية بالكامل. لذلك يجب ألا يؤدي غياب إعداد السحابة إلى إسقاط الشجرة
 * كلها إلى حدود الخطأ؛ الصحيح هو تعطيل ميزات الحساب والمزامنة فقط مع تسجيل
 * السبب في الـlogs.
 *
 * التحميل الكسول: مكتبة Supabase (المصادقة والاستعلام والتخزين والوقت الحقيقي)
 * كانت تُحلَّل مع أول ملف JavaScript قبل رسم أي شاشة، وهي لا تلزم للمواقيت ولا
 * للقرآن. الآن تُحمَّل بـ `import()` في جزء مستقل بعد أول رسم (`loadCloud`)،
 * ولا تُحمَّل إطلاقاً في نسخة بلا إعداد سحابي.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const CLOUD_UNAVAILABLE_MESSAGE =
  "خدمة الحساب غير مهيأة في هذه النسخة. جميع الميزات المحلية تعمل بشكل طبيعي.";

type Cloud = SupabaseClient<Database>;

let resolved: Cloud | null | undefined;
let pending: Promise<Cloud | null> | undefined;

function envValue(viteName: string, serverName: string): string | undefined {
  const vite = (import.meta.env as Record<string, string | undefined>)[viteName];
  if (vite) return vite;
  if (typeof process !== "undefined" && process.env) return process.env[serverName];
  return undefined;
}

/** هل السحابة مهيأة في هذا البناء؟ فحص متزامن لا يحمّل المكتبة. */
export function isCloudConfigured(): boolean {
  if (resolved === null) return false;
  return Boolean(
    envValue("VITE_SUPABASE_URL", "SUPABASE_URL") &&
    envValue("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY"),
  );
}

function unavailable(reason: unknown): null {
  console.warn(
    "[منار] الخدمة السحابية غير مهيأة — تعمل النسخة في وضع محلي بالكامل:",
    reason instanceof Error ? reason.message : reason,
  );
  resolved = null;
  return null;
}

/**
 * يحمّل العميل السحابي مرة واحدة ويعيده، أو `null` إذا لم تُضبط متغيرات البيئة
 * أو تعذّر تحميل الجزء (فيبقى التطبيق في الوضع المحلي بدل أن ينهار).
 */
export function loadCloud(): Promise<Cloud | null> {
  if (resolved !== undefined) return Promise.resolve(resolved);
  if (!pending) {
    pending = (async () => {
      if (!isCloudConfigured()) return unavailable("متغيرات Supabase غير مضبوطة");
      try {
        const { supabase } = await import("./client");
        // لمس خاصية واحدة يكفي لتهيئة العميل داخل الـProxy (أو لرمي الاستثناء).
        void supabase.auth;
        resolved = supabase as unknown as Cloud;
        return resolved;
      } catch (error) {
        return unavailable(error);
      }
    })();
  }
  return pending;
}

/** العميل إن كان قد حُمِّل مسبقاً، وإلا `null` (لا يحمّل شيئاً). */
export function getLoadedCloud(): Cloud | null {
  return resolved ?? null;
}
