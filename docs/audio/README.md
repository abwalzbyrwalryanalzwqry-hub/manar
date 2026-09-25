# MANAR AUDIO PACKAGE

## What this package contains

This package organizes the user-provided Manar adhan audio files for integration with the EXISTING audio engine.

## Important

- The existing Manar Audio Engine must NOT be replaced or rebuilt.
- Audio files are preserved in their original formats.
- Exact byte-for-byte duplicates were not copied twice; they are documented in `metadata/adhan-library.json`.
- Rights for every recording (adhan and iqamah) have been verified and documented by the project owner (2026-09-24) — status `VERIFIED` in `adhan-library.json` and `licenses.json`. The voice reminders (azkar / wird) and the prayer-approach announcements were recorded by the project owner personally and are the owner's property (2026-09-25). All recordings are cleared for use and publication inside Manar; `tests/unit/audio-rights.test.ts` enforces that every bundled file is documented.

## Integration

Copy the `public/` directory into the project root, preserving paths.

Then use `LOVABLE_PROMPT.md` in Lovable. The prompt is designed to connect the organized files to the existing audio library and engine without rebuilding the engine.

## Current scope

- Full adhan recordings
- Short adhan recordings
- Fajr second adhan
- Takbeer / prayer-call segments
- Hayya 'ala al-salah segment
- Salat khayr min al-nawm segments

## Not included yet

- The iqamah library now lives separately in `public/audio/iqamah/` (see `iqamah.md`); its rights are verified as well.
- Any claim that a named reciter/location is legally confirmed beyond the supplied filename
