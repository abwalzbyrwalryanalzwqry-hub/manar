import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // مولَّد آلياً من GeoNames — سطر واحد ضخم، لا معنى لتدقيق تنسيقه
  { ignores: ["dist", ".output", ".vinxi", "src/lib/arab-places.ts", "src/lib/world-cities.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // خطّافات ودوال مساعدة تُصدَّر عمداً بجانب المزوّد/المكوّن.
          allowExportNames: ["useAuth", "requestNotificationPermission", "icons", "prayerIcon"],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // مكوّنات shadcn/ui المولّدة تصدّر متغيّرات الأنماط (buttonVariants…) بجانب المكوّن.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  eslintPluginPrettier,
);
