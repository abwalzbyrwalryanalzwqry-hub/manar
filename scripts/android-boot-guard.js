/*
 * منار — حارس الإقلاع للطبقة الأصلية (Android).
 *
 * يُحقن حرفيًا في أول <head> داخل index.html بواسطة
 * scripts/prepare-android-webdir.mjs، ولذلك يعمل حتى لو فشلت حزمة التطبيق
 * الرئيسية في التحميل أو التحليل أو الترطيب (hydration) — وهي الحالة التي كانت
 * تُنتج شاشة خضراء عالقة لا تستجيب لأي لمس أو زر رجوع.
 *
 * ثلاث وظائف فقط:
 *   1) إخفاء شاشة البداية بمحاولات متكررة، بمعزل عن شجرة React.
 *   2) تجميع كل خطأ JS أو وعد مرفوض في مصفوفة قابلة للعرض.
 *   3) مؤقّت مراقبة: إن بقيت الصفحة فارغة بعد المدة المحددة، يعرض لوحة عربية
 *      تشرح المشكلة ونص الخطأ الحقيقي وزر إعادة المحاولة، بدل الشاشة الصامتة.
 */
(function () {
  "use strict";

  var HIDE_ATTEMPTS = [0, 300, 900, 1800, 3000, 4500];
  var WATCHDOG_MS = 8000;
  var errors = [];
  window.__MANAR_BOOT__ = { errors: errors, hidden: false, painted: false };

  function splash() {
    try {
      var cap = window.Capacitor;
      if (!cap || (cap.isNativePlatform && !cap.isNativePlatform())) return null;
      return (cap.Plugins && cap.Plugins.SplashScreen) || null;
    } catch (e) {
      return null;
    }
  }

  function hideSplash() {
    var s = splash();
    if (!s || typeof s.hide !== "function") return;
    try {
      var r = s.hide({ fadeOutDuration: 200 });
      window.__MANAR_BOOT__.hidden = true;
      if (r && typeof r.catch === "function") r.catch(function () {});
    } catch (e) {
      /* لا نُفشل الإقلاع بسبب شاشة البداية */
    }
  }

  for (var i = 0; i < HIDE_ATTEMPTS.length; i++) {
    setTimeout(hideSplash, HIDE_ATTEMPTS[i]);
  }
  window.addEventListener("load", hideSplash);
  document.addEventListener("DOMContentLoaded", hideSplash);

  function record(label, detail) {
    var text = label + ": " + detail;
    if (errors.indexOf(text) === -1) errors.push(text);
  }

  window.addEventListener("error", function (e) {
    if (e && e.target && e.target !== window && e.target.src) {
      record("تعذّر تحميل ملف", String(e.target.src));
      return;
    }
    record("خطأ", (e && (e.message || (e.error && e.error.message))) || "غير معروف");
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    record("وعد مرفوض", (r && (r.message || r)) || "غير معروف");
  });

  function hasContent() {
    var b = document.body;
    if (!b) return false;
    if (b.querySelector("[data-manar-root]")) return true;
    return (b.innerText || "").trim().length > 0;
  }

  function showPanel() {
    if (hasContent() || document.getElementById("manar-boot-error")) return;
    hideSplash();
    var list = errors.length
      ? errors.slice(0, 6).map(function (t) { return "<li>" + t.replace(/[<>&]/g, " ") + "</li>"; }).join("")
      : "<li>لم يُسجَّل خطأ صريح — الواجهة لم تُرسم خلال " + WATCHDOG_MS / 1000 + " ثوانٍ.</li>";
    var el = document.createElement("div");
    el.id = "manar-boot-error";
    el.setAttribute("dir", "rtl");
    el.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:#0B1F1A;color:#F8F9FA;" +
      "font-family:system-ui,sans-serif;padding:24px;overflow:auto;-webkit-text-size-adjust:100%";
    el.innerHTML =
      '<div style="max-width:520px;margin:10vh auto;text-align:center">' +
      '<div style="font-size:20px;font-weight:700;color:#C9A227">تعذّر بدء منار</div>' +
      '<p style="font-size:14px;line-height:1.9;opacity:.85;margin:14px 0 18px">' +
      "حدث خطأ أثناء تحميل الواجهة. التفاصيل أدناه تساعد في الإصلاح." +
      "</p>" +
      '<ul style="text-align:start;font-size:12px;line-height:1.9;background:rgba(255,255,255,.06);' +
      'border:1px solid rgba(201,162,39,.35);border-radius:16px;padding:14px 20px;margin:0 0 20px">' +
      list +
      "</ul>" +
      '<button id="manar-boot-retry" style="background:#0E7A5F;color:#fff;border:0;border-radius:14px;' +
      'padding:12px 26px;font-size:14px;font-weight:600">إعادة المحاولة</button>' +
      "</div>";
    document.body.appendChild(el);
    var btn = document.getElementById("manar-boot-retry");
    if (btn) {
      btn.addEventListener("click", function () {
        window.location.replace("/");
      });
    }
  }

  setTimeout(function () {
    if (hasContent()) {
      window.__MANAR_BOOT__.painted = true;
      return;
    }
    showPanel();
  }, WATCHDOG_MS);
})();
