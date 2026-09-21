/**
 * منار — تذكّر أن المستخدم أتمّ شرائح التعريف.
 *
 * شاشة البداية كانت تُحوّل إلى `/onboarding` في كل إقلاع، فيرى المستخدم
 * الشرائح ثم شاشة الدخول كلّما فتح التطبيق. العلامة هنا هي ما يفرّق بين أول
 * تشغيل وما بعده، وتُكتب في `localStorage` فتصمد بعد إغلاق التطبيق وبعد
 * إعادة تشغيل الهاتف.
 *
 * تُكتب في موضعين: عند تجاوز الشرائح أو إتمامها (`/onboarding`)، وعند أول
 * دخول ناجح أو دخول كزائر (`/login`, `/register`) — حتى لا يُحاصر المستخدم
 * في الشرائح إن وصل إلى الدخول بمسار آخر.
 */

const KEY = "manar.onboarded.v1";

/** هل أتمّ المستخدم التعريف بالتطبيق من قبل؟ */
export function hasOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    /* التخزين قد يكون محجوباً — نعامله كأول تشغيل، وهو أسلم من الانهيار. */
    return false;
  }
}

/** يُسجّل أن التعريف انتهى. يُستدعى أكثر من مرّة بلا ضرر. */
export function markOnboarded(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* لا شيء نفعله إن رُفض التخزين؛ يبقى السلوك كأول تشغيل. */
  }
}
