// @vitest-environment jsdom
/* واجهة الأذكار الشخصية والمسبحة: مسارات المستخدم الفعلية على شاشات التطبيق نفسها. */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPersonalStore } from "@/lib/personal-azkar/store";
import { readTasbihStore } from "@/lib/tasbih/store";
import { WIRD_SESSIONS } from "@/lib/wird/data";
import { Route as WirdListRoute } from "@/routes/wird.list.$session";
import { Route as WirdSessionRoute } from "@/routes/wird.$session";
import { Route as TasbihIndexRoute } from "@/routes/tasbih.index";
import { Route as TasbihLibraryRoute } from "@/routes/tasbih.library";

async function renderAt(path: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const mk = (r: unknown, p: string) =>
    (r as { update: (o: unknown) => unknown }).update({
      id: p,
      path: p,
      getParentRoute: () => root,
    } as never);
  const tree = root.addChildren([
    mk(WirdListRoute, "/wird/list/$session"),
    mk(WirdSessionRoute, "/wird/$session"),
    mk(TasbihIndexRoute, "/tasbih/"),
    mk(TasbihLibraryRoute, "/tasbih/library"),
  ] as never);
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return router;
}

const text = () => document.body.textContent ?? "";
const dialog = () => screen.getByRole("dialog");
const badges = () => screen.queryAllByText("ذكري الخاص");

beforeEach(() => {
  window.localStorage.clear();
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  if (!window.matchMedia)
    window.matchMedia = (() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })) as never;
});

afterEach(() => cleanup());

async function addFromSheet(body: string, opts: { both?: boolean; repeat?: string } = {}) {
  fireEvent.click(screen.getAllByRole("button", { name: /إضافة ذكر/ })[0]);
  const d = dialog();
  fireEvent.change(within(d).getByLabelText("نص الذكر"), { target: { value: body } });
  if (opts.both) fireEvent.click(within(d).getByRole("checkbox", { name: /ورد المساء/ }));
  if (opts.repeat != null)
    fireEvent.change(within(d).getByLabelText(/عدد التكرارات في الوِرد/), {
      target: { value: opts.repeat },
    });
  await act(async () => {
    fireEvent.click(within(d).getByRole("button", { name: "حفظ الذكر" }));
  });
}

describe("الأذكار الشخصية في ورد الصباح", () => {
  it("إضافة ذكر تظهر فورًا بشارة «ذكري الخاص» دون المساس بالأذكار الأصلية", async () => {
    await renderAt("/wird/list/morning");
    const originalCount = WIRD_SESSIONS.morning.items.length;
    expect(badges()).toHaveLength(0);
    const before = text();

    await addFromSheet("سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", { repeat: "3" });

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(badges()).toHaveLength(1));
    expect(text()).toContain("سُبْحَانَ اللَّهِ وَبِحَمْدِهِ");
    expect(text()).toContain("ذكر مخصص");
    /* كل نص أصلي ما زال موجودًا */
    for (const it of WIRD_SESSIONS.morning.items.slice(0, 5)) expect(text()).toContain(it.name);
    expect(before.length).toBeGreaterThan(0);
    const stored = readPersonalStore().items;
    expect(stored).toHaveLength(1);
    expect(stored[0].wird).toMatchObject({ sessions: ["morning"], repeat: 3 });
    /* لا شارة على أي بطاقة أصلية: عدد الشارات = عدد الأذكار الشخصية */
    expect(badges()).toHaveLength(1);
    expect(originalCount).toBe(WIRD_SESSIONS.morning.items.length);
  });

  it("النص الفارغ يُرفض والنموذج يبقى مفتوحًا", async () => {
    await renderAt("/wird/list/morning");
    await addFromSheet("    ");
    expect(dialog()).toBeTruthy();
    expect(within(dialog()).getByRole("alert").textContent).toBeTruthy();
    expect(readPersonalStore().items).toHaveLength(0);
  });

  it("عدد غير صالح يُرفض مع رسالة، ويبقى النص المكتوب", async () => {
    await renderAt("/wird/list/morning");
    await addFromSheet("ذكر للتجربة", { repeat: "0" });
    expect(dialog()).toBeTruthy();
    expect((within(dialog()).getByLabelText("نص الذكر") as HTMLTextAreaElement).value).toBe(
      "ذكر للتجربة",
    );
    expect(readPersonalStore().items).toHaveLength(0);
  });

  it("العدّ للذكر الشخصي، ثم الحذف بتأكيد يزيله من الوِردين", async () => {
    await renderAt("/wird/list/morning");
    await addFromSheet("أَسْتَغْفِرُ اللَّهَ", { both: true, repeat: "2" });
    const z = readPersonalStore().items[0];
    expect(z.wird.sessions).toEqual(["morning", "evening"]);

    const counter = await screen.findByRole("button", { name: /زيادة عدّاد ذكر مخصص/ });
    await act(async () => {
      fireEvent.click(counter);
    });
    expect(screen.getByRole("button", { name: /زيادة عدّاد ذكر مخصص، ١ من ٢/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "خيارات «ذكر مخصص»" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /حذف الذكر/ }));
    expect(text()).toContain("سيُحذف من ورد الصباح وورد المساء معًا");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "حذف نهائي" }));
    });
    await waitFor(() => expect(badges()).toHaveLength(0));
    expect(readPersonalStore().items).toHaveLength(0);
  });

  it("الإضافة لا تفقد تقدّم الأذكار الأصلية ولا تعيد تحميل الصفحة", async () => {
    await renderAt("/wird/list/morning");
    const first = WIRD_SESSIONS.morning.items.find((it) => it.repeat > 1)!;
    const ar = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
    const origBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent === `٠ / ${ar(first.repeat)}`)!;
    await act(async () => {
      fireEvent.click(origBtn);
    });
    await addFromSheet("ذكر بعد التقدّم");
    await waitFor(() => expect(badges()).toHaveLength(1));
    const progressed = screen
      .getAllByRole("button")
      .filter((b) => /^١ \/ /.test(b.textContent ?? ""));
    expect(progressed.length).toBeGreaterThan(0);
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await new Promise((r) => setTimeout(r, 250));
    });
    const raw = JSON.parse(window.localStorage.getItem("manar.wird.progress.v1") ?? "{}");
    expect(raw.morning.counts[first.order]).toBe(1);
  });

  it("تغيير الاسم وإزالة الذكر من ورد الصباح فقط يُبقيه في المساء", async () => {
    await renderAt("/wird/list/morning");
    await addFromSheet("ذكر مشترك", { both: true });
    fireEvent.click(screen.getByRole("button", { name: "خيارات «ذكر مخصص»" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /تغيير الاسم/ }));
    fireEvent.change(within(dialog()).getByLabelText(/اسم الذكر/), {
      target: { value: "ذكر الصباح والمساء" },
    });
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: "حفظ الذكر" }));
    });
    await waitFor(() => expect(text()).toContain("ذكر الصباح والمساء"));
    fireEvent.click(screen.getByRole("button", { name: "خيارات «ذكر الصباح والمساء»" }));
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: /إزالته من ورد الصباح فقط/ }));
    });
    await waitFor(() => expect(badges()).toHaveLength(0));
    expect(readPersonalStore().items[0]).toMatchObject({
      name: "ذكر الصباح والمساء",
      wird: { sessions: ["evening"] },
    });
  });

  it("ذكر الوِردين سجل واحد يظهر في ورد المساء أيضًا", async () => {
    await renderAt("/wird/list/morning");
    await addFromSheet("لَا إِلَهَ إِلَّا اللَّهُ", { both: true });
    cleanup();
    await renderAt("/wird/list/evening");
    await waitFor(() => expect(badges()).toHaveLength(1));
    expect(text()).toContain("لَا إِلَهَ إِلَّا اللَّهُ");
    expect(text()).toContain("عدد مفتوح");
    expect(readPersonalStore().items).toHaveLength(1);
  });

  it("الجلسة المتسلسلة تعرض الذكر الشخصي في موضعه بعد الأذكار الأصلية", async () => {
    await renderAt("/wird/list/morning");
    await addFromSheet("ذكر في آخر الوِرد");
    cleanup();
    await renderAt("/wird/morning");
    const total = WIRD_SESSIONS.morning.items.length + 1;
    expect(text()).toContain(`من ${String(total).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d])}`);
  });
});

