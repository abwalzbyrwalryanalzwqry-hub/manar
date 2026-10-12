/* منار — ورقة سفلية عامة بهوية التطبيق (نماذج الأذكار الشخصية والمسبحة).
 *
 * الشكل نفسه المعتمد في `ConfirmSheet`: حوافّ ٣٢ وخلفية `bg-card` وحاجز معتم.
 * تُغلق بـ Escape وبزرّ رجوع أندرويد وباللمس خارجها (ما لم يُمنع ذلك حين يكون
 * في النموذج ما قد يضيع)، وتحمل `role="dialog"` و`aria-modal` لقارئ الشاشة،
 * وتعيد التركيز إلى ما كان عليه بعد الإغلاق.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon, icons } from "@/components/manar/shell";
import { addBackInterceptor } from "@/lib/native-shell";

export function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  dismissible = true,
  initialFocus,
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** أزرار ثابتة أسفل الورقة (تبقى ظاهرة مهما طال المحتوى). */
  footer?: ReactNode;
  /** اللمس خارج الورقة يغلقها؟ (يُعطَّل حين يكون في النموذج نص لم يُحفظ). */
  dismissible?: boolean;
  /** عنصر يأخذ التركيز عند الفتح (افتراضيًا الورقة نفسها). */
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const focusRef = useRef(initialFocus);
  focusRef.current = initialFocus;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    (focusRef.current?.current ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    const removeBack = addBackInterceptor(() => {
      closeRef.current();
      return true;
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      removeBack();
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/60 backdrop-blur-sm"
      onClick={() => dismissible && onClose()}
    >
      <div
        ref={panel}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[90vh] w-full max-w-md flex-col rounded-t-[32px] border-t border-border bg-card shadow-elegant outline-none animate-fade-up"
      >
        <div className="px-6 pt-4">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-muted" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-lg font-medium leading-snug">
                {title}
              </h2>
              {subtitle && (
                <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {subtitle}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <Icon d={icons.close} size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-4">{children}</div>
        {footer && (
          <div className="border-t border-border/60 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
