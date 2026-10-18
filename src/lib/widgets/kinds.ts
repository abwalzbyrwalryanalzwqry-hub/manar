/**
 * سجلّ أنواع ويدجتات منار — مصدر واحد لصفحة الويدجتات (المعرض والإضافة)
 * يطابق WidgetHub.KINDS في الأصلي.
 */
export type WidgetKind = "hub";

export interface WidgetKindInfo {
  kind: WidgetKind;
  label: string;
  sub: string;
  /** المقاس الافتراضي بالخلايا (عرض×ارتفاع). */
  cells: [number, number];
  /** الخيارات التي تخصّ هذا النوع في صفحة الإعداد. */
  options: ReadonlyArray<
    "verse" | "times" | "shortcuts" | "countdown" | "hijri" | "city" | "season"
  >;
}

export const WIDGET_KINDS: readonly WidgetKindInfo[] = [
  {
    kind: "hub",
    label: "الشامل",
    sub: "الصلاة القادمة والعدّ، التاريخ والموسم، آية اليوم، مواقيت اليوم واختصارات — يتكيّف مع المقاس",
    cells: [4, 2],
    options: ["countdown", "hijri", "city", "season", "verse", "times", "shortcuts"],
  },
];

export function kindInfo(kind: string): WidgetKindInfo | undefined {
  return WIDGET_KINDS.find((k) => k.kind === kind);
}
