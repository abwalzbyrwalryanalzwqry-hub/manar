/**
 * Manar — copies the bundled Adhan / Iqama recordings into android/res/raw.
 *
 * Android resource names may only contain [a-z0-9_], so `makkah-mulla-full-1.mp3`
 * becomes `makkah_mulla_full_1.mp3`. The same transform lives in
 * `src/lib/native-notifications.ts` (`rawResourceName`) so the web layer and the
 * native side always agree on the name.
 *
 * The files stay in `public/audio/library` as well: the in-app player uses those
 * for previews inside the WebView, while the native service needs res/raw to be
 * able to play while the app is closed.
 */
import { readdirSync, mkdirSync, copyFileSync, rmSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "public/audio/library");
const target = resolve(root, "android/app/src/main/res/raw");

export function rawResourceName(fileName) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a$1");
}

if (!existsSync(source)) {
  console.error(`[manar] missing ${source}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

let bytes = 0;
const copied = [];
for (const file of readdirSync(source)) {
  if (!file.toLowerCase().endsWith(".mp3")) continue;
  const name = `${rawResourceName(file)}.mp3`;
  copyFileSync(resolve(source, file), resolve(target, name));
  bytes += statSync(resolve(source, file)).size;
  copied.push(`${file} -> raw/${name}`);
}

console.log(`[manar] copied ${copied.length} recordings into res/raw (${(bytes / 1048576).toFixed(1)} MB)`);
for (const line of copied) console.log(`         ${line}`);
