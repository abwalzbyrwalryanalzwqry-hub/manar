/* منار — تنسيق العرض: ساعة ١٢ أو ٢٤، وأرقام عربية (٠١٢) أو غربية (012).
 *
 * كل دوال `format.ts` تقرأ من هنا، فيسري الاختيار على كل الشاشات والإشعارات.
 *
 * الترطيب: الخادم يرسم دائماً بالافتراضي (١٢ ساعة، أرقام عربية). لذلك تبقى
 * الحالة «الفعّالة» على الافتراضي حتى يستدعي الجذر `activateDisplayPrefs()`
 * بعد التركيب، ثم يعيد رسم الصفحة مرة واحدة إن كان اختيار المستخدم مختلفاً.
 * من لم يغيّر شيئاً لا يدفع أي كلفة.
 */

export const DISPLAY_KEY = "manar.display.v1";
export const DISPLAY_EVENT = "manar:display";

export type ClockFormat = "12" | "24";
export type DigitStyle = "arab" | "latn";
export type DisplayPrefs = { clock: ClockFormat; digits: DigitStyle };

export const DEFAULT_DISPLAY: DisplayPrefs = { clock: "12", digits: "arab" };

export const CLOCK_LABELS: Record<ClockFormat, string> = { "12": "١٢ ساعة", "24": "٢٤ ساعة" };
export const DIGIT_LABELS: Record<DigitStyle, string> = {
  arab: "٠١٢٣",
  latn: "0123",
};

export function normalizeDisplay(raw: unknown): DisplayPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DisplayPrefs>;
  return {
    clock: r.clock === "24" ? "24" : "12",
    digits: r.digits === "latn" ? "latn" : "arab",
  };
}

export function readDisplay(): DisplayPrefs {
  if (typeof window === "undefined") return DEFAULT_DISPLAY;
  try {
    const raw = window.localStorage.getItem(DISPLAY_KEY);
    return raw ? normalizeDisplay(JSON.parse(raw)) : DEFAULT_DISPLAY;
  } catch {
    return DEFAULT_DISPLAY;
  }
}

let active: DisplayPrefs = DEFAULT_DISPLAY;

/** الحالة التي تنسّق بها دوال `format.ts` الآن. */
export function displayPrefs(): DisplayPrefs {
  return active;
}

export const isDefaultDisplay = (p: DisplayPrefs) =>
  p.clock === DEFAULT_DISPLAY.clock && p.digits === DEFAULT_DISPLAY.digits;

/** يفعّل اختيار المستخدم بعد الترطيب. يرجع true إن تغيّر ما يُعرض. */
export function activateDisplayPrefs(next: DisplayPrefs = readDisplay()): boolean {
  const changed = next.clock !== active.clock || next.digits !== active.digits;
  active = next;
  return changed;
}

/** للاختبارات فقط. */
export function __setDisplayForTests(p: DisplayPrefs) {
  active = p;
}

export function writeDisplay(p: Partial<DisplayPrefs>) {
  if (typeof window === "undefined") return;
  const next = normalizeDisplay({ ...readDisplay(), ...p });
  try {
    window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(DISPLAY_EVENT));
}
