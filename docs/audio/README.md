# MANAR AUDIO PACKAGE

## What this package contains

This package organizes the user-provided Manar adhan audio files for integration with the EXISTING audio engine.

## Important

- The existing Manar Audio Engine must NOT be replaced or rebuilt.
- Audio files are preserved in their original formats.
- Exact byte-for-byte duplicates were not copied twice; they are documented in `metadata/adhan-library.json`.
- The package does NOT assert ownership, commercial rights, or redistribution rights for any recording.
- Every file must have its license/permission independently verified before Google Play/App Store release.

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

- A verified iqamah library
- Verified license documents/attribution records
- Any claim that a named reciter/location is legally confirmed beyond the supplied filename
