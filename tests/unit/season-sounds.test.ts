import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SEASONS } from "@/lib/seasons/definitions";
import {
  DEFAULT_SEASON_SOUND,
  SEASON_SOUNDS,
  SEASON_SOUND_BY_REMINDER,
  seasonSoundFor,
  type SeasonSoundId,
} from "@/lib/seasons/sounds";
import { seasonNotificationsBetween } from "@/lib/seasons/engine";

const root = resolve(__dirname, "../..");
const raw = (url: string) =>
  url
    .split("/")
    .pop()!
    .replace(/\.mp3$/, "")
    .replace(/-/g, "_");

describe("أصوات تنبيهات المواسم", () => {
  it("كل تنبيه في المواسم له صوت محدّد صراحة، ولا مفتاح يتيم", () => {
    const keys = SEASONS.flatMap((s) => s.reminders.map((r) => `${s.id}/${r.id}`));
    for (const k of keys) expect(SEASON_SOUND_BY_REMINDER, k).toHaveProperty([k]);
    expect(Object.keys(SEASON_SOUND_BY_REMINDER).sort()).toEqual([...keys].sort());
  });

  it("التسجيلات الخاصة لمواضعها، والاحتياطي العام لما لم يُحدَّد", () => {
    expect(seasonSoundFor("friday", "eve")).toBe("friday-eve");
    expect(seasonSoundFor("friday", "day")).toBe("friday-day");
    expect(seasonSoundFor("monday-thursday", "eve")).toBe("fast-eve");
    expect(seasonSoundFor("white-days", "eve")).toBe("white-days-eve");
    expect(seasonSoundFor("ramadan", "d-7")).toBe("new");
    expect(seasonSoundFor("shawwal", "eid")).toBe("general");
    expect(seasonSoundFor("future-season", "x")).toBe(DEFAULT_SEASON_SOUND);
    expect(DEFAULT_SEASON_SOUND).toBe("general");
  });

  it("كل صوت مستعمل، وملفه ونسخه المخفّضة موجودة", () => {
    const used = new Set<SeasonSoundId>(Object.values(SEASON_SOUND_BY_REMINDER));
    used.add(DEFAULT_SEASON_SOUND);
    for (const [id, s] of Object.entries(SEASON_SOUNDS)) {
      expect(used.has(id as SeasonSoundId), id).toBe(true);
      expect(existsSync(resolve(root, "public" + s.url)), s.url).toBe(true);
      for (const l of [20, 40, 60, 80])
        expect(existsSync(resolve(root, `assets/audio-levels/${raw(s.url)}_v${l}.mp3`))).toBe(true);
    }
    const orphans = readdirSync(resolve(root, "assets/audio-levels"))
      .filter((f) => f.startsWith("season_"))
      .map((f) => f.replace(/_v\d+\.mp3$/, ""));
    const raws = new Set(Object.values(SEASON_SOUNDS).map((s) => raw(s.url)));
    for (const o of orphans) expect(raws.has(o), o).toBe(true);
  });

  it("التنبيه المجدول يحمل معرّف تنبيهه لاختيار صوته", () => {
    const all = {
      enabled: true,
      morning: { hour: 8, minute: 0 },
      evening: { hour: 20, minute: 0 },
      seasons: Object.fromEntries(SEASONS.map((s) => [s.id, true])),
    };
    const list = seasonNotificationsBetween(new Date(2026, 0, 1, 12), 30, 0, all as never);
    expect(list.length).toBeGreaterThan(0);
    for (const n of list) {
      const def = SEASONS.find((s) => s.id === n.seasonId)!;
      expect(def.reminders.map((r) => r.id)).toContain(n.reminderId);
    }
  });
});
