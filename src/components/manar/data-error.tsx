/* Manar — shared local-data error state (Arabic, RTL).
 * Used when bundled offline content is missing or corrupted:
 * never crash, always offer a retry. */

type Props = {
  message: string;
  onRetry?: () => void;
  title?: string;
};

export function DataError({ message, onRetry, title = "تعذّر تحميل المحتوى" }: Props) {
  return (
    <div className="mx-5 my-6 rounded-3xl border border-destructive/20 bg-destructive/5 p-6 text-center backdrop-blur-xl">
      <div className="font-display text-base text-foreground">{title}</div>
      <p className="mx-auto mt-2 max-w-[20rem] text-[12px] leading-relaxed text-muted-foreground">
        {message}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/80">
        المحتوى مخزَّن داخل التطبيق ولا يحتاج إنترنت.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-[12px] font-medium text-primary transition hover:bg-primary/15 active:scale-95"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
