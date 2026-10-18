/**
 * سجلّ أنواع ويدجتات منار — مصدر واحد لصفحة الويدجتات (المعرض والإضافة)
 * يطابق WidgetHub.KINDS في الأصلي (ويتحقّق من ذلك اختبار الوحدة).
 */
export type WidgetKind =
  | "hub"
  | "next"
  | "day"
  | "verse"
  | "azkar"
  | "tasbih"
  | "prayed"
  | "hijri"
  | "quran";

export type WidgetOptionKey =
  | "verse"
  | "times"
  | "shortcuts"
  | "countdown"
  | "hijri"
  | "city"
  | "season";

export interface WidgetKindInfo {
  kind: WidgetKind;
  label: string;
  sub: string;
  /** المقاس الافتراضي بالخلايا (عرض×ارتفاع). */
  cells: [number, number];
  /** الخيارات التي تخصّ هذا النوع في صفحة الإعداد (السمة والشفافية للجميع). */
  options: readonly WidgetOptionKey[];
}

export const WIDGET_KINDS: readonly WidgetKindInfo[] = [
  {
    kind: "hub",
    label: "الشامل",
    sub: "الصلاة القادمة والعدّ، التاريخ والموسم، آية اليوم، مواقيت اليوم واختصارات — يتكيّف مع المقاس",
    cells: [4, 2],
    options: ["countdown", "hijri", "city", "season", "verse", "times", "shortcuts"],
  },
  {
    kind: "next",
    label: "الصلاة القادمة",
    sub: "حلقة تقدّم حتى الأذان أو الإقامة، صغير يناسب أي زاوية",
    cells: [2, 2],
    options: ["countdown"],
  },
  {
    kind: "day",
    label: "مواقيت اليوم",
    sub: "الصلوات الخمس والشروق في صف، مع تمييز القادمة والعدّ لها",
    cells: [4, 1],
    options: ["countdown", "hijri", "city", "season"],
  },
  {
    kind: "verse",
    label: "آية اليوم",
    sub: "آية كل يوم بخط المصحف، كاملة بلا قصّ، تفتح المصحف عليها",
    cells: [4, 2],
    options: [],
  },
  {
    kind: "azkar",
    label: "أذكار الصباح والمساء",
    sub: "ذكر بعد ذكر بحسب الوقت مع عدد تكراره، وزر «التالي»",
    cells: [4, 2],
    options: [],
  },
  {
    kind: "tasbih",
    label: "المسبحة",
    sub: "سبّح بلمسة من الشاشة الرئيسية، ويُضاف العدّ إلى جلستك في منار",
    cells: [2, 2],
    options: [],
  },
  {
    kind: "prayed",
    label: "صلواتي اليوم",
    sub: "سجّل كل صلاة بلمسة وتابع يومك وسلسلتك",
    cells: [4, 1],
    options: [],
  },
  {
    kind: "hijri",
    label: "التقويم الهجري",
    sub: "اليوم والشهر الهجريان بخط منار، والموسم الجاري",
    cells: [2, 2],
    options: ["season"],
  },
  {
    kind: "quran",
    label: "القرآن والختمة",
    sub: "متابعة القراءة من حيث توقفت، وتقدّم ختمتك وورد اليوم",
    cells: [4, 2],
    options: [],
  },
];

export function kindInfo(kind: string): WidgetKindInfo | undefined {
  return WIDGET_KINDS.find((k) => k.kind === kind);
}
