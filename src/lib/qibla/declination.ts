/* منار — الانحراف المغناطيسي (الفرق بين الشمال المغناطيسي والشمال الحقيقي).
 *
 * البوصلة في الجوال تشير إلى الشمال المغناطيسي، واتجاه القبلة محسوب من
 * الشمال الحقيقي. الفرق يبلغ درجتين أو ثلاثاً في اليمن والخليج، ويتجاوز
 * عشر درجات في أماكن أخرى — خطأ يحرف المصلّي عن الكعبة بمئات الكيلومترات.
 *
 * التنفيذ هو الحساب القياسي للنموذج المغناطيسي العالمي (WMM2025) بتوافقيات
 * كروية حتى الرتبة ١٢، على سطح الأرض (ارتفاع ٠)، بلا إنترنت ولا مكتبات.
 */

import { WMM_EPOCH, WMM_G, WMM_G_DOT, WMM_H, WMM_H_DOT, WMM_N_MAX } from "./wmm2025";

const A = 6378.137; // نصف القطر الاستوائي (WGS84) بالكيلومتر
const B = 6356.7523142; // نصف القطر القطبي
const RE = 6371.2; // نصف القطر المرجعي للنموذج
const DEG = Math.PI / 180;

/** السنة العشرية لتاريخ: ٢٠٢٦٫٧٤ مثلاً. */
export function decimalYear(date: Date): number {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (end - start);
}

/* معاملات شميت شبه المعيارية تُحسب مرة واحدة. */
const idx = (n: number, m: number) => (n * (n + 1)) / 2 + m;
const SCHMIDT: number[] = (() => {
  const s: number[] = [];
  s[idx(0, 0)] = 1;
  for (let n = 1; n <= WMM_N_MAX; n += 1) {
    s[idx(n, 0)] = (s[idx(n - 1, 0)] * (2 * n - 1)) / n;
    for (let m = 1; m <= n; m += 1) {
      s[idx(n, m)] = s[idx(n, m - 1)] * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
    }
  }
  return s;
})();

/**
 * الانحراف المغناطيسي بالدرجات عند نقطة وتاريخ: موجب = الشمال المغناطيسي
 * شرق الحقيقي. الاتجاه الحقيقي = الاتجاه المغناطيسي + الانحراف.
 */
export function magneticDeclination(lat: number, lng: number, date: Date = new Date()): number {
  const t = decimalYear(date) - WMM_EPOCH;

  /* من إحداثيات جغرافية (WGS84) إلى كروية مركزية. */
  const phi = lat * DEG;
  const lambda = lng * DEG;
  const e2 = 1 - (B * B) / (A * A);
  const sinPhi = Math.sin(phi);
  const N = A / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const p = N * Math.cos(phi);
  const z = N * (1 - e2) * sinPhi;
  const r = Math.sqrt(p * p + z * z);
  const phiC = Math.asin(z / r);

  const cosT = Math.sin(phiC); // جيب تمام زاوية التمام (θ = ٩٠° − العرض)
  const sinT = Math.max(Math.cos(phiC), 1e-10); // تجنّب القسمة على صفر عند القطبين

  /* دوال ليجندر المرتبطة (معيار غاوس) ومشتقاتها بالنسبة إلى θ. */
  const P: number[] = [];
  const dP: number[] = [];
  P[idx(0, 0)] = 1;
  dP[idx(0, 0)] = 0;
  for (let n = 1; n <= WMM_N_MAX; n += 1) {
    for (let m = 0; m <= n; m += 1) {
      const i = idx(n, m);
      if (n === m) {
        const j = idx(n - 1, m - 1);
        P[i] = sinT * P[j];
        dP[i] = sinT * dP[j] + cosT * P[j];
      } else {
        const j = idx(n - 1, m);
        const k = n > 1 && m <= n - 2 ? ((n - 1) ** 2 - m * m) / ((2 * n - 1) * (2 * n - 3)) : 0;
        const pm2 = n >= 2 && m <= n - 2 ? P[idx(n - 2, m)] : 0;
        const dpm2 = n >= 2 && m <= n - 2 ? dP[idx(n - 2, m)] : 0;
        P[i] = cosT * P[j] - k * pm2;
        dP[i] = cosT * dP[j] - sinT * P[j] - k * dpm2;
      }
    }
  }

  let Br = 0;
  let Bt = 0;
  let Bp = 0;
  for (let n = 1; n <= WMM_N_MAX; n += 1) {
    const ar = (RE / r) ** (n + 2);
    for (let m = 0; m <= n; m += 1) {
      const i = idx(n, m);
      const g = (WMM_G[i] + t * WMM_G_DOT[i]) * SCHMIDT[i];
      const h = (WMM_H[i] + t * WMM_H_DOT[i]) * SCHMIDT[i];
      const cm = Math.cos(m * lambda);
      const sm = Math.sin(m * lambda);
      Br += (n + 1) * ar * (g * cm + h * sm) * P[i];
      Bt -= ar * (g * cm + h * sm) * dP[i];
      Bp += ar * m * (g * sm - h * cm) * P[i];
    }
  }
  Bp /= sinT;

  /* المركبات في الإطار الكروي ثم تدويرها إلى الإطار الجغرافي. */
  const Xc = -Bt;
  const Yc = Bp;
  const Zc = -Br;
  const psi = phiC - phi;
  const X = Xc * Math.cos(psi) - Zc * Math.sin(psi);
  const Y = Yc;
  return Math.atan2(Y, X) / DEG;
}
