import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SURAH_META } from "@/lib/quran/metadata";
import {
  ayahAudioUrl,
  needsBasmalaIntro,
  useRecitationPrefs,
  type Reciter,
} from "@/lib/quran/recitations";
import { localAyahSrc, localBasmalaSrc } from "@/lib/quran/recitation-offline";
import { toArabicDigits } from "@/lib/quran/format";

export interface PlayerTrack {
  surah: number;
  ayah: number;
}

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

function ayahCount(surah: number): number {
  return SURAH_META[Math.min(114, Math.max(1, surah)) - 1].ayatCount;
}

/** مقاطعة التشغيل بتحميل مصدر جديد ليست خطأً حقيقياً. */
function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function resolveSrc(
  reciter: Reciter,
  surah: number,
  ayah: number,
): { src: string; offline: boolean } {
  const local = localAyahSrc(reciter.folder, surah, ayah);
  if (local) return { src: local, offline: true };
  return { src: ayahAudioUrl(reciter, surah, ayah), offline: false };
}

/**
 * Verse-by-verse recitation player.
 * Plays from downloaded files when available and streams otherwise,
 * honouring the user's repeat / continuous / speed preferences.
 */
export function useRecitationPlayer() {
  const { prefs, reciter } = useRecitationPrefs();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repeatsRef = useRef(0);
  const trackRef = useRef<PlayerTrack | null>(null);
  /** مصدر الآية المنتظرة بعد انتهاء البسملة التمهيدية. */
  const pendingRef = useRef<{ src: string; offline: boolean } | null>(null);
  /** يزداد مع كل تحميل مصدر؛ الوعود القديمة تتجاهل نتيجتها. */
  const loadIdRef = useRef(0);

  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [position, setPosition] = useState({ current: 0, duration: 0 });

  // Keep a ref in sync so the `ended` handler always sees the live track.
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  /** ينتقل من البسملة إلى الآية المنتظرة. يُعيد false إن لم تكن هناك آية منتظرة. */
  const playPending = useCallback((): boolean => {
    const audio = audioRef.current;
    const pending = pendingRef.current;
    if (!audio || !pending) return false;
    pendingRef.current = null;
    const id = ++loadIdRef.current;
    setOffline(pending.offline);
    audio.src = pending.src;
    audio.playbackRate = prefs.rate;
    void audio.play().catch((e: unknown) => {
      if (id !== loadIdRef.current || isAbort(e)) return;
      setStatus("error");
      setError(
        pending.offline
          ? "تعذّر تشغيل الملف المحمّل — أعد تحميل السورة"
          : "تعذّر تشغيل التلاوة — تأكّد من اتصال الإنترنت أو حمّل السورة للاستماع بدون إنترنت",
      );
    });
    return true;
  }, [prefs.rate]);

  const startTrack = useCallback(
    (next: PlayerTrack) => {
      const audio = audioRef.current;
      if (!audio) return;
      const clampedAyah = Math.min(ayahCount(next.surah), Math.max(1, next.ayah));
      const target = { surah: next.surah, ayah: clampedAyah };
      const { src, offline: isOffline } = resolveSrc(reciter, target.surah, target.ayah);
      setTrack(target);
      trackRef.current = target;
      setOffline(isOffline);
      setError(null);
      setStatus("loading");
      // البسملة قبل الآية الأولى، ثم تُشغَّل الآية عند انتهائها.
      if (needsBasmalaIntro(target.surah, target.ayah)) {
        pendingRef.current = { src, offline: isOffline };
        audio.src = localBasmalaSrc(reciter.folder, target.surah) ?? ayahAudioUrl(reciter, 1, 1);
      } else {
        pendingRef.current = null;
        audio.src = src;
      }
      const id = ++loadIdRef.current;
      audio.playbackRate = prefs.rate;
      void audio.play().catch((e: unknown) => {
        if (id !== loadIdRef.current || isAbort(e)) return;
        if (pendingRef.current) {
          playPending();
          return;
        }
        setStatus("error");
        setError(
          isOffline
            ? "تعذّر تشغيل الملف المحمّل — أعد تحميل السورة"
            : "تعذّر تشغيل التلاوة — تأكّد من اتصال الإنترنت أو حمّل السورة للاستماع بدون إنترنت",
        );
      });
    },
    [playPending, prefs.rate, reciter],
  );

  const advance = useCallback(
    (direction: 1 | -1) => {
      const cur = trackRef.current;
      if (!cur) return;
      repeatsRef.current = 0;
      let surah = cur.surah;
      let ayah = cur.ayah + direction;
      if (ayah > ayahCount(surah)) {
        if (!prefs.continuous || surah >= 114) {
          setStatus("paused");
          return;
        }
        surah += 1;
        ayah = 1;
      }
      if (ayah < 1) {
        if (surah <= 1) {
          ayah = 1;
        } else {
          surah -= 1;
          ayah = ayahCount(surah);
        }
      }
      startTrack({ surah, ayah });
    },
    [prefs.continuous, startTrack],
  );

  const playPendingRef = useRef(playPending);
  useEffect(() => {
    playPendingRef.current = playPending;
  }, [playPending]);

  // One audio element for the whole session.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onPlaying = () => setStatus("playing");
    const onPause = () => setStatus((s) => (s === "playing" ? "paused" : s));
    const onWaiting = () => setStatus((s) => (s === "playing" ? "loading" : s));
    const onTime = () =>
      setPosition({ current: audio.currentTime || 0, duration: audio.duration || 0 });
    const onError = () => {
      // تعذّرت البسملة (مثلاً بدون إنترنت والفاتحة غير محمّلة): تُتجاوز إلى الآية.
      if (playPendingRef.current()) return;
      setStatus("error");
      setError("تعذّر تحميل الملف الصوتي — تحقّق من الاتصال أو اختر قارئًا آخر");
    };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  // `ended` depends on the current preferences, so it is bound separately.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const cur = trackRef.current;
      if (!cur) return;
      if (playPending()) return;
      if (prefs.repeat === "ayah" && repeatsRef.current < Math.max(1, prefs.repeatCount) - 1) {
        repeatsRef.current += 1;
        audio.currentTime = 0;
        void audio.play().catch(() => setStatus("paused"));
        return;
      }
      repeatsRef.current = 0;
      if (prefs.repeat === "range" && cur.ayah >= ayahCount(cur.surah)) {
        startTrack({ surah: cur.surah, ayah: 1 });
        return;
      }
      advance(1);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [advance, playPending, prefs.repeat, prefs.repeatCount, startTrack]);

  // Live playback-rate changes.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = prefs.rate;
  }, [prefs.rate]);

  // Switching reciter mid-ayah reloads the same position.
  useEffect(() => {
    const cur = trackRef.current;
    if (!cur) return;
    if (status === "playing" || status === "loading") startTrack(cur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciter.id]);

  // Lock-screen / notification metadata where the WebView supports it.
  useEffect(() => {
    const cur = track;
    const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
    if (!ms || !cur) return;
    try {
      ms.metadata = new MediaMetadata({
        title: `سورة ${SURAH_META[cur.surah - 1].nameAr} · الآية ${toArabicDigits(cur.ayah)}`,
        artist: reciter.nameAr,
        album: "منار — القرآن الكريم",
      });
      ms.setActionHandler("play", () => void audioRef.current?.play());
      ms.setActionHandler("pause", () => audioRef.current?.pause());
      ms.setActionHandler("nexttrack", () => advance(1));
      ms.setActionHandler("previoustrack", () => advance(-1));
    } catch {
      /* MediaSession is optional */
    }
  }, [advance, reciter.nameAr, track]);

  const play = useCallback((surah: number, ayah = 1) => startTrack({ surah, ayah }), [startTrack]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!trackRef.current) return;
    if (audio.paused) {
      void audio.play().catch(() => setStatus("error"));
    } else {
      audio.pause();
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    repeatsRef.current = 0;
    pendingRef.current = null;
    setStatus("idle");
    setTrack(null);
    trackRef.current = null;
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(seconds)) audio.currentTime = Math.max(0, seconds);
  }, []);

  const isBusy = status === "playing" || status === "loading";

  return useMemo(
    () => ({
      track,
      status,
      error,
      offline,
      position,
      isBusy,
      reciter,
      play,
      toggle,
      stop,
      next: () => advance(1),
      prev: () => advance(-1),
      seek,
    }),
    [advance, error, isBusy, offline, play, position, reciter, seek, status, stop, toggle, track],
  );
}
