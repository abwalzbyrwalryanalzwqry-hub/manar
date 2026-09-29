// @vitest-environment jsdom
/* مواسم منار — اختبارات واجهة لصفحتي المواسم بتواريخ مثبّتة (المرحلة الخامسة). */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayKey } from "@/lib/activity-log";
import { __resetHijriMonthStartsForTests, fromHijri } from "@/lib/hijri";
import { Route as SeasonRoute } from "@/routes/seasons.$season";
import { Route as SeasonsIndexRoute } from "@/routes/seasons.index";

const H = (year: number, month: number, day: number, hour = 10) => {
  const d = fromHijri({ year, month, day });
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function renderAt(path: string, now: Date) {
  vi.setSystemTime(now);
  const root = createRootRoute({ component: () => <Outlet /> });
  const tree = root.addChildren([
    SeasonsIndexRoute.update({
      id: "/seasons/",
      path: "/seasons/",
      getParentRoute: () => root,
    } as never),
    SeasonRoute.update({
      id: "/seasons/$season",
      path: "/seasons/$season",
      getParentRoute: () => root,
    } as never),
  ]);
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
  // الرسم الأول هيكل (اليوم يُقرأ بعد التركيب)، ثم المحتوى.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return router;
}

const text = () => document.body.textContent ?? "";
const waitText = (m: string | RegExp) =>
  waitFor(() => expect(text()).toMatch(m), { timeout: 3000 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __resetHijriMonthStartsForTests();
});

describe("صفحة الموسم بتواريخ مثبّتة", () => {
  it("قبل رمضان: عدّ تنازلي وتأكيد الدخول وأهداف الاستعداد", async () => {
    await renderAt("/seasons/ramadan", H(1447, 8, 28));
    await waitText(/بقي|غدًا/);
    expect(text()).toContain("دخول شهر رمضان");
    expect(text()).toContain("قضاء ما فات من صيام");
    expect(text()).not.toContain("حصيلتي في");
  });

  it("العشر الأواخر: المرحلة وإحياء الليل متاح والقضاء مخفي", async () => {
    await renderAt("/seasons/ramadan", H(1447, 9, 23));
    await waitText(/اليوم ٢٣ من رمضان|اليوم ٢٣/);
    expect(text()).toContain("العشر الأواخر");
    expect(text()).not.toContain("قضاء ما فات من صيام");
    expect(text()).not.toContain("دخول شهر رمضان");
  });

  it("يوم عيد الفطر: صفحة رمضان تعرض الحصيلة", async () => {
    await renderAt("/seasons/ramadan", H(1447, 10, 1));
    await waitText(/حصيلتي في رمضان|انتهى الموسم/);
    expect(text()).toContain("عيد الفطر");
  });

  it("جمعة في رمضان: صفحة الجمعة تعمل وتعرض الأوقات ورابط إعداداتها", async () => {
    // أول جمعة في رمضان ١٤٤٧.
    let d = H(1447, 9, 1);
    while (d.getDay() !== 5) d = new Date(d.getTime() + 86_400_000);
    await renderAt("/seasons/friday", d);
    await waitText(/يوم الجمعة|الجمعة/);
    expect(text()).not.toContain("تعذّر العثور");
    expect(text()).toContain("سورة الكهف");
  });

  it("الاثنين والخميس في منتصف رمضان: موعد قادم لا «تعذّر العثور»", async () => {
    await renderAt("/seasons/monday-thursday", H(1447, 9, 15));
    await waitText(/بقي|غدًا/);
    expect(text()).not.toContain("تعذّر العثور");
  });
});

describe("صفحة المواسم", () => {
  it("يوم العيد: شوال مميّز بلا تكرار، والإعدادات في مكان واحد", async () => {
    await renderAt("/seasons/", H(1447, 10, 1));
    await waitText("تنبيهات المواسم");
    expect(text()).toContain("شوال");
    expect(text()).toContain("تذكير الصباح");
    expect(text()).toContain("مفعّلة:");
    // «عيد الفطر» في البطاقة المميّزة، لا صفّاً ثانياً من رمضان.
    const eid = text().match(/عيد الفطر/g) ?? [];
    expect(eid.length).toBeLessThanOrEqual(2);
  });

  it("آخر أسبوع من شعبان: رمضان هو المميّز", async () => {
    await renderAt("/seasons/", H(1447, 8, 25));
    await waitText("تنبيهات المواسم");
    // أول رابط موسم في الصفحة هو البطاقة المميّزة.
    const first = document.querySelector("a[href^='/seasons/']");
    expect(first?.getAttribute("href")).toBe("/seasons/ramadan");
  });
});

describe("التفاعل", () => {
  it("تسجيل الإنجاز يحدّث الصفحة ولا يطلق حدث إعادة الجدولة", async () => {
    await renderAt("/seasons/ramadan", H(1447, 9, 5));
    await waitText("اليوم ٥ من رمضان");
    const events: string[] = [];
    const spy = (e: Event) => events.push(e.type);
    window.addEventListener("manar:seasons", spy);
    window.addEventListener("manar:seasons-plan", spy);
    // فعّل أول هدف متاح إن لم يكن مفعّلاً، ثم سجّل إنجاز اليوم.
    const add = screen.getAllByRole("button").find((b) => b.textContent?.startsWith("صيام اليوم"));
    await act(async () => fireEvent.click(add!));
    const mark = await screen.findAllByRole("button", { name: "أنجزته اليوم" });
    await act(async () => fireEvent.click(mark[0]));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "أُنجز اليوم" }).length).toBe(1),
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((t) => t === "manar:seasons-plan")).toBe(true);
    window.removeEventListener("manar:seasons", spy);
    window.removeEventListener("manar:seasons-plan", spy);
  });

  it("تأكيد دخول رمضان من البطاقة ينقل بداية الموسم", async () => {
    await renderAt("/seasons/ramadan", H(1447, 8, 29));
    await waitText("دخول شهر رمضان");
    // حساب شعبان ٢٩ يوماً؛ «إكمال العدة» يعني البدء بعد غد.
    const btn = screen.getAllByRole("button").find((b) => b.textContent === "يبدأ بعد غد");
    expect(btn).toBeTruthy();
    await act(async () => fireEvent.click(btn!));
    await waitText("مؤكَّد:");
    expect(btn!.getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(localStorage.getItem("manar.hijri.month-starts.v1")!)).toEqual({
      "1447-09": dayKey(new Date(H(1447, 8, 29).getTime() + 2 * 86_400_000)),
    });
    expect(screen.getByRole("button", { name: "العودة للحساب" })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "العودة للحساب" })));
    await waitText("بحسب الحساب:");
  });
});
