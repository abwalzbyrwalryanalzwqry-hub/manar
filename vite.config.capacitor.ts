// Manar — dedicated build config for the Capacitor (Android/iOS) shell.
// Produces a fully static SPA in dist/client (with index.html) that runs
// inside the native WebView with zero server involvement.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    spa: { enabled: true },
    prerender: { enabled: true },
  },
});
