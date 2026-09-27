/* منار — الاسم الاختياري الذي نناديك به.
 *
 * حلّ محلّ اسم الحساب بعد حذف تسجيل الدخول: يُحفظ على هذا الجهاز فقط، ويدخل
 * النسخة الاحتياطية، ولا يُرسل إلى أي مكان.
 */

import { useEffect, useState } from "react";

export const USER_NAME_KEY = "manar.user.name.v1";
export const USER_NAME_EVENT = "manar:user-name";
export const USER_NAME_MAX = 30;

/** ينظّف الاسم: بلا مسافات زائدة ولا محارف تحكّم، وبطول أقصى. */
export function cleanName(raw: string): string {
  return raw
    .split("")
    .filter((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) !== 0x7f)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, USER_NAME_MAX);
}

export function readUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(USER_NAME_KEY);
    const v = raw ? JSON.parse(raw) : "";
    return typeof v === "string" ? cleanName(v) : "";
  } catch {
    return "";
  }
}

export function saveUserName(name: string): void {
  if (typeof window === "undefined") return;
  const v = cleanName(name);
  try {
    if (v) localStorage.setItem(USER_NAME_KEY, JSON.stringify(v));
    else localStorage.removeItem(USER_NAME_KEY);
  } catch {
    /* التخزين ممتلئ أو محجوب */
  }
  window.dispatchEvent(new Event(USER_NAME_EVENT));
}

/** الاسم الحالي؛ يبدأ فارغاً على الخادم والجهاز معاً ثم يُقرأ بعد التركيب. */
export function useUserName(): string {
  const [name, setName] = useState("");
  useEffect(() => {
    const sync = () => setName(readUserName());
    sync();
    window.addEventListener(USER_NAME_EVENT, sync);
    return () => window.removeEventListener(USER_NAME_EVENT, sync);
  }, []);
  return name;
}
