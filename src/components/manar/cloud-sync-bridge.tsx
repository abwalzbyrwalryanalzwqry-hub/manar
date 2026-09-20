import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { pushAll, syncOnLogin } from "@/lib/cloud-sync";

/** Restores cloud data on login, then debounce-pushes localStorage edits. */
export function CloudSyncBridge() {
  const { user } = useAuth();
  const lastUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      lastUserRef.current = null;
      return;
    }
    if (lastUserRef.current === user.id) return;
    lastUserRef.current = user.id;
    syncOnLogin(user.id).catch((e) => console.warn("[manar] cloud sync failed", e));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => pushAll(user.id).catch(() => {}), 2000);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("manar-")) schedule();
    };
    window.addEventListener("storage", onStorage);
    // Push on tab close to capture same-tab changes
    const onHide = () => pushAll(user.id).catch(() => {});
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onHide);
      if (t) clearTimeout(t);
    };
  }, [user]);

  return null;
}
