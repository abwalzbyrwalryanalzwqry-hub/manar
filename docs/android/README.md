# Manar — Android (Capacitor) build guide

> **Status note (superseded in part).** A real signed build has since been produced
> from the `android-release-prep` branch with JDK 21 + Android SDK 35. For the
> current, verified instructions, outputs, signing fingerprints and remaining
> risks, read **[`README.ar.md`](./README.ar.md)** (Arabic). Sections 2, 3, 7 and 9
> below describe the original pre-build plan and are kept for history.

Manar is a web app wrapped by **Capacitor** — the single native architecture for
this project. Do not introduce Cordova, Bubblewrap/TWA or a hand-written WebView
shell alongside it.

Lovable's sandbox cannot compile or sign an Android package. Everything up to the
Gradle step is configured here; the remaining step must run on a machine with the
Android SDK + JDK 17.

---

## 1. What is already offline-first in the web app

| Content                                                    | Location                                   | Network needed                     |
| ---------------------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| Quran Uthmani text, 114 surahs / 604 pages                 | `public/data/quran/uthmani/*.json`         | no                                 |
| Hisn al-Muslim adhkar (132 chapters)                       | `public/data/azkar/hisn-al-muslim.json`    | no                                 |
| Wird (morning/evening)                                     | bundled in source                          | no                                 |
| Adhan / Iqama / Fajr recordings (20 files, 16 MB mono MP3) | `public/audio/library/*.mp3`               | no                                 |
| Quran fonts (Amiri Quran, Scheherazade New, Noto Naskh)    | `public/fonts/*.woff2` + `quran-fonts.css` | no                                 |
| Prayer times                                               | computed locally with `adhan`              | no                                 |
| City lookup / reverse geocoding                            | `src/lib/cities.ts` (`nearestCity`)        | no (online only refines the label) |
| Settings, counters, reading position, wird progress        | `localStorage`                             | no                                 |
| Cloud sync + account                                       | Lovable Cloud                              | yes — optional only                |

## 2. Static client build for the native shell

```bash
npm ci
npm run build         # emits the client bundle
npx cap sync android   # copies web assets + plugins into android/
```

If `dist/client` is not produced by the current SSR-oriented build target,
build the client-only output (`vite build --app client`) or point `webDir`
in `capacitor.config.ts` at the emitted client directory before `cap sync`.

## 3. Native plugins to install (matching the required capabilities)

```bash
npm install @capacitor/core @capacitor/android @capacitor/cli \
        @capacitor/local-notifications @capacitor/app @capacitor/device \
        @capacitor/preferences @capacitor/splash-screen @capacitor/status-bar \
        @capacitor/geolocation @capacitor-community/media-session \
        @capawesome/capacitor-background-task
```

| Capability                            | Plugin / native piece                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Scheduled Adhan / Iqama notifications | `@capacitor/local-notifications` (exact alarms)                                    |
| Reboot rescheduling                   | `BOOT_COMPLETED` receiver re-schedules the next 7 days                             |
| Notification actions (إيقاف الأذان)   | Local-notification action type `STOP_ADHAN`                                        |
| Background audio + audio focus        | foreground service + `AudioManager` focus request                                  |
| Media session (lock-screen controls)  | `@capacitor-community/media-session`                                               |
| Local persistence                     | `localStorage` (WebView) + `@capacitor/preferences` for native-side schedule state |
| Location                              | `@capacitor/geolocation`                                                           |

Keep the boundary clean: the web UI writes settings, the native scheduler reads
them and owns alarms/audio.

## 4. `android/app/src/main/AndroidManifest.xml` — permissions to declare

Only what Manar actually needs:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<!-- INTERNET is only for optional cloud sync -->
<uses-permission android:name="android.permission.INTERNET" />
```

Not requested: storage, camera, microphone, contacts, background location,
`READ_PHONE_STATE`.

## 5. App identity

| Item                            | Value                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| applicationId                   | `app.manar.islamic`                                                 |
| App name                        | `منار` (`android:label`)                                            |
| Launcher icon                   | adaptive icon, emerald background `#0B1F1A`, gold minaret `#C9A227` |
| Splash                          | `#0B1F1A` with the Manar mark, `launchAutoHide: false`              |
| minSdk / targetSdk / compileSdk | 24 / 35 / 35                                                        |
| RTL                             | `android:supportsRtl="true"`, default locale `ar`                   |
| Theme                           | `DayNight` so system light/dark matches the web UI                  |

