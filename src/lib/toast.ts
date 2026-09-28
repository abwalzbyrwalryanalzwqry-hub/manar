/* منار — واجهة الإشعارات العابرة (toast) بتحميل كسول.
 *
 * مكتبة sonner (~٣٣ ك.ب) كانت في حزمة الإقلاع لأن ملفات تعمل عند الإقلاع
 * تستوردها، مع أن أول إشعار عابر لا يظهر إلا بعد فعلٍ من المستخدم. هنا الواجهة
 * نفسها (`toast`, `toast.success`…) لكن المكتبة و`<Toaster>` يُحمَّلان عند أول
 * استدعاء.
 *
 * الترتيب مهم: sonner لا يعرض ما أُطلق قبل تركيب `<Toaster>`، فننتظر التركيب
 * (`markToasterMounted`) ثم نُطلق الإشعار.
 */
import type { ExternalToast } from "sonner";
import type { ReactNode } from "react";

type Kind = "default" | "success" | "error" | "info" | "message";
type Message = string | ReactNode;

let sonner: Promise<typeof import("sonner")> | null = null;
let mounted: Promise<void> | null = null;
let resolveMounted: (() => void) | null = null;
const requestListeners = new Set<() => void>();
let requested = false;

/** يستدعيه `<LazyToaster>` بعد تركيب `<Toaster>` فعلاً. */
export function markToasterMounted(): void {
  resolveMounted?.();
}

/** هل طُلب إشعارٌ بعد؟ (فيركّب `<LazyToaster>` المكوّن). */
export function toasterRequested(): boolean {
  return requested;
}

export function onToasterRequested(fn: () => void): () => void {
  requestListeners.add(fn);
  return () => requestListeners.delete(fn);
}

function ensureToaster(): Promise<void> {
  if (!mounted) {
    mounted = new Promise<void>((r) => (resolveMounted = r));
    requested = true;
    for (const fn of requestListeners) fn();
  }
  return mounted;
}

function show(kind: Kind, message: Message, opts?: ExternalToast): void {
  if (typeof window === "undefined") return;
  sonner ??= import("sonner");
  void Promise.all([sonner, ensureToaster()]).then(([{ toast: t }]) => {
    if (kind === "default") t(message, opts);
    else t[kind](message, opts);
  });
}

export const toast = Object.assign(
  (message: Message, opts?: ExternalToast) => show("default", message, opts),
  {
    success: (message: Message, opts?: ExternalToast) => show("success", message, opts),
    error: (message: Message, opts?: ExternalToast) => show("error", message, opts),
    info: (message: Message, opts?: ExternalToast) => show("info", message, opts),
    message: (message: Message, opts?: ExternalToast) => show("message", message, opts),
  },
);
