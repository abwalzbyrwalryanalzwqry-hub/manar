/**
 * منار — درع الإقلاع: نصّ عادي (لا وحدة) يُحقن في رأس `index.html` قبل حزمة التطبيق.
 *
 * لماذا هنا لا داخل الحزمة: حزمة Vite تُحمَّل بـ `<script type="module">`، و`WebView`
 * الأقدم من Chrome 61 يتجاهل هذا الوسم بصمت — فلا خطأ ولا انهيار، ويبقى المستخدم
 * أمام HTML المبني مسبقاً («جارٍ استعادة بياناتك…») إلى الأبد. هذا النصّ وحده يعمل
 * على تلك المحرّكات، فيجب أن يبقى ES5 خالصاً (لا `=>` ولا `let` ولا قوالب نصّية،
 * ولا فاصلة ختامية في استدعاء دالّة — Chrome 58 — ولذلك تنسيق prettier لهذا الملف `es5`)،
 * ولا يستعمل CSS أحدث من Chrome 52 (لا `inset`).
 *
 * ١) ترقيع `Object.hasOwn` (ES2022) الذي يستعمله موجّه TanStack.
 * ٢) سجلّ أخطاء مبكّر في `window.__manarBootLog` و`localStorage`.
 * ٣) كشف فوري: لا دعم لوحدات JavaScript ← رسالة «حدّث WebView» عند جاهزية الصفحة.
 * ٤) مهلة: إن لم يُعلن React تركيبه (`window.__manarMounted`) خلال عشر ثوانٍ ← رسالة
 *    «تعذّر تشغيل منار». الفحص السابق كان يعدّ أي `div` فيه نص دليلَ عمل، وشاشة
 *    الاستعادة المبنية مسبقاً تحقّق ذلك دائماً، فلم يظهر الإنذار قط.
 *
 * يُعلَن التركيب من `src/lib/boot-guard.ts` (يُزيل الرسالة لو ظهرت ثم أقلع التطبيق).
 * وتُحفظ النتيجة في `localStorage["manar.bootguard.v1"]` ليقرأها اختبار المحاكي.
 */

/** أدنى إصدار Chrome لـ WebView يستطيع تشغيل الحزمة (دعم `<script type="module">`). */
export const MIN_WEBVIEW_CHROME = 61;

function manarBootGuard(MIN) {
  if (!Object.hasOwn) {
    Object.defineProperty(Object, "hasOwn", {
      value: function (o, k) {
        return Object.prototype.hasOwnProperty.call(Object(o), k);
      },
      writable: true,
      configurable: true,
    });
  }

  var KEY = "manar.bootguard.v1";
  var L = [];
  window.__manarBootLog = L;
  function save(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function now() {
    try {
      return Math.round(performance.now());
    } catch (e) {
      return 0;
    }
  }
  function rec(kind, msg, extra) {
    L.push({
      t: now(),
      kind: kind,
      msg: String(msg || "").slice(0, 600),
      extra: String(extra || "").slice(0, 600),
    });
    save("manar.bootlog.v1", JSON.stringify(L).slice(0, 8000));
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }
  function chromeMajor() {
    var m = /Chrome\/(\d+)/.exec(navigator.userAgent || "");
    return m ? parseInt(m[1], 10) : 0;
  }

  window.addEventListener(
    "error",
    function (e) {
      if (e.target && e.target !== window && e.target.src) {
        rec("asset", "تعذّر تحميل ملف", e.target.src);
        return;
      }
      rec("error", e.message, (e.filename || "") + ":" + (e.lineno || ""));
    },
    true
  );
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    rec("reject", r && r.message ? r.message : r, r && r.stack ? r.stack : "");
  });
  rec("boot", "بدأ تحميل الصفحة", "");

  var modules =
    typeof HTMLScriptElement !== "undefined" && "noModule" in HTMLScriptElement.prototype;

  function show(reason) {
    if (window.__manarMounted || document.getElementById("manar-boot-error")) return;
    var b = document.body;
    if (!b) return;
    var v = chromeMajor();
    var d = document.createElement("div");
    d.id = "manar-boot-error";
    d.setAttribute("dir", "rtl");
    d.setAttribute("data-reason", reason);
    d.style.cssText =
      "position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;overflow:auto;" +
      "padding:28px 20px;background:#0B1F1A;color:#F8F9FA;font:15px/1.9 sans-serif";
    var h;
    if (reason === "unsupported") {
      h =
        "<div style='font-size:21px;color:#C9A227;margin-bottom:10px'>حدّث متصفّح النظام لتشغيل منار</div>" +
        "<div style='opacity:.9;margin-bottom:14px'>متصفّح أندرويد المدمج (Android System WebView) على هذا الجهاز" +
        " قديم" +
        (v ? " (الإصدار " + v + ")" : "") +
        "، ومنار يحتاج الإصدار " +
        MIN +
        " أو أحدث.</div>" +
        "<div style='opacity:.85'>افتح متجر Play وابحث عن «Android System WebView» وحدّثه، ثم أعد فتح منار.</div>";
    } else {
      var rows = [];
      for (var i = 0; i < L.length; i++) if (L[i].kind !== "boot") rows.push(L[i]);
      h =
        "<div style='font-size:21px;color:#C9A227;margin-bottom:10px'>تعذّر تشغيل منار</div>" +
        "<div style='opacity:.85;margin-bottom:18px'>لم يبدأ التطبيق على هذا الجهاز. التفاصيل أدناه — صوّرها وأرسلها للمطوّر.</div>";
      if (rows.length) {
        var t = [];
        for (var j = 0; j < rows.length; j++) {
          var x = rows[j];
          t.push(x.t + "ms [" + x.kind + "] " + x.msg + (x.extra ? "\n   " + x.extra : ""));
        }
        h +=
          "<div style='font:12px/1.7 monospace;direction:ltr;text-align:left;background:rgba(0,0,0,.33);" +
          "border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-all'>" +
          esc(t.join("\n\n")) +
          "</div>";
      } else {
        h +=
          "<div style='opacity:.7'>لم يُسجَّل أي خطأ — الأرجح أن متصفّح أندرويد المدمج" +
          " (Android System WebView) قديم. حدّثه من متجر Play.</div>";
      }
    }
    h +=
      "<div style='margin-top:20px;opacity:.6;font-size:13px;direction:ltr;text-align:left'>" +
      esc(navigator.userAgent || "") +
      "</div>";
    d.innerHTML = h;
    b.appendChild(d);
    window.__manarBootGuard = reason;
    save(KEY, reason + " chrome=" + v);
  }

  if (!modules) {
    rec("unsupported", "WebView لا يدعم وحدات JavaScript", "Chrome/" + chromeMajor());
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        show("unsupported");
      });
    } else {
      show("unsupported");
    }
    return;
  }

  setTimeout(function () {
    try {
      if (!window.__manarMounted) show("timeout");
    } catch (e) {}
  }, 10000);
}

/** النصّ الجاهز للتشغيل (يُختبر في tests/unit/boot-guard.test.ts). */
export const BOOT_GUARD_JS = `(${manarBootGuard.toString()})(${MIN_WEBVIEW_CHROME});`;

/** الوسم الذي يُحقن قبل `</head>`. */
export const BOOT_GUARD = `<script>${BOOT_GUARD_JS}</script>`;
