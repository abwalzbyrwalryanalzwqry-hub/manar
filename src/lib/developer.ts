/* منار — بيانات المطور الرسمية وفتح وسائل التواصل.
 *
 * البيانات ثابتة داخل التطبيق: تعمل بلا إنترنت، ولا تُرسل إلى أي خادم. الاتصال
 * بالشبكة يحدث فقط حين يختار المستخدم فتح خدمة خارجية (بريد، واتساب…)، ويتولّاه
 * تطبيق تلك الخدمة لا منار.
 */

import { openExternalNative } from "./native-notifications";

export const DEVELOPER = {
  name: "م. إدريس الزوقري",
  /** الرقم كما زُوِّدنا به (يمني محلي). */
  phone: "776343551",
  /** الصيغة الدولية للاتصال وواتساب — رمز اليمن ٩٦٧ مع الرقم نفسه. */
  phoneIntl: "967776343551",
  address: "اليمن _ إب _ جوبلة",
  email: "zoqriidris@gmail.com",
  emailAlt: "old-contact@example.invalid",
  /** «موقعنا» في صفحة «عن التطبيق». */
  siteEmail: "zbyrzwqr@gmail.com",
  /** «تواصل معنا» في صفحة «عن التطبيق». */
  contactEmail: "old-contact@example.invalid",
  whatsapp: "@rzleelzr",
  telegram: "rzleelzr",
  facebookName: "إدريس الزوقري",
} as const;

export type ContactKind = "phone" | "email" | "whatsapp" | "telegram" | "facebook";

/**
 * الروابط بالترتيب المفضّل: تطبيق الخدمة أولاً، ثم رابط الويب الرسمي بديلاً
 * يفتحه المتصفح إن لم يكن التطبيق مثبّتاً.
 */
export function contactUrls(kind: ContactKind, value?: string): string[] {
  switch (kind) {
    case "phone":
      return [`tel:+${DEVELOPER.phoneIntl}`];
    case "email":
      return [`mailto:${value ?? DEVELOPER.email}`];
    case "whatsapp":
      return [
        `whatsapp://send?phone=${DEVELOPER.phoneIntl}`,
        `https://wa.me/${DEVELOPER.phoneIntl}`,
      ];
    case "telegram":
      return [`tg://resolve?domain=${DEVELOPER.telegram}`, `https://t.me/${DEVELOPER.telegram}`];
    case "facebook": {
      /* لم يُزوَّد رابط حساب محدّد، فنفتح بحث فيسبوك باسم المطور نفسه. */
      const q = encodeURIComponent(DEVELOPER.facebookName);
      return [`https://www.facebook.com/search/top/?q=${q}`];
    }
  }
}

/**
 * يفتح وسيلة التواصل. على أندرويد عبر نيّة النظام (مع بدائل)، وعلى الويب
 * عبر المتصفح. يعيد `false` إن لم يوجد ما يفتحها — فتعرض الواجهة بديل النسخ.
 */
export async function openContact(kind: ContactKind, value?: string): Promise<boolean> {
  const urls = contactUrls(kind, value);
  const native = await openExternalNative(urls);
  if (native != null) return native;

  if (typeof window === "undefined") return false;
  const web = urls[urls.length - 1];
  try {
    if (/^(tel|mailto):/.test(web)) {
      window.location.href = web;
      return true;
    }
    const w = window.open(web, "_blank", "noopener,noreferrer");
    return w !== null;
  } catch {
    return false;
  }
}

/** نسخ نص إلى الحافظة، مع بديل للمتصفحات القديمة. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
