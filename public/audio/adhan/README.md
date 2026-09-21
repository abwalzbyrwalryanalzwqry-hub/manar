# Adhan Audio Assets

Place real Adhan audio files here. Supported formats: **MP3**, **WAV**, **OGG**.

Each reciter ships in three lengths: `full`, `short`, and `takbir`.

## Required filenames

| Reciter         | Full                | Short                | Takbir                |
| --------------- | ------------------- | -------------------- | --------------------- |
| مكة المكرمة     | `makkah-full.mp3`   | `makkah-short.mp3`   | `makkah-takbir.mp3`   |
| المدينة المنورة | `madinah-full.mp3`  | `madinah-short.mp3`  | `madinah-takbir.mp3`  |
| المسجد الأقصى   | `aqsa-full.mp3`     | `aqsa-short.mp3`     | `aqsa-takbir.mp3`     |
| خليجي           | `gulf-full.mp3`     | `gulf-short.mp3`     | `gulf-takbir.mp3`     |
| مصري            | `egyptian-full.mp3` | `egyptian-short.mp3` | `egyptian-takbir.mp3` |
| تركي            | `turkish-full.mp3`  | `turkish-short.mp3`  | `turkish-takbir.mp3`  |
| حجازي           | `hijazi-full.mp3`   | `hijazi-short.mp3`   | `hijazi-takbir.mp3`   |
| يمني            | `yemeni-full.mp3`   | `yemeni-short.mp3`   | `yemeni-takbir.mp3`   |

Files are served from `/audio/adhan/<filename>`. Any missing file shows
a clear Arabic message; no synthetic fallback is ever played.
