/**
 * Manar — prepares dist/client so it is a valid Capacitor `webDir`.
 *
 * The TanStack Start SPA build emits `_shell.html` (the client shell) plus one
 * prerendered directory per route. Capacitor's WebView loads `index.html` from
 * the root of `webDir`, so the shell is copied there and the client router
 * takes over from the first paint. Without this step the app opens on a blank
 * white screen.
 */
import { copyFileSync, existsSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientDir = resolve(root, "dist/client");
const shell = resolve(clientDir, "_shell.html");
const index = resolve(clientDir, "index.html");

if (!existsSync(shell)) {
  console.error(
    "[manar] dist/client/_shell.html is missing — run `vite build --config vite.config.capacitor.ts` first.",
  );
  process.exit(1);
}

copyFileSync(shell, index);

// حارس الإقلاع: يُحقن كأول سكربت داخل <head> حتى يعمل قبل حزمة التطبيق (وحتى لو
// فشلت). بدونه كان أي خطأ في الترطيب يُبقي شاشة البداية الخضراء ظاهرة للأبد،
// لأن إخفاءها كان يحدث داخل شجرة React فقط.
const guardSrc = readFileSync(resolve(root, "scripts/android-boot-guard.js"), "utf8");
{
  const html = readFileSync(index, "utf8");
  if (!html.includes("__MANAR_BOOT__")) {
    const tag = `<script>${guardSrc}</script>`;
    const patched = html.includes("<head>")
      ? html.replace("<head>", `<head>${tag}`)
      : `${tag}${html}`;
    writeFileSync(index, patched);
    console.log("[manar] injected android-boot-guard.js into index.html");
  }
}

// The native shell never talks to a server: drop the SSR bundle so it cannot be
// shipped inside the APK by accident.
rmSync(resolve(root, "dist/server"), { recursive: true, force: true });
rmSync(resolve(clientDir, "_headers"), { force: true });

// Capacitor serves from https://localhost — make sure nothing points at a host.
const html = readFileSync(index, "utf8");
if (/https?:\/\/(?!localhost)/.test(html.replace(/https?:\/\/www\.w3\.org/g, ""))) {
  console.warn("[manar] warning: index.html references an external origin.");
}
writeFileSync(index, html);

console.log("[manar] dist/client/index.html ready for `cap sync android`.");
