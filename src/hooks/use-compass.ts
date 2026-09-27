/* منار — بوصلة الجهاز: اتجاه حقيقي (من الشمال الجغرافي) أو لا شيء.
 *
 * الحالات:
 *   starting          ننتظر أول قراءة.
 *   needs-permission  iOS 13+ يشترط لمسة من المستخدم قبل قراءة الحسّاس.
 *   active            قراءة مطلقة مصحّحة بالانحراف المغناطيسي.
 *   unavailable       لا قراءة مطلقة خلال ثوانٍ (حاسوب، أو حسّاس نسبي فقط).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSmoother, norm360, readHeading, type RawOrientation } from "@/lib/qibla/compass";

export type CompassStatus = "starting" | "needs-permission" | "active" | "unavailable";

export type CompassState = {
  status: CompassStatus;
  /** اتجاه أعلى الجوال من الشمال الحقيقي (منعَّم)، أو null. */
  heading: number | null;
  tilted: boolean;
  /** القراءات مضطربة: تشويش مغناطيسي أو بوصلة تحتاج معايرة. */
  needsCalibration: boolean;
  /** لم تصل إلا قراءات نسبية (لا تعرف الشمال). */
  relativeOnly: boolean;
  requestPermission: () => Promise<void>;
};

/** مهلة انتظار أول قراءة مطلقة قبل إعلان «غير متاحة». */
const FIRST_READING_TIMEOUT_MS = 3000;
/** متوسط الاضطراب (درجات) الذي نعدّه تشويشاً. */
const JITTER_LIMIT = 12;
/** عدد القراءات في نافذة كشف الاضطراب. */
const JITTER_WINDOW = 24;

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

function screenAngle(): number {
  if (typeof window === "undefined") return 0;
  const a = window.screen?.orientation?.angle;
  if (typeof a === "number") return a;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

export function useCompass(declination: number): CompassState {
  const [status, setStatus] = useState<CompassStatus>("starting");
  const [heading, setHeading] = useState<number | null>(null);
  const [tilted, setTilted] = useState(false);
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [relativeOnly, setRelativeOnly] = useState(false);
  const [listening, setListening] = useState(false);
  const declRef = useRef(declination);
  declRef.current = declination;

  /* iOS: الإذن قبل أي استماع. غيره: نستمع فوراً. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const api = (window.DeviceOrientationEvent ?? {}) as unknown as PermissionApi;
    if (typeof api.requestPermission === "function") setStatus("needs-permission");
    else setListening(true);
  }, []);

  const requestPermission = useCallback(async () => {
    const api = (window.DeviceOrientationEvent ?? {}) as unknown as PermissionApi;
    try {
      const res = await api.requestPermission?.();
      if (res === "granted") {
        setStatus("starting");
        setListening(true);
      } else setStatus("unavailable");
    } catch {
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    if (!listening || typeof window === "undefined") return;
    const smoother = createSmoother(0.18);
    const jitter: number[] = [];
    let gotAbsolute = false;
    let sawRelative = false;
    let frame = 0;
    let latest: { h: number; tilted: boolean; calib: boolean } | null = null;

    const flush = () => {
      frame = 0;
      if (!latest) return;
      setHeading(latest.h);
      setTilted(latest.tilted);
      setNeedsCalibration(latest.calib);
    };

    const onEvent = (ev: Event) => {
      const e = ev as DeviceOrientationEvent & RawOrientation;
      const isAbsoluteEvent = ev.type === "deviceorientationabsolute";
      const r = readHeading(
        {
          alpha: e.alpha,
          beta: e.beta,
          gamma: e.gamma,
          absolute: isAbsoluteEvent || e.absolute === true,
          webkitCompassHeading: e.webkitCompassHeading,
          webkitCompassAccuracy: e.webkitCompassAccuracy,
        },
        screenAngle(),
      );
      if (!r) {
        if (!gotAbsolute && !sawRelative && e.alpha != null) {
          sawRelative = true;
          setRelativeOnly(true);
        }
        return;
      }
      if (!gotAbsolute) {
        gotAbsolute = true;
        setRelativeOnly(false);
        setStatus("active");
      }
      const trueHeading = norm360(r.magnetic + declRef.current);
      const smooth = smoother.push(trueHeading);
      /* الاضطراب: بُعد القراءة الخام عن المنعَّمة. الدوران الهادئ لا يرفعه كثيراً. */
      const off = Math.abs(((trueHeading - smooth + 540) % 360) - 180);
      jitter.push(off);
      if (jitter.length > JITTER_WINDOW) jitter.shift();
      const avg = jitter.reduce((a, b) => a + b, 0) / jitter.length;
      const iosBad = r.accuracy != null && (r.accuracy < 0 || r.accuracy > 25);
      latest = {
        h: smooth,
        tilted: r.tilted,
        calib: iosBad || (jitter.length === JITTER_WINDOW && avg > JITTER_LIMIT),
      };
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const hasAbsolute = "ondeviceorientationabsolute" in window;
    if (hasAbsolute) window.addEventListener("deviceorientationabsolute", onEvent, true);
    window.addEventListener("deviceorientation", onEvent, true);
    const timer = window.setTimeout(() => {
      if (!gotAbsolute) setStatus("unavailable");
    }, FIRST_READING_TIMEOUT_MS);

    return () => {
      if (hasAbsolute) window.removeEventListener("deviceorientationabsolute", onEvent, true);
      window.removeEventListener("deviceorientation", onEvent, true);
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [listening]);

  return { status, heading, tilted, needsCalibration, relativeOnly, requestPermission };
}
