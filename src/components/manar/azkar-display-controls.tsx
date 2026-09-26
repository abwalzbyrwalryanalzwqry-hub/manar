/* منار — لوحة عرض الذكر: حجم النص، والاهتزاز، والعدّ بالضغط على النص.
 * مشتركة بين جلسة الأذكار وجلسة الوِرد، والتفضيلات واحدة لهما. */

import { Icon, icons } from "@/components/manar/shell";
import { TEXT_SIZES, clampTextSize, type AzkarPrefs } from "@/lib/azkar/prefs";
import { toArabicDigits } from "@/lib/format";

export function DisplayToggleButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="خيارات العرض"
      aria-expanded={open}
      className={`flex h-9 items-baseline justify-center gap-0.5 rounded-full border border-border px-3 pt-1.5 font-display leading-none ${
        open ? "bg-secondary text-foreground" : "bg-card text-muted-foreground"
      }`}
    >
      <span aria-hidden className="text-[17px]">
        أ
      </span>
      <span aria-hidden className="text-[11px]">
        أ
      </span>
    </button>
  );
}

export function AzkarDisplayPanel({
  prefs,
  update,
}: {
  prefs: AzkarPrefs;
  update: (patch: Partial<AzkarPrefs>) => void;
}) {
  const i = clampTextSize(prefs.textSize);
  const step = (d: number) => update({ textSize: clampTextSize(i + d) });
  return (
    <div
      data-no-tap
      className="relative mt-3 space-y-3 rounded-2xl border border-border/60 bg-background/60 p-3 text-[12px]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">حجم النص</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => step(-1)}
            disabled={i === 0}
            aria-label="تصغير النص"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card disabled:opacity-40"
          >
            <Icon d={icons.minus} size={14} />
          </button>
          <span className="w-10 text-center tabular-nums" aria-live="polite">
            {toArabicDigits(TEXT_SIZES[i])}
          </span>
          <button
            onClick={() => step(1)}
            disabled={i === TEXT_SIZES.length - 1}
            aria-label="تكبير النص"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card disabled:opacity-40"
          >
            <Icon d={icons.plus} size={14} />
          </button>
        </div>
      </div>
      <Toggle
        label="اهتزاز خفيف مع كل نقرة"
        checked={prefs.hapticTap}
        onChange={(v) => update({ hapticTap: v })}
      />
      <Toggle
        label="اهتزاز أقوى عند إتمام الذكر"
        checked={prefs.hapticDone}
        onChange={(v) => update({ hapticDone: v })}
      />
      <Toggle
        label="العدّ بالضغط على النص"
        checked={prefs.tapAnywhere}
        onChange={(v) => update({ tapAnywhere: v })}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3"
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "gradient-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${
            checked ? "right-0.5" : "right-[22px]"
          }`}
        />
      </span>
    </button>
  );
}
