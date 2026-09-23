import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/* اختبارات الوحدة لمنطق منار الأساسي (بلا واجهة).
 * المنطقة الزمنية مثبّتة حتى تكون حسابات «اليوم المحلي» حتمية على أي جهاز وفي CI.
 * يمكن تجربة منطقة أخرى: `MANAR_TEST_TZ=America/New_York npm test`. */
process.env.TZ = process.env.MANAR_TEST_TZ ?? "Asia/Aden";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
