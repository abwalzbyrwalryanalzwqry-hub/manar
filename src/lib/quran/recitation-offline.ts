// ============================================================
// Manar — Quran Module
// Offline recitations: download a surah once, play it forever
// ------------------------------------------------------------
// Files are stored inside the app's private data directory via
// Capacitor Filesystem, so nothing lands in the user's gallery
// and everything is removed when the app is uninstalled.
// Downloading is native-only; on the web the screen offers
// streaming instead.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ayahAudioUrl, ayahFileName, type Reciter } from "./recitations";

const KEY = "manar.quran.recitation.downloads.v1";
const EVENT = "manar:recitation-downloads";
const ROOT = "manar-recitations";

export interface DownloadedSurah {
  /** Reciter folder — the audio identity of the files. */
  folder: string;
  surah: number;
  ayahs: number;
  /** Total bytes written. */
  bytes: number;
  /** Native directory URI, ready for `convertFileSrc`. */
  dirUri: string;
  at: number;
}

type Manifest = Record<string, DownloadedSurah>;

export function downloadKey(folder: string, surah: number): string {
  return `${folder}:${surah}`;
}

export function offlineSupported(): boolean {
  return Capacitor.isNativePlatform();
}

function readManifest(): Manifest {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Manifest) : {};
  } catch {
    return {};
  }
}

function writeManifest(m: Manifest) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function listDownloads(): DownloadedSurah[] {
  return Object.values(readManifest()).sort((a, b) => b.at - a.at);
}

export function isDownloaded(folder: string, surah: number): boolean {
  return !!readManifest()[downloadKey(folder, surah)];
}

export function getDownload(folder: string, surah: number): DownloadedSurah | undefined {
  return readManifest()[downloadKey(folder, surah)];
}

/** Local playable source for one ayah, or null when it is not downloaded. */
export function localAyahSrc(folder: string, surah: number, ayah: number): string | null {
  const entry = getDownload(folder, surah);
  if (!entry || ayah > entry.ayahs) return null;
  return Capacitor.convertFileSrc(`${entry.dirUri}/${ayahFileName(surah, ayah)}`);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف الصوتي"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const at = result.indexOf(",");
      resolve(at >= 0 ? result.slice(at + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export interface DownloadHandle {
  cancel: () => void;
}

export interface DownloadCallbacks {
  onProgress?: (done: number, total: number, bytes: number) => void;
  onDone?: (entry: DownloadedSurah) => void;
  onError?: (error: Error) => void;
}

/**
 * Downloads every ayah of a surah for one reciter.
 * Resumable: files already on disk are skipped on a second run.
 */
export function downloadSurah(
  reciter: Reciter,
  surah: number,
  ayahCount: number,
  cb: DownloadCallbacks = {},
): DownloadHandle {
  let cancelled = false;

  void (async () => {
    try {
      if (!offlineSupported()) {
        throw new Error("التحميل للاستماع بدون إنترنت متاح في تطبيق الأندرويد فقط");
      }
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const dir = `${ROOT}/${reciter.folder}/${String(surah).padStart(3, "0")}`;

      await Filesystem.mkdir({ path: dir, directory: Directory.Data, recursive: true }).catch(
        () => {
          /* already exists */
        },
      );

      let bytes = getDownload(reciter.folder, surah)?.bytes ?? 0;
      for (let ayah = 1; ayah <= ayahCount; ayah++) {
        if (cancelled) return;
        const name = ayahFileName(surah, ayah);
        const path = `${dir}/${name}`;

        const existing = await Filesystem.stat({ path, directory: Directory.Data }).catch(
          () => null,
        );
        if (existing && existing.size > 1024) {
          cb.onProgress?.(ayah, ayahCount, bytes);
          continue;
        }

        const res = await fetch(ayahAudioUrl(reciter, surah, ayah));
        if (!res.ok) throw new Error(`تعذّر تحميل الآية ${ayah} (${res.status})`);
        const blob = await res.blob();
        const data = await blobToBase64(blob);
        await Filesystem.writeFile({ path, directory: Directory.Data, data, recursive: true });
        bytes += blob.size;
        cb.onProgress?.(ayah, ayahCount, bytes);
      }

      if (cancelled) return;
      const { uri } = await Filesystem.getUri({ path: dir, directory: Directory.Data });
      const entry: DownloadedSurah = {
        folder: reciter.folder,
        surah,
        ayahs: ayahCount,
        bytes,
        dirUri: uri,
        at: Date.now(),
      };
      writeManifest({ ...readManifest(), [downloadKey(reciter.folder, surah)]: entry });
      cb.onDone?.(entry);
    } catch (error) {
      if (!cancelled) {
        cb.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
    },
  };
}

/** Deletes a downloaded surah and its manifest entry. */
export async function deleteDownload(folder: string, surah: number): Promise<void> {
  const key = downloadKey(folder, surah);
  const manifest = readManifest();
  const entry = manifest[key];
  if (offlineSupported()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      await Filesystem.rmdir({
        path: `${ROOT}/${folder}/${String(surah).padStart(3, "0")}`,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      /* directory may already be gone */
    }
  }
  if (entry) {
    const next = { ...manifest };
    delete next[key];
    writeManifest(next);
  }
}

/** Deletes every downloaded recitation. */
export async function deleteAllDownloads(): Promise<void> {
  const all = listDownloads();
  for (const d of all) await deleteDownload(d.folder, d.surah);
  writeManifest({});
}

export function formatBytesAr(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} ك.ب`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} م.ب`;
}

/** Reactive list of downloaded surahs. */
export function useDownloads() {
  const [items, setItems] = useState<DownloadedSurah[]>([]);

  useEffect(() => {
    const sync = () => setItems(listDownloads());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const has = useCallback(
    (folder: string, surah: number) => items.some((d) => d.folder === folder && d.surah === surah),
    [items],
  );

  const totalBytes = items.reduce((n, d) => n + d.bytes, 0);

  return { items, has, totalBytes, remove: deleteDownload, clear: deleteAllDownloads } as const;
}
