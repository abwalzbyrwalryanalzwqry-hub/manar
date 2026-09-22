#!/usr/bin/env python3
"""منار — اختبار التحديث فوق النسخة السابقة (main) دون حذف البيانات.

الاستخدام: python3 upgrade.py <old.apk> <new.apk> <evidence_dir>
كلا الملفين موقَّعان بالمفتاح نفسه (بُنيا في المهمة نفسها) كي يقبل أندرويد التحديث.
"""
import json
import re
import sys
import time

OLD, NEW, EVID = sys.argv[1], sys.argv[2], sys.argv[3]
sys.argv = ["driver.py", "upgrade", EVID]
import driver as d  # noqa: E402

REM, ADH = "manar.daily-reminders.v1", "manar.adhan-settings.v2"
A_OLD = ["إشراق", "أصيل", "تأمّل", "جرس", "نداء", "نقرة"]


def channels():
    dump = d.adb("shell dumpsys notification --noredact")
    out = {}
    for m in re.finditer(r"NotificationChannel\{mId='(manar_[a-z0-9_]+)'.*?mSound=([^,]+)", dump):
        out[m.group(1)] = m.group(2)
    return out


def read_state(page):
    return page.ev(f"""(async () => {{
        const P = Capacitor.Plugins.Preferences;
        const pr = async k => {{ try {{ return (await P.get({{key:k}})).value; }} catch(e) {{ return 'ERR'; }} }};
        return {{ rem: localStorage.getItem('{REM}'), adh: localStorage.getItem('{ADH}'),
                 prefRem: await pr('{REM}'), prefAdh: await pr('{ADH}') }};
    }})()""")


def main():
    rec, log, adb = d.record, d.log, d.adb
    adb("wait-for-device")
    log(adb(f"install {OLD}"))
    adb(f"shell pm grant {d.PKG} android.permission.POST_NOTIFICATIONS")
    adb(f"shell appops set {d.PKG} SCHEDULE_EXACT_ALARM allow")
    page = d.Page()
    adb(f"shell am start -n {d.PKG}/app.manar.islamic.MainActivity")
    time.sleep(10)
    page.connect()
    page.ev("localStorage.setItem('manar.onboarded.v1','1'); "
            "localStorage.setItem('manar.native.reliabilityPromptDismissed','1'); true")
    page.ev(d.JS_HELPERS)

    # استخدام النسخة القديمة كما يفعل المستخدم: اختيار نغمة «جرس» لأذكار المساء
    d.open_reminders(page, "أذكار المساء")
    picked = page.ev("""(() => { const row = __q.toneRows().find(r =>
        r.querySelector('button span.truncate')?.textContent.trim() === 'جرس');
        if (!row) return false; row.querySelector('button').click(); return true; })()""")
    time.sleep(1)
    # وتفعيل تذكير ١٠ دقائق قبل الصلاة
    page.goto("/notifications")
    page.ev("""(() => { const b = [...document.querySelectorAll('button')].find(x =>
        /^\\s*(10|١٠)\\s*دقيقة/.test(x.innerText)); if (b) b.click(); return !!b; })()""")
    time.sleep(3)
    before = read_state(page)
    ch_before = channels()
    d.shot("upgrade-old")
    rec("upgrade: النسخة القديمة تعمل ويُحفظ الاختيار", picked and before["rem"], "")
    with open(f"{EVID}/upgrade-before.json", "w") as f:
        json.dump({"state": before, "channels": ch_before}, f, ensure_ascii=False, indent=1)

    # التحديث فوق النسخة القديمة (بلا حذف بيانات)
    adb("logcat -c")
    out = adb(f"install -r {NEW}")
    rec("upgrade: adb install -r نجح", "Success" in out, out[-200:])
    adb(f"shell am start -n {d.PKG}/app.manar.islamic.MainActivity")
    time.sleep(10)
    page.connect()
    page.ev(d.JS_HELPERS)
    time.sleep(4)
    after = read_state(page)
    ch_after = channels()
    with open(f"{EVID}/upgrade-after.json", "w") as f:
        json.dump({"state": after, "channels": ch_after}, f, ensure_ascii=False, indent=1)

    rb, ra = json.loads(before["rem"]), json.loads(after["rem"])
    rec("upgrade: إعدادات التذكيرات لم تتغيّر إطلاقاً (وقت/تكرار/تفعيل/نغمة)", rb == ra)
    ev = next(i for i in ra["items"] if i["id"] == "azkar-evening")
    rec("upgrade: النغمة القديمة المختارة (جرس) باقية", ev["tone"] == "reminder-bell", ev["tone"])
    ab, aa = json.loads(before["adh"]), json.loads(after["adh"])
    same = {k: v for k, v in aa.items() if k != "reminderSound"} == {k: v for k, v in ab.items() if k != "reminderSound"}
    rec("upgrade: إعدادات الأذان والإقامة وقبل الصلاة لم تتغيّر", same)
    rec("upgrade: صوت قبل الصلاة يبدأ بالافتراضي (التكبير) كما كان",
        aa.get("reminderSound", "default") == "default", str(aa.get("reminderSound")))
    rec("upgrade: نسخة Preferences الأصلية سليمة", after["prefRem"] == before["prefRem"] or after["prefRem"] == after["rem"])

    lost = {k: v for k, v in ch_before.items() if ch_after.get(k) != v}
    rec("upgrade: كل القنوات القديمة باقية بالصوت نفسه (أذان/إقامة/تذكير/صامت...)", not lost, json.dumps(lost))
    new_a = [k for k in ch_after if k.startswith("manar_azkar_")]
    new_b = [k for k in ch_after if k.startswith("manar_approach_")]
    rec("upgrade: قنوات الحزمة الأولى أُنشئت (١٨)", len(new_a) == 18, str(len(new_a)))
    rec("upgrade: قنوات الحزمة الثانية أُنشئت (٥)", len(new_b) == 5, str(len(new_b)))
    rec("upgrade: قنوات A تشير لأصوات A وقنوات B لأصوات B فقط",
        all("approach" not in ch_after[k] for k in new_a) and all("approach_" in ch_after[k] for k in new_b))

    d.open_reminders(page, "أذكار المساء")
    labels = page.ev("__q.previews().map(b => b.getAttribute('aria-label'))")
    rec("upgrade: الأصوات القديمة لا تختفي بعد التحديث", all(f"تجربة نغمة {x}" in labels for x in A_OLD), str(len(labels)))
    d.shot("upgrade-new")
    f = d.fatal_lines()
    rec("upgrade: بلا انهيار", d.alive() and not f, "; ".join(f[:3]))

    with open(f"{EVID}/results.json", "w") as fh:
        json.dump(d.RESULTS, fh, ensure_ascii=False, indent=2)
    failed = [r for r in d.RESULTS if not r["ok"]]
    log(f"\n==== {len(d.RESULTS) - len(failed)}/{len(d.RESULTS)} passed ====")


if __name__ == "__main__":
    main()
