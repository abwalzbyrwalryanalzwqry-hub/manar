#!/usr/bin/env python3
"""منار — مشغّل اختبار آلي على محاكي أندرويد عبر Chrome DevTools Protocol.

يقود واجهة التطبيق الحقيقية داخل WebView (نقرات فعلية على أزرار React)،
ويجمع الأدلة من adb (logcat، dumpsys notification، حالة العملية).

الاستخدام:  python3 driver.py <scenario> <evidence_dir>
  scenario = baseline  → إعادة إنتاج الانهيار فقط
  scenario = full      → كل مسارات الاختبار
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

import websocket  # websocket-client

PKG = os.environ.get("PKG", "app.manar.islamic")
SCENARIO = sys.argv[1] if len(sys.argv) > 1 else "full"
EVID = sys.argv[2] if len(sys.argv) > 2 else "evidence"
os.makedirs(EVID, exist_ok=True)
RESULTS = []


def sh(cmd, check=False, timeout=120):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    if check and r.returncode != 0:
        raise RuntimeError(f"{cmd}: {r.stderr}")
    return r.stdout.strip()


def adb(cmd, **kw):
    return sh(f"adb {cmd}", **kw)


def log(msg):
    print(msg, flush=True)
    with open(os.path.join(EVID, "run.log"), "a") as f:
        f.write(msg + "\n")


def record(name, ok, detail=""):
    RESULTS.append({"test": name, "ok": bool(ok), "detail": detail})
    log(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")


def shot(name):
    sh(f"adb exec-out screencap -p > {EVID}/{name}.png")


def alive():
    return adb(f"shell pidof {PKG}") != ""


def fatal_lines():
    out = adb("logcat -d -b crash -b main -b system")
    lines = [l for l in out.splitlines() if re.search(
        r"FATAL EXCEPTION|did not then call|ForegroundServiceDidNotStart|RemoteServiceException|ANR in", l)]
    return lines


class Page:
    def __init__(self):
        self.ws = None
        self.mid = 0

    def connect(self, tries=40):
        last = None
        for _ in range(tries):
            try:
                sock = ""
                unix = adb("shell cat /proc/net/unix")
                pid = adb(f"shell pidof {PKG}")
                names = re.findall(r"@(webview_devtools_remote_\d+)", unix)
                for n in names:
                    if pid and n.endswith("_" + pid.split()[0]):
                        sock = n
                if not sock and names:
                    sock = names[-1]
                if not sock:
                    raise RuntimeError("no devtools socket yet")
                sh("adb forward --remove-all")
                adb(f"forward tcp:9222 localabstract:{sock}", check=True)
                targets = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5))
                pages = [t for t in targets if t.get("type") == "page"]
                if not pages:
                    raise RuntimeError("no page target")
                self.ws = websocket.create_connection(pages[0]["webSocketDebuggerUrl"], timeout=30,
                                                      suppress_origin=True)
                return
            except Exception as e:  # noqa
                last = e
                time.sleep(2)
        raise RuntimeError(f"CDP connect failed: {last}")

    def ev(self, expr, timeout=30):
        self.mid += 1
        mid = self.mid
        self.ws.settimeout(timeout)
        self.ws.send(json.dumps({"id": mid, "method": "Runtime.evaluate", "params": {
            "expression": expr, "awaitPromise": True, "returnByValue": True}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                res = msg.get("result", {})
                if "exceptionDetails" in res:
                    raise RuntimeError(json.dumps(res["exceptionDetails"])[:800])
                return res.get("result", {}).get("value")

    def goto(self, path):
        try:
            self.ev(f"location.assign('{path}'); true", timeout=5)
        except Exception:
            pass
        time.sleep(4)
        self.connect()
        for _ in range(20):
            try:
                if self.ev("document.readyState") == "complete" and self.ev(
                        "document.body.innerText.length") > 20:
                    break
            except Exception:
                self.connect()
            time.sleep(1)
        time.sleep(2)


JS_HELPERS = r"""
window.__q = {
  btnByTitle(t){ return [...document.querySelectorAll('button')].find(b => {
      const s = b.querySelector('span.truncate'); return s && s.textContent.trim() === t; }); },
  previews(){ return [...document.querySelectorAll('button[aria-label^="تجربة نغمة"]')]; },
  toneRows(){ return this.previews().length ? [...document.querySelectorAll('button[aria-label^="تجربة نغمة"]')]
      .map(b => b.parentElement) : []; },
};
true
"""


def launch(page):
    adb(f"shell am start -n {PKG}/app.manar.islamic.MainActivity")
    time.sleep(8)
    page.connect()
    page.ev(JS_HELPERS)


def open_reminders(page, title="أذكار الصباح"):
    page.goto("/reminders")
    page.ev(JS_HELPERS)
    ok = page.ev(f"(() => {{ const b = __q.btnByTitle('{title}'); if (!b) return false; b.click(); return true; }})()")
    time.sleep(1.5)
    return ok


def crash_repro(page):
    """المسار الذي يسلكه المستخدم: التذكيرات ← أذكار الصباح ← الصوت ← تجربة نغمة."""
    adb("logcat -c")
    opened = open_reminders(page)
    record("reminders: فتح إعداد تذكير أذكار الصباح", opened)
    shot("reminders-open")
    n = page.ev("__q.previews().length")
    record("reminders: عدد أزرار تجربة النغمة", n and n > 0, f"n={n}")

    # نقرة معاينة واحدة
    try:
        page.ev("__q.previews()[0].click(); true", timeout=5)
    except Exception as e:  # الصفحة قد تموت مع العملية
        log(f"eval after click failed: {e}")
    time.sleep(4)
    a1 = alive()
    f1 = fatal_lines()
    record("crash: نقرة معاينة واحدة لا تُسقط التطبيق", a1 and not f1, "; ".join(f1[:3]))
    shot("after-first-preview")
    if not a1:
        return False

    # تبديل بين نغمتين
    try:
        page.ev("__q.previews()[1].click(); true", timeout=5)
    except Exception as e:
        log(f"eval failed: {e}")
    time.sleep(4)
    a2 = alive()
    f2 = fatal_lines()
    record("crash: التبديل إلى نغمة ثانية", a2 and not f2, "; ".join(f2[:3]))
    if not a2:
        return False

    # نقرات سريعة متتالية
    try:
        page.ev("""(async () => { const p = __q.previews();
            for (let i = 0; i < 16; i++) { p[i % p.length].click(); await new Promise(r => setTimeout(r, 70)); }
            return true; })()""", timeout=20)
    except Exception as e:
        log(f"eval failed: {e}")
    time.sleep(6)
    a3 = alive()
    f3 = fatal_lines()
    record("crash: ١٦ نقرة سريعة على المعاينة", a3 and not f3, "; ".join(f3[:3]))
    shot("after-rapid-taps")
    return a3


def main():
    adb("wait-for-device")
    adb(f"shell pm grant {PKG} android.permission.POST_NOTIFICATIONS")
    adb(f"shell appops set {PKG} SCHEDULE_EXACT_ALARM allow")
    page = Page()
    adb(f"shell am start -n {PKG}/app.manar.islamic.MainActivity")
    time.sleep(10)
    page.connect()
    page.ev("localStorage.setItem('manar.onboarded.v1','1'); localStorage.setItem('manar.native.reliabilityPromptDismissed','1'); true")
    page.ev(JS_HELPERS)

    ok = crash_repro(page)
    with open(os.path.join(EVID, "crash-logcat.txt"), "w") as f:
        f.write(adb("logcat -d -b crash -b main -b system"))

    if SCENARIO == "full":
        if not ok:
            # أعد التشغيل لتكمل بقية الاختبارات
            launch(page)
        import full_suite  # noqa
        full_suite.run(page, sys.modules[__name__])

    with open(os.path.join(EVID, "results.json"), "w") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    failed = [r for r in RESULTS if not r["ok"]]
    log(f"\n==== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ====")
    for r in failed:
        log(f"FAILED: {r['test']} {r['detail']}")


if __name__ == "__main__":
    main()
