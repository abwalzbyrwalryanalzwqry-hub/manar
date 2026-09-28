/* منار — جدول أم القرى الاحتياطي (1300–1600هـ).
 *
 * مُولَّد آلياً بـ`scripts/build-hijri-table.mjs` من ICU 78.2 — لا تعدّله يدوياً.
 * يُستعمل فقط حين لا يدعم `Intl` تقويم أم القرى على الجهاز (انظر `hijri.ts`).
 */

/** ١ محرّم 1300هـ: أيام منذ ١٩٧٠-٠١-٠١ (UTC). */
export const UQ_FIRST_YEAR = 1300;
export const UQ_LAST_YEAR = 1600;
export const UQ_EPOCH_DAY = -31826;

/** بتٌّ لكل شهر من ١ محرّم 1300: ١ = ٣٠ يوماً، ٠ = ٢٩. */
export const UQ_MONTH_BITS =
  "VbUqN2krdsU2VauqVulJXakrtaU6S2upLtUqbaW1Ulfyim7RVlqrtJbakluyS7apWpNt1FXaSl2pNlWX9JJu1JZqNdUlvaSb" +
  "tJO2KlulrdSl2pJtqk7pKm3FrtSmalXVSj2pK7WlOlVrqS7VKV2lrdRW6kpu0S7aqqqV2pJbskt2yVZVq7JNukpbqS3VpdqS" +
  "bdKO2lKtpbqkl3STtlKXaS3VlbySW7JN1Sldpa3UldpUrao60ku8iVupLdVaakttyS3ZpmqVrtJWalO1qtqUndSVulJbqlXV" +
  "muqSbtJV2kptpXayTdpKbaW1VJf0km7SVmo1taa6kluyi7apWqWttJXaUqupNmUndSWv1JZqVdUqvaSbdJW2UlupLdWl2pSt" +
  "slbpKm7JLtmqalXWSl3RK7bFOlVrsk3WKV2lrdSW6opu0U7aSq2m2pJbcou20VZlq7SVulJbqS3VpuyUbtSV2lStqtqkm3ST" +
  "tlSXai3VpbqUq7JV2SpdxS3ZJVtVtUpbqSt6RTdZq2pN1ildpau0ldpKXdEt2klbqdVSW3KLdtFWaquslrpSW7ErtqXalGvU" +
  "jdpSnapVVZd0E6/klmpVtaa6lAs=";