## 6. Release configuration (`android/app/build.gradle`)

```gradle
android {
  defaultConfig { applicationId "app.manar.islamic"; minSdkVersion 24; targetSdkVersion 35;
                  versionCode 1; versionName "1.0.0"; resConfigs "ar", "en" }
  signingConfigs { release { storeFile file(System.getenv("MANAR_KEYSTORE") ?: "manar.keystore")
                             storePassword System.getenv("MANAR_STORE_PASSWORD")
                             keyAlias System.getenv("MANAR_KEY_ALIAS")
                             keyPassword System.getenv("MANAR_KEY_PASSWORD") } }
  buildTypes { release { minifyEnabled true; shrinkResources true
                         proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
                         signingConfig signingConfigs.release } }
  packagingOptions { jniLibs { useLegacyPackaging false } }
}
```

## 7. The exact remaining step (must run outside Lovable)

```bash
npx cap add android
npx cap sync android
keytool -genkey -v -keystore manar.keystore -alias manar -keyalg RSA -keysize 2048 -validity 10000
cd android && ./gradlew assembleRelease      # APK
# or ./gradlew bundleRelease                 # AAB for Play Store
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

A signed APK and AAB have now been built (see `README.ar.md`). Build artifacts are
still not committed to the repository — only the reproducible build steps are.

## 8. Airplane-mode checklist (run on the device after installing)

1. Launch → 2. Prayer Times → 3. Quran → 4. Surah reader → 5. Mushaf →
2. swipe several of the 604 pages → 7. change reading settings → 8. Adhkar →
3. search a dhikr → 10. open a chapter → 11. counter → 12. move between adhkar →
4. play a local Adhan → 14. play a local Iqama → 15. fire a scheduled
   notification → 16. stop audio from the notification → 17. lock screen →
5. reopen → 19. settings preserved → 20. reading position preserved →
6. reboot the device → 22. notifications rescheduled.

## 9. Size notes

- Adhan library re-encoded to mono 32 kHz ~56 kbps MP3: **43 MB → 16 MB**, no
  recording removed.
- Duplicate `.m4a` originals are no longer shipped; MP3 is the single format.
- Quran text is untouched and complete (114 surahs).
- Fonts: only Arabic + Latin subsets are bundled (479 KB total).

---

## 10. Native notification scheduling (already wired in the web layer)

`src/lib/native-notifications.ts` talks to `LocalNotifications` through the
Capacitor runtime bridge (`window.Capacitor.Plugins`), so the web build carries
no extra dependency and every call is a no-op in a browser.

- `syncNativePrayerSchedule(location, calc)` recomputes prayer times locally
  (no network) and schedules the next **7 days** of reminders, Adhan and Iqama.
- Called from `AdhanProvider` on start, on location/settings change and on
  `resume` — so a reboot is covered by the next launch in addition to the
  `BOOT_COMPLETED` receiver.
- Adhan notifications use `actionTypeId: "STOP_ADHAN"` → the action
  (`إيقاف الأذان`) calls `stopAdhan()`.
- When running inside the native shell the in-app JS player is skipped for
  Adhan/Iqama so the OS sound is not doubled.
- Notification channels expected on the native side: `manar_adhan`,
  `manar_iqama`, `manar_reminders`, `manar_silent`.
- Sounds are referenced by bare file name; `scripts/sync-android-raw-audio.mjs`
  copies `public/audio/library/*.mp3` into `android/app/src/main/res/raw/` during
  `npm run build:android`.
- `res/raw/keep.xml` (`tools:keep="@raw/*"`) is **required**: the raw sounds are
  resolved at runtime via `getIdentifier()`, so `shrinkResources` strips all of
  them from the release APK without it.
