/* منار — أدوات الأذكار الشخصية داخل الوِرد وفي المسبحة: زر «إضافة ذكر +»،
 * والنموذج، وقائمة الإجراءات، ورسالة النجاح — في مكان واحد تتشاركه الشاشات. */

import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PersonalActionsSheet } from "@/components/manar/personal-zikr-actions";
import { PersonalZikrSheet, type PersonalSheetMode } from "@/components/manar/personal-zikr-sheet";
import { toast } from "@/lib/toast";
import type { WirdSessionKey } from "@/lib/wird/data";
import { personalCardId, type PersonalZikr } from "@/lib/personal-azkar/model";

const SESSION_LABEL: Record<WirdSessionKey, string> = {
  morning: "ورد الصباح",
  evening: "ورد المساء",
};

function savedMessage(z: PersonalZikr, kind: "create" | "edit"): string {
  if (kind === "edit") return "حُفظ التعديل";
  const s = z.wird.sessions;
  if (s.length === 2) return "أُضيف الذكر إلى ورد الصباح وورد المساء";
  if (s.length === 1) return `أُضيف الذكر إلى ${SESSION_LABEL[s[0]]}`;
  return "أُضيف الذكر إلى «أذكاري الخاصة»";
}

export function usePersonalControls({
  context,
  session,
  onSaved,
}: {
  context: "wird" | "tasbih";
  session?: WirdSessionKey;
  onSaved?: (z: PersonalZikr, kind: "create" | "edit") => void;
}) {
  const nav = useNavigate();
  const [sheet, setSheet] = useState<PersonalSheetMode | null>(null);
  const [menu, setMenu] = useState<PersonalZikr | null>(null);

  const openAdd = useCallback(() => {
    setSheet(
      context === "wird" && session
        ? { kind: "create", context: "wird", session }
        : { kind: "create", context: "tasbih" },
    );
  }, [context, session]);

  const handleSaved = (z: PersonalZikr, kind: "create" | "edit") => {
    setSheet(null);
    const visibleHere =
      context === "tasbih" || (session != null && z.wird.sessions.includes(session));
    toast.success(savedMessage(z, kind), {
      duration: 2600,
      ...(kind === "create" && visibleHere
        ? {
            action: {
              label: "عرض",
              onClick: () =>
                document
                  .getElementById(personalCardId(z.id))
                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
            },
          }
        : {}),
    });
    onSaved?.(z, kind);
  };

  const nodes = (
    <>
      <PersonalZikrSheet mode={sheet} onClose={() => setSheet(null)} onSaved={handleSaved} />
      <PersonalActionsSheet
        zikr={menu}
        session={session}
        context={context}
        onClose={() => setMenu(null)}
        onEdit={setSheet}
        onUseInTasbih={
          context === "wird"
            ? (z) => nav({ to: "/tasbih/library", search: { pick: `p:${z.id}` } })
            : undefined
        }
      />
    </>
  );

  return { openAdd, openMenu: setMenu, nodes };
}
