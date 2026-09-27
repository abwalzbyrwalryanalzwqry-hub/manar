import { beforeEach, describe, expect, it, vi } from "vitest";

/* طبقة Preferences وهمية بمجموعات منفصلة، كما في SharedPreferences الأصلية:
 * كل مجموعة ملف مستقل، و`configure` يبدّل المجموعة النشطة. */
const groups = new Map<string, Map<string, string>>();
let active = "CapacitorStorage";
const group = (name: string) => {
  if (!groups.has(name)) groups.set(name, new Map());
  return groups.get(name)!;
};

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    configure: async ({ group: g }: { group: string }) => {
      active = g;
    },
    get: async ({ key }: { key: string }) => ({ value: group(active).get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      group(active).set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      group(active).delete(key);
    },
    keys: async () => ({ keys: [...group(active).keys()] }),
  },
}));

class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const ORIGINAL = {
  setItem: MemoryStorage.prototype.setItem,
  removeItem: MemoryStorage.prototype.removeItem,
  clear: MemoryStorage.prototype.clear,
};

const TOKEN = "sb-abcdef-auth-token";

async function freshModule() {
  vi.resetModules();
  const localStorage = new MemoryStorage();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage,
    Storage: MemoryStorage,
    Capacitor: { isNativePlatform: () => true },
  };
  const mod = await import("@/lib/persistent-storage");
  return { mod, localStorage };
}

describe("التخزين الدائم: حالة منار وحدها، وبقايا الحساب تُمسح", () => {
  beforeEach(() => {
    groups.clear();
    active = "CapacitorStorage";
    // إعادة Storage.prototype نظيفاً بين الاختبارات.
    Object.assign(MemoryStorage.prototype, ORIGINAL);
  });

  it("مفاتيح منار تُطابَق في مجموعة الحالة، ورمز الجلسة لا يُطابَق", async () => {
    const { mod, localStorage } = await freshModule();
    await mod.hydratePersistentStorage();
    localStorage.setItem("manar.settings.v1", '{"a":1}');
    localStorage.setItem(TOKEN, "secret");
    await mod.flushPersistentWrites();

    expect(group("CapacitorStorage").get("manar.settings.v1")).toBe('{"a":1}');
    expect(group("CapacitorStorage").has(TOKEN)).toBe(false);
    expect(group("ManarSession").has(TOKEN)).toBe(false);
  });

  it("الإقلاع يمسح رموز الجلسة القديمة من المجموعتين ومن localStorage، ويستعيد الحالة", async () => {
    group("CapacitorStorage").set(TOKEN, "old-secret");
    group("CapacitorStorage").set("manar.appearance.v1", "dark");
    group("ManarSession").set(TOKEN, "secret");
    const { mod, localStorage } = await freshModule();
    localStorage.setItem(TOKEN, "secret");
    await mod.hydratePersistentStorage();
    await mod.flushPersistentWrites();

    expect(group("CapacitorStorage").has(TOKEN)).toBe(false);
    expect(group("ManarSession").size).toBe(0);
    expect(localStorage.getItem(TOKEN)).toBeNull();
    expect(localStorage.getItem("manar.appearance.v1")).toBe("dark");
  });

  it("المجموعة النشطة تعود افتراضية بعد الاستعادة", async () => {
    group("ManarSession").set(TOKEN, "secret");
    const { mod } = await freshModule();
    await mod.hydratePersistentStorage();
    await mod.flushPersistentWrites();
    expect(active).toBe("CapacitorStorage");
  });

  it("لا يطابق إلا مفاتيح منار", async () => {
    const { mod } = await freshModule();
    expect(mod.isMirroredKey("manar.settings.v1")).toBe(true);
    expect(mod.isMirroredKey(TOKEN)).toBe(false);
    expect(mod.isMirroredKey("other")).toBe(false);
    expect(mod.isLegacySessionKey(TOKEN)).toBe(true);
  });
});
