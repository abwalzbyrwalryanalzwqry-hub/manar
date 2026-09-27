import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* هذه الشاشات تعرض أوقاتاً وأياماً بتوقيت الجهاز. الخادم لا يعرف منطقة المستخدم
 * الزمنية، فإن رسمها أعطى نصاً مختلفاً عن المتصفح وفشل الـHydration (وُجد ذلك في
 * تدقيق «المزيد»). المطلوب أن تبقى كلها بلا رسم على الخادم. */
const TIME_ROUTES = [
  "_tabs.home.tsx",
  "_tabs.prayer.tsx",
  "calendar.tsx",
  "iqama.tsx",
  "reminders.tsx",
  "widget.tsx",
  "quran.last-read.tsx",
];

describe("شاشات الوقت لا تُرسم على الخادم", () => {
  for (const file of TIME_ROUTES) {
    it(file, () => {
      const src = readFileSync(resolve(__dirname, "../../src/routes", file), "utf8");
      expect(src).toMatch(/createFileRoute\([^)]*\)\(\{[\s\S]{0,400}?\bssr:\s*false/);
    });
  }
});
