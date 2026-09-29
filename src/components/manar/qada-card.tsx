/* منار — عدّاد القضاء في الإحصائيات. مطفأ افتراضياً: يظهر سطر «فعّل» فقط. */

import { Icon, icons, SectionLabel } from "@/components/manar/shell";
import { FARD_PRAYERS } from "@/lib/activity-log";
import { toArabicDigits } from "@/lib/format";
import { PRAYER_LABELS } from "@/lib/prayer";
import {
  adjustQada,
  adjustQadaFasts,
  makeUpFast,
  makeUpQada,
  qadaTotal,
  useQada,
  type FardKey,
} from "@/lib/qada";

export function QadaCard() {
  const { store, commit } = useQada();

  if (!store.enabled) {
    return (
      <div className="px-4 pt-6">
        <button
          type="button"
          onClick={() => commit((s) => ({ ...s, enabled: true }))}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-right"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon d={icons.repeat} size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">عدّاد القضاء</span>
            <span className="block text-[10px] text-muted-foreground">
              اختياري: سجّل ما فاتك من صلوات واطرح ما تقضيه
            </span>
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-[11px]">فعّل</span>
        </button>
      </div>
    );
  }

  const total = qadaTotal(store);
  return (
    <>
      <SectionLabel hint={`بقي ${toArabicDigits(total)} · قضيت ${toArabicDigits(store.madeUp)}`}>
        عدّاد القضاء
      </SectionLabel>
      <div className="space-y-2 px-4">
        {(FARD_PRAYERS as FardKey[]).map((p) => (
          <div
            key={p}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
          >
            <span className="min-w-0 flex-1 text-sm font-medium">{PRAYER_LABELS[p].ar}</span>
            <button
              type="button"
              onClick={() => commit((s) => adjustQada(s, p, -1))}
              disabled={store.remaining[p] === 0}
              aria-label={`إنقاص ${PRAYER_LABELS[p].ar} دون احتساب قضاء`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border disabled:opacity-30"
            >
              <Icon d={icons.minus} size={14} />
            </button>
            <span className="w-12 text-center font-display text-lg tabular-nums">
              {toArabicDigits(store.remaining[p])}
            </span>
            <button
              type="button"
              onClick={() => commit((s) => adjustQada(s, p, 1))}
              aria-label={`إضافة فائتة ${PRAYER_LABELS[p].ar}`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border"
            >
              <Icon d={icons.plus} size={14} />
            </button>
            <button
              type="button"
              onClick={() => commit((s) => makeUpQada(s, p))}
              disabled={store.remaining[p] === 0}
              className="gradient-primary rounded-xl px-3 py-2 text-[11px] font-medium text-primary-foreground shadow-glow disabled:opacity-40"
            >
              قضيت
            </button>
          </div>
        ))}
        {/* قضاء الصيام (مواسم منار): يُطرح منه تلقائياً ما يُسجَّل في خطة شعبان ورمضان */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">أيام الصيام</span>
            <span className="block text-[10px] text-muted-foreground">
              قضيت {toArabicDigits(store.fastsMadeUp)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => commit((s) => adjustQadaFasts(s, -1))}
            disabled={store.fasts === 0}
            aria-label="إنقاص أيام الصيام دون احتساب قضاء"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border disabled:opacity-30"
          >
            <Icon d={icons.minus} size={14} />
          </button>
          <span className="w-12 text-center font-display text-lg tabular-nums">
            {toArabicDigits(store.fasts)}
          </span>
          <button
            type="button"
            onClick={() => commit((s) => adjustQadaFasts(s, 1))}
            aria-label="إضافة يوم صيام فائت"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border"
          >
            <Icon d={icons.plus} size={14} />
          </button>
          <button
            type="button"
            onClick={() => commit(makeUpFast)}
            disabled={store.fasts === 0}
            className="gradient-primary rounded-xl px-3 py-2 text-[11px] font-medium text-primary-foreground shadow-glow disabled:opacity-40"
          >
            قضيت
          </button>
        </div>
        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          «+» يضيف فائتة، و«−» يصحّح خطأ العدّ، و«قضيت» يطرح واحدة ويحسبها في مجموع ما قضيت.
        </p>
        <button
          type="button"
          onClick={() => commit((s) => ({ ...s, enabled: false }))}
          className="w-full py-2 text-[11px] text-muted-foreground underline-offset-4 hover:underline"
        >
          إخفاء العدّاد (تبقى الأرقام محفوظة)
        </button>
      </div>
    </>
  );
}