describe("المسبحة الإلكترونية", () => {
  it("بدء جلسة من المكتبة، العدّ حتى الهدف ثم بعده، والتراجع", async () => {
    await renderAt("/tasbih/library");
    fireEvent.click(screen.getAllByRole("button", { name: "ابدأ" })[0]);
    const d = dialog();
    expect(within(d).getByText("ورد في المصدر")).toBeTruthy();
    fireEvent.click(within(d).getByRole("radio", { name: /^٣٣/ }));
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: "ابدأ الجلسة" }));
    });
    const btn = await screen.findByRole("button", { name: /سبّح، ٠ من ٣٣/ });
    await act(async () => {
      for (let i = 0; i < 33; i++) fireEvent.click(btn);
    });
    expect(text()).toContain("بلغت هدفك ٣٣");
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(screen.getByRole("button", { name: /سبّح، ٣٤ من ٣٣/ })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "تراجع" }));
    });
    expect(screen.getByRole("button", { name: /سبّح، ٣٣ من ٣٣/ })).toBeTruthy();
    /* الحفظ عند المغادرة */
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    const stored = readTasbihStore();
    expect(stored.sessions[0]).toMatchObject({
      count: 33,
      target: 33,
      mode: "target",
      status: "active",
    });
  });

  it("لا تُستبدل جلسة جارية بصمت", async () => {
    await renderAt("/tasbih/library");
    fireEvent.click(screen.getAllByRole("button", { name: "ابدأ" })[0]);
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: "ابدأ الجلسة" }));
    });
    const btn = await screen.findByRole("button", { name: /سبّح/ });
    await act(async () => {
      fireEvent.click(btn);
      window.dispatchEvent(new Event("pagehide"));
    });
    cleanup();
    await renderAt("/tasbih/library");
    fireEvent.click(screen.getAllByRole("button", { name: "ابدأ" })[1]);
    expect(within(dialog()).getByText(/لديك جلسة جارية/)).toBeTruthy();
    expect(within(dialog()).getByRole("button", { name: "متابعة الجارية" })).toBeTruthy();
  });

  it("أذكاري الخاصة: إضافة ذكر للمسبحة دون ربطه بالوِرد", async () => {
    await renderAt("/tasbih/library");
    fireEvent.click(screen.getByRole("tab", { name: "أذكاري الخاصة" }));
    expect(text()).toContain("لا أذكار خاصة بعد");
    fireEvent.click(screen.getByRole("button", { name: /إضافة ذكر/ }));
    const d = dialog();
    fireEvent.change(within(d).getByLabelText("نص الذكر"), { target: { value: "ذكري للمسبحة" } });
    fireEvent.change(within(d).getByLabelText(/ملاحظة شخصية/), {
      target: { value: "من درس الجمعة" },
    });
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: "حفظ الذكر" }));
    });
    await waitFor(() => expect(badges()).toHaveLength(1));
    expect(text()).toContain("ملاحظتك الشخصية (غير موثّقة من منار): من درس الجمعة");
    expect(readPersonalStore().items[0].wird.sessions).toEqual([]);
  });
});
