import { getCloud } from "@/integrations/supabase/optional-client";

/**
 * Maps a Supabase table name to one or more localStorage keys whose values
 * (parsed JSON) make up the table's "data" JSONB column.
 */
const SYNC_MAP: Record<string, string[]> = {
  user_settings: ["manar-theme", "manar-language", "manar-preferences"],
  prayer_preferences: ["manar-prayer-method", "manar-prayer-offsets", "manar-location"],
  notification_preferences: ["manar-adhan-settings", "manar-notification-prefs"],
  reading_progress: ["manar-quran-progress", "manar-azkar-progress"],
  achievement_progress: ["manar-achievements", "manar-streak"],
};

function collect(keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v == null) continue;
    try { out[k] = JSON.parse(v); } catch { out[k] = v; }
  }
  return out;
}

function apply(data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }
}

/** Push local settings up to the cloud (manual save or autosave). */
export async function pushAll(userId: string) {
  for (const [table, keys] of Object.entries(SYNC_MAP)) {
    const data = collect(keys);
    if (Object.keys(data).length === 0) continue;
    const cloud = getCloud();
    if (!cloud) return;
    await cloud.from(table as "user_settings").upsert({ user_id: userId, data: data as never });
  }
}

/** Pull cloud settings down into localStorage (used on login / new device). */
export async function pullAll(userId: string) {
  let touched = false;
  for (const [table] of Object.entries(SYNC_MAP)) {
    const cloud = getCloud();
    if (!cloud) return;
    const { data } = await cloud
      .from(table as "user_settings")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.data && typeof data.data === "object") {
      apply(data.data as Record<string, unknown>);
      touched = true;
    }
  }
  if (touched) window.dispatchEvent(new CustomEvent("manar:cloud-restored"));
}

/** Merge: pull first (cloud wins for existing keys), then push to fill gaps. */
export async function syncOnLogin(userId: string) {
  await pullAll(userId);
  await pushAll(userId);
}
