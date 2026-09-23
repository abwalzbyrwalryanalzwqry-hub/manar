import { runInNewContext } from "node:vm";
import { parse } from "acorn";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
// @ts-expect-error — وحدة .mjs بلا أنواع
import { BOOT_GUARD_JS, MIN_WEBVIEW_CHROME } from "../../scripts/boot-guard.mjs";

/* درع الإقلاع يعمل على WebView قديم جداً (Chrome 52 على أندرويد ٧ بلا متجر Play)،
 * فيُختبر في بيئة مصغّرة تحاكي ما يوفّره ذلك المحرّك فقط. */

type El = {
  id: string;
  attrs: Record<string, string>;
  style: { cssText: string };
  innerHTML: string;
  setAttribute(k: string, v: string): void;
  remove(): void;
};

function makeEnv(opts: { modules: boolean; ua?: string; readyState?: string }) {
  const children: El[] = [];
  const store = new Map<string, string>();
  const docListeners: Record<string, () => void> = {};
  const body = {
    appendChild(el: El) {
      children.push(el);
    },
  };
  const document = {
    readyState: opts.readyState ?? "loading",
    body: null as typeof body | null,
    getElementById: (id: string) => children.find((c) => c.id === id) ?? null,
    createElement: (): El => {
      const el: El = {
        id: "",
        attrs: {},
        style: { cssText: "" },
        innerHTML: "",
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        remove() {
          children.splice(children.indexOf(el), 1);
        },
      };
      return el;
    },
    addEventListener: (ev: string, fn: () => void) => {
      docListeners[ev] = fn;
    },
  };
  const window: Record<string, unknown> = { addEventListener: () => {} };
  function HTMLScriptElement() {}
  if (opts.modules) (HTMLScriptElement.prototype as Record<string, unknown>).noModule = false;
  const ctx = {
    window,
    document,
    navigator: {
      userAgent:
        opts.ua ??
        "Mozilla/5.0 (Linux; Android 7.0; wv) AppleWebKit/537.36 Chrome/52.0.2743.100 Mobile Safari/537.36",
    },
    localStorage: {
      setItem: (k: string, v: string) => store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
    },
    performance: { now: () => 1 },
    HTMLScriptElement,
    setTimeout,
    Object,
    JSON,
    String,
    Math,
    parseInt,
  };
  runInNewContext(BOOT_GUARD_JS, ctx);
  return {
    window,
    store,
    children,
    ready() {
      document.body = body;
      document.readyState = "interactive";
      docListeners.DOMContentLoaded?.();
    },
  };
}

describe("درع الإقلاع", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ES5 خالص حتى يعمل على Chrome 52", () => {
    expect(() => parse(BOOT_GUARD_JS, { ecmaVersion: 5, sourceType: "script" })).not.toThrow();
    expect(BOOT_GUARD_JS).not.toContain("inset:");
    expect(BOOT_GUARD_JS).not.toMatch(/<\/script/i);
  });

  it("WebView بلا وحدات: رسالة التحديث فور جاهزية الصفحة، وتُحفظ للاختبار", () => {
    const env = makeEnv({ modules: false });
    expect(env.children).toHaveLength(0);
    env.ready();
    expect(env.children).toHaveLength(1);
    const el = env.children[0];
    expect(el.id).toBe("manar-boot-error");
    expect(el.attrs["data-reason"]).toBe("unsupported");
    expect(el.innerHTML).toContain("Android System WebView");
    expect(el.innerHTML).toContain("الإصدار 52");
    expect(el.innerHTML).toContain(`الإصدار ${MIN_WEBVIEW_CHROME} أو أحدث`);
    expect(el.style.cssText).toContain("top:0;right:0;bottom:0;left:0");
    expect(env.store.get("manar.bootguard.v1")).toBe("unsupported chrome=52");
  });

  it("شاشة الاستعادة المبنية مسبقاً لا تُخفي تعطّل الحزمة: مهلة بلا تركيب ← رسالة", () => {
    const env = makeEnv({ modules: true, ua: "Chrome/120.0" });
    env.ready();
    vi.advanceTimersByTime(9_999);
    expect(env.children).toHaveLength(0);
    vi.advanceTimersByTime(2);
    expect(env.children).toHaveLength(1);
    expect(env.children[0].attrs["data-reason"]).toBe("timeout");
    expect(env.children[0].innerHTML).toContain("تعذّر تشغيل منار");
    expect(env.store.get("manar.bootguard.v1")).toBe("timeout chrome=120");
  });

  it("تطبيق أعلن تركيبه: لا رسالة", () => {
    const env = makeEnv({ modules: true, ua: "Chrome/120.0" });
    env.ready();
    env.window.__manarMounted = true;
    vi.advanceTimersByTime(20_000);
    expect(env.children).toHaveLength(0);
    expect(env.store.has("manar.bootguard.v1")).toBe(false);
  });

  it("يرقّع Object.hasOwn", () => {
    expect(BOOT_GUARD_JS).toContain("hasOwn");
  });
});
