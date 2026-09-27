/* منار — رياضيات البوصلة (نقية، بلا window) لتُختبر دون جهاز.
 *
 * ما كانت الشاشة تفعله: تأخذ `alpha` من حدث `deviceorientation` وتعدّه اتجاه
 * الشمال. لكن هذا الحدث على أندرويد «نسبي» — صفره هو اتجاه الجوال لحظة فتح
 * الصفحة لا الشمال — فكانت الإبرة تشير إلى مكان عشوائي وتقول «الحسّاس نشط».
 * هنا: نقبل فقط الاتجاه المطلق (`deviceorientationabsolute` أو `absolute: true`
 * أو `webkitCompassHeading` في iOS)، ونصحّح دوران الشاشة، ونضيف الانحراف
 * المغناطيسي، ونُنعّم القراءة، ونكشف الميل والحاجة إلى المعايرة.
 */

/** يعيد الزاوية إلى المجال [0, 360). */
export function norm360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** أقصر فرق زاوي من `from` إلى `to` في المجال (-180, 180]: موجب = مع عقارب الساعة. */
export function angleDelta(from: number, to: number): number {
  const d = norm360(to - from);
  return d > 180 ? d - 360 : d;
}

/**
 * زاوية دوران CSS مستمرة: تتحرك من القيمة السابقة بأقصر طريق فلا تلفّ الإبرة
 * دورة كاملة حين يعبر الاتجاه من ٣٥٩° إلى ٠°.
 */
export function continuousRotation(prev: number, target: number): number {
  return prev + angleDelta(prev, target);
}

export type RawOrientation = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  /** iOS: اتجاه البوصلة المغناطيسي مباشرةً (مع عقارب الساعة من الشمال). */
  webkitCompassHeading?: number;
  /** iOS: دقة القراءة بالدرجات (سالب = غير معايرة). */
  webkitCompassAccuracy?: number;
};

export type HeadingReading = {
  /** اتجاه أعلى الجوال من الشمال المغناطيسي، مع عقارب الساعة. */
  magnetic: number;
  /** الجوال مائل أكثر مما تحتمله البوصلة. */
  tilted: boolean;
  /** دقة iOS إن وُجدت. */
  accuracy: number | null;
};

/** أقصى ميل (درجات) تبقى معه قراءة البوصلة الأفقية موثوقة. */
export const MAX_TILT = 40;

/**
 * يستخرج اتجاه أعلى الجوال من حدث توجيه. يعيد `null` إن لم يكن الحدث مطلقاً
 * (أي لا يعرف الشمال) — لا نخمّن أبداً.
 * `screenAngle`: زاوية دوران الشاشة (0/90/180/270) من `screen.orientation`.
 */
export function readHeading(e: RawOrientation, screenAngle = 0): HeadingReading | null {
  const tilted =
    (e.beta != null && Math.abs(e.beta) > MAX_TILT) ||
    (e.gamma != null && Math.abs(e.gamma) > MAX_TILT);

  if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) {
    /* iOS يعوّض دوران الشاشة بنفسه. */
    return {
      magnetic: norm360(e.webkitCompassHeading),
      tilted,
      accuracy: typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : null,
    };
  }
  if (!e.absolute || e.alpha == null) return null;
  /* alpha تزداد عكس عقارب الساعة؛ والشاشة المدوّرة تغيّر «أعلى الجوال». */
  return { magnetic: norm360(360 - e.alpha + screenAngle), tilted, accuracy: null };
}

/**
 * مُنعِّم دائري: متوسط أسّي على الجيب وجيب التمام (لا على الدرجات مباشرةً،
 * وإلا كان متوسط ٣٥٩° و١° هو ١٨٠°).
 */
export function createSmoother(factor = 0.2) {
  let s = 0;
  let c = 0;
  let ready = false;
  return {
    push(deg: number): number {
      const r = (deg * Math.PI) / 180;
      if (!ready) {
        s = Math.sin(r);
        c = Math.cos(r);
        ready = true;
      } else {
        s += factor * (Math.sin(r) - s);
        c += factor * (Math.cos(r) - c);
      }
      return norm360((Math.atan2(s, c) * 180) / Math.PI);
    },
    reset() {
      ready = false;
    },
  };
}

/**
 * اضطراب القراءات (انحراف معياري دائري بالدرجات). قيمة كبيرة والجوال ساكن
 * تعني تشويشاً مغناطيسياً أو بوصلة غير معايرة.
 */
export function circularSpread(samples: number[]): number {
  if (samples.length < 2) return 0;
  let s = 0;
  let c = 0;
  for (const d of samples) {
    s += Math.sin((d * Math.PI) / 180);
    c += Math.cos((d * Math.PI) / 180);
  }
  const R = Math.min(1, Math.sqrt(s * s + c * c) / samples.length);
  return (Math.sqrt(-2 * Math.log(Math.max(R, 1e-12))) * 180) / Math.PI;
}

/** سماحية المحاذاة: ضمن ±٥° يُعدّ المصلّي متجهاً إلى القبلة. */
export const ALIGN_TOLERANCE = 5;

export type Guidance = { kind: "aligned" } | { kind: "turn"; dir: "right" | "left"; by: number };

/** كم يستدير المستخدم وإلى أي جهة ليواجه القبلة. */
export function guidance(heading: number, qibla: number): Guidance {
  const d = angleDelta(heading, qibla);
  if (Math.abs(d) <= ALIGN_TOLERANCE) return { kind: "aligned" };
  return { kind: "turn", dir: d > 0 ? "right" : "left", by: Math.round(Math.abs(d)) };
}

const CARDINALS = [
  "الشمال",
  "الشمال الشرقي",
  "الشرق",
  "الجنوب الشرقي",
  "الجنوب",
  "الجنوب الغربي",
  "الغرب",
  "الشمال الغربي",
];

/** اسم الجهة لزاوية (ثماني الجهات). */
export function cardinalAr(deg: number): string {
  return CARDINALS[Math.round(norm360(deg) / 45) % 8];
}

/** «١٥٫٣٥° شمالاً» / «٤٤٫٢١° شرقاً» — بلا حروف لاتينية ولا إشارة ثابتة خاطئة. */
export function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "شمالاً" : "جنوباً"}`;
}
export function formatLongitude(lng: number): string {
  return `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? "شرقاً" : "غرباً"}`;
}
