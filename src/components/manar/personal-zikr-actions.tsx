/* منار — شارة «ذكري الخاص» وقائمة إجراءات الذكر الشخصي.
 *
 * الشارة تعريف فقط (هذا ذكر كتبته أنت)، لا حكم على صحة النص أو مصدره، ولا
 * تظهر على الأذكار الأصلية أبدًا. تحمل رمزًا ونصًا فلا يُعتمد على اللون وحده.
 * الإجراءات كلها تمرّ من `personalAzkar` التي ترفض أي معرّف غير شخصي.
 */

import { useState } from "react";
import { BottomSheet } from "@/components/manar/bottom-sheet";
import { ConfirmSheet } from "@/components/manar/confirm-sheet";
import { Icon, icons } from "@/components/manar/shell";
import { toast } from "@/lib/toast";
import type { WirdSessionKey } from "@/lib/wird/data";
import { displayName, type PersonalZikr } from "@/lib/personal-azkar/model";
import { personalAzkar } from "@/lib/personal-azkar/store";
import type { PersonalSheetMode } from "@/components/manar/personal-zikr-sheet";

export function PersonalBadge({ pinned = false }: { pinned?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
      <Icon d={pinned ? icons.star : icons.user} size={10} strokeWidth={2} />
      ذكري الخاص
      {pinned && <span className="sr-only">، مميّز</span>}
    </span>
  );
}

const SESSION_LABEL: Record<WirdSessionKey, string> = {
  morning: "ورد الصباح",
  evening: "ورد المساء",
};

/** زر ⋯ صغير يفتح قائمة إجراءات الذكر الشخصي. */
export function PersonalMenuButton({ zikr, onClick }: { zikr: PersonalZikr; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-no-tap
      aria-label={`خيارات «${displayName(zikr)}»`}
      aria-haspopup="dialog"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
    >
      <Icon d={icons.more} size={20} strokeWidth={3.2} />
    </button>
  );
}

/**
 * قائمة الإجراءات. `session` هو الوِرد المفتوح الآن (لإزالة الذكر منه وحده)،
 * و`onEdit` يفتح نموذج التعديل على الحقل المطلوب.
 */
export function PersonalActionsSheet({
  zikr,
  session,
  context,
  onClose,
  onEdit,
  onUseInTasbih,
}: {
  zikr: PersonalZikr | null;
  session?: WirdSessionKey;
  context: "wird" | "tasbih";
  onClose: () => void;
  onEdit: (mode: PersonalSheetMode) => void;
  onUseInTasbih?: (zikr: PersonalZikr) => void;
}) {
  const [confirm, setConfirm] = useState<"delete" | null>(null);
  if (!zikr) return null;
  const name = displayName(zikr);
  const linked = zikr.wird.sessions;

  const edit = (focus?: "text" | "name" | "repeat" | "wirds" | "target") => {
    onClose();
    onEdit({ kind: "edit", zikr, context, focus });
  };

  const done = (res: ReturnType<typeof personalAzkar.remove>, msg: string) => {
    if (res.ok) toast.success(msg);
    else toast.error(res.error);
  };

  const deleteBody =
    linked.length === 2
      ? "سيُحذف من ورد الصباح وورد المساء معًا، ومن «أذكاري الخاصة» في المسبحة. لن يتأثر أي ذكر أصلي."
      : linked.length === 1
        ? `سيُحذف من ${SESSION_LABEL[linked[0]]} ومن «أذكاري الخاصة» في المسبحة. لن يتأثر أي ذكر أصلي.`
        : "سيُحذف من «أذكاري الخاصة» في المسبحة. لن يتأثر أي ذكر أصلي.";

  const row = (label: string, icon: string, onClick: () => void, hint?: string, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-right text-sm transition hover:bg-secondary ${
        danger ? "text-destructive" : ""
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          danger ? "bg-destructive/10" : "bg-secondary text-primary"
        }`}
      >
        <Icon d={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );

  return (
    <>
      <BottomSheet
        open={!confirm}
        title={name}
        subtitle={<PersonalBadge pinned={zikr.pinned} />}
        onClose={onClose}
      >
        <div className="space-y-1">
          {row("تعديل الذكر", icons.edit, () => edit("text"))}
          {row("تغيير الاسم", icons.tag, () => edit("name"))}
          {context === "wird"
            ? row("تغيير عدد التكرارات", icons.hash, () => edit("repeat"))
            : row("تغيير العدد الافتراضي", icons.hash, () => edit("target"))}
          {row(
            "تغيير الورد المرتبط به",
            icons.sunrise,
            () => edit("wirds"),
            linked.length ? linked.map((s) => SESSION_LABEL[s]).join(" و") : "غير مضاف إلى الوِرد",
          )}
          {row(zikr.pinned ? "إلغاء التمييز" : "تمييز الذكر", icons.star, () => {
            const res = personalAzkar.togglePin(zikr.id);
            done(res, zikr.pinned ? "أُلغي التمييز" : "مُيّز الذكر");
            onClose();
          })}
          {onUseInTasbih &&
            row("الذكر به في المسبحة", icons.azkar, () => {
              onClose();
              onUseInTasbih(zikr);
            })}
          {context === "wird" &&
            session &&
            linked.includes(session) &&
            row(
              `إزالته من ${SESSION_LABEL[session]} فقط`,
              icons.minus,
              () => {
                const res = personalAzkar.unlink(zikr.id, session);
                done(
                  res,
                  linked.length === 2
                    ? `أُزيل من ${SESSION_LABEL[session]} وبقي في ${SESSION_LABEL[session === "morning" ? "evening" : "morning"]}`
                    : `أُزيل من ${SESSION_LABEL[session]} وبقي في «أذكاري الخاصة»`,
                );
                onClose();
              },
              linked.length === 2 ? "يبقى في الوِرد الآخر" : "يبقى في «أذكاري الخاصة» بالمسبحة",
            )}
          {row("حذف الذكر", icons.trash, () => setConfirm("delete"), undefined, true)}
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirm === "delete"}
        title={`حذف «${name}»؟`}
        body={deleteBody}
        icon={icons.trash}
        actions={[
          {
            label: "حذف نهائي",
            tone: "danger",
            onSelect: () => {
              const res = personalAzkar.remove(zikr.id);
              done(res, "حُذف الذكر");
              setConfirm(null);
              onClose();
            },
          },
        ]}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

/** زر «إضافة ذكر +» بهوية أزرار الوِرد الثانوية. */
export function AddZikrButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition active:scale-[0.98] ${className}`}
    >
      إضافة ذكر
      <Icon d={icons.plus} size={16} strokeWidth={2} />
    </button>
  );
}
