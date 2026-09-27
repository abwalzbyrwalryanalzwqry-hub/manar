/* منار — ورقة تأكيد موحّدة بهوية التطبيق.
 *
 * تحلّ محلّ `window.confirm` في القرارات المهمّة (الخروج، الاسترجاع، تبديل
 * الحساب). ورقة سفلية بنفس شكل أوراق الإعدادات: حوافّ ٣٢، زر أساسي متدرّج،
 * وزر خطر بلون `destructive`. تُغلق بـ Escape وبزرّ رجوع أندرويد وباللمس خارجها
 * (ما لم تكن `blocking`)، وتحمل `role="dialog"` و`aria-modal` لقارئ الشاشة.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { addBackInterceptor } from "@/lib/native-shell";

export type ConfirmAction = {
  label: string;
  hint?: string;
  onSelect: () => void;
  /** «primary» متدرّج أخضر، «danger» أحمر، «plain» إطار فقط. */
  tone?: "primary" | "danger" | "plain";
  disabled?: boolean;
};

export function ConfirmSheet({
  open,
  title,
  body,
  icon = icons.info,
  actions,
  onCancel,
  cancelLabel = "تراجع",
  blocking = false,
  busy = false,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  icon?: string;
  actions: ConfirmAction[];
  onCancel: () => void;
  cancelLabel?: string;
  /** قرار لا بدّ منه: لا يُغلق باللمس خارجه ولا يظهر زرّ «تراجع». */
  blocking?: boolean;
  busy?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !blocking) cancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    // زرّ رجوع أندرويد يُغلق الورقة بدل مغادرة الشاشة (ولا يفعل شيئاً إن كانت إلزامية).
    const removeBack = addBackInterceptor(() => {
      if (!blocking) cancelRef.current();
      return true;
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      removeBack();
      prev?.focus?.();
    };
  }, [open, blocking]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/60 backdrop-blur-sm"
      onClick={() => !blocking && !busy && onCancel()}
    >
      <div
        ref={panel}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[32px] border-t border-border bg-card p-6 shadow-elegant outline-none animate-fade-up"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Icon d={icon} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-medium leading-snug">
              {title}
            </h2>
            {body && (
              <div className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{body}</div>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onSelect}
              disabled={busy || a.disabled}
              className={`flex min-h-[48px] w-full flex-col items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition disabled:opacity-50 ${
                a.tone === "danger"
                  ? "border border-destructive/30 bg-destructive/5 text-destructive"
                  : a.tone === "plain"
                    ? "border border-border bg-card text-foreground"
                    : "gradient-primary text-primary-foreground shadow-glow"
              }`}
            >
              <span>{a.label}</span>
              {a.hint && (
                <span className="mt-0.5 text-[10px] font-normal opacity-80">{a.hint}</span>
              )}
            </button>
          ))}
          {!blocking && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="min-h-[44px] w-full rounded-2xl py-3 text-xs text-muted-foreground disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
