/* منار — بيانات الويدجتات غير المواقيت: الأذكار، المسبحة، الختمة، الصلوات،
 * المواسم. تُبنى في `widget-sync.tsx` وتحملها اللقطة (`WidgetSnapshot.extras`).
 */

export interface WidgetZikr {
  /** رقم الذكر في الباب. */
  id: number;
  text: string;
  /** عدد التكرار الموصى به. */
  repeat: number;
  /** نصّ قرآني ← يُرسم بخط المصحف. */
  q?: boolean;
  /** إرشاد قصير يلي الذكر («ثلاث مرات»). */
  note?: string;
  /** مفتاح الصورة في الحزمة. */
  pk: string;
}

export interface WidgetAzkar {
  /** باب أذكار الصباح والمساء (للرابط). */
  chapter: number;
  morning: WidgetZikr[];
  evening: WidgetZikr[];
}

export interface WidgetTasbih {
  /** معرّف الجلسة النشطة — يربط ضغطات الويدجت بها. */
  id: string;
  name: string;
  count: number;
  /** ٠ = بلا هدف. */
  target: number;
}

export interface WidgetKhatmah {
  title: string;
  /** «ورد اليوم: البقرة ١٤٢ ← آل عمران ١٢». */
  portion: string;
  /** ٠..١ */
  progress: number;
  /** أُتمّ ورد اليوم. */
  todayDone: boolean;
}

export interface WidgetLastRead {
  label: string;
  surah: number;
  ayah: number;
}

/** موسم يوم بعينه: الجاري أو أقرب القادم. */
export interface WidgetSeason {
  date: string;
  id: string;
  title: string;
  /** «اليوم ١٢ من رمضان» أو «بعد ١٢ يوماً». */
  line: string;
  /** رمضان: يعرض الأصلي عدّ الإفطار/الإمساك. */
  ramadan?: boolean;
  /** ٠..١ للموسم الجاري. */
  progress?: number;
}

export interface WidgetExtras {
  azkar?: WidgetAzkar;
  tasbih?: WidgetTasbih | null;
  khatmah?: WidgetKhatmah | null;
  lastRead?: WidgetLastRead | null;
  /** الصلوات المؤدّاة بمفتاح اليوم `YYYY-MM-DD`. */
  prayed?: Record<string, string[]>;
  seasons?: WidgetSeason[];
}
