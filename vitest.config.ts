import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

/* اختبارات الوحدة لمنطق منار الأساسي (بلا واجهة).
 * المنطقة الزمنية مثبّتة حتى تكون حسابات «اليوم المحلي» حتمية على أي جهاز وفي CI.
 * يمكن تجربة منطقة أخرى: `MANAR_TEST_TZ=America/New_York npm test`. */
process.env.TZ = process.env.MANAR_TEST_TZ ?? "Asia/Aden";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
  },
});
