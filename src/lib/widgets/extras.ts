/* منار — بيانات الويدجتات غير المواقيت: الأذكار، المسبحة، الختمة ومتابعة
 * القراءة، الصلوات المؤدّاة. تُبنى في `collect-extras.ts` وتحملها اللقطة
 * (`WidgetSnapshot.extras`) ويقرؤها WidgetData.java.
 */

export interface WidgetZikr {
  /** رقم الذكر في الباب (لرابط الفتح عليه). */
  id: number;
  text: string;
  /** عدد التكرار الموصى به. */
  repeat: number;
  /** نصّ قرآني ← يُرسم بخط المصحف. */
  q?: boolean;
  /** «٣ مرات»، «مرة واحدة». */
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
  /** «اليوم ٣ من ٣٠». */
  title: string;
  /** «ورد اليوم: البقرة ← آل عمران» أو «أتممت ورد اليوم». */
  portion: string;
  /** ٠..١ */
  progress: number;
  todayDone: boolean;
}

export interface WidgetLastRead {
  /** «سورة البقرة · الآية ١٤٢». */
  label: string;
  /** مسار الاستئناف داخل التطبيق. */
  route: string;
}

export interface WidgetExtras {
  azkar?: WidgetAzkar;
  tasbih?: WidgetTasbih | null;
  khatmah?: WidgetKhatmah | null;
  lastRead?: WidgetLastRead | null;
  /** الصلوات المؤدّاة بمفتاح اليوم `YYYY-MM-DD` (اليوم وأمس). */
  prayed?: Record<string, string[]>;
}
