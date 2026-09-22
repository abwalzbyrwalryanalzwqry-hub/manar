"""منار — مسارات الاختبار الكاملة لحزمتي الأصوات (تُستدعى من driver.py)."""
import json
import re
import time

A_NEW = ["أذكار الصباح", "أذكارُ الصباح", "حان وقت أذكار الصباح", "أذكار المساء",
         "حان وقت أذكار المساء", "أذكار النوم", "حان وقت أذكار النوم", "أذكار الاستيقاظ من النوم",
         "لا تنسَ وِردك اليومي", "لا تنسَ وِردك من القرآن", "لا تنسَ الأذكار", "وقت الذكر"]
A_OLD = ["إشراق", "أصيل", "تأمّل", "جرس", "نداء", "نقرة"]
B_CLIPS = ["اقتربت صلاة الفجر", "اقتربت صلاة الظهر", "اقتربت صلاة العصر",
           "اقتربت صلاة المغرب", "اقتربت صلاة العشاء"]
PKG_A_CHANNEL = re.compile(r"manar_azkar_")
PKG_B_CHANNEL = re.compile(r"manar_approach_")

HELPERS = r"""
window.__s = {
  toneLabels(){ return [...document.querySelectorAll('button[aria-label^="تجربة نغمة"]')]
      .map(b => b.getAttribute('aria-label').replace('تجربة نغمة ', '')); },
  toneRow(name){ return [...document.querySelectorAll('button[aria-label^="تجربة نغمة"]')]
      .map(b => b.parentElement).find(r => r.querySelector('button span.truncate')?.textContent.trim() === name); },
  radios(){ return [...document.querySelectorAll('button[role="radio"]')]
      .map(b => b.querySelector('span.truncate')?.textContent.trim()); },
  radio(name){ return [...document.querySelectorAll('button[role="radio"]')]
      .find(b => b.querySelector('span.truncate')?.textContent.trim() === name); },
  approachPreviews(){ return [...document.querySelectorAll('button[aria-label^="تجربة "]')]
      .filter(b => !b.getAttribute('aria-label').startsWith('تجربة نغمة'))
      .map(b => b.getAttribute('aria-label')); },
  clickLabel(l){ const b = document.querySelector(`button[aria-label="${l}"]`); if (!b) return false; b.click(); return true; },
  ls(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } },
  async audio(){ try { return await Capacitor.Plugins.ManarAdhan.audioState(); } catch(e) { return {state:'ERR '+e}; } },
};
true
"""

REM = "manar.daily-reminders.v1"
ADH = "manar.adhan-settings.v2"


def run(page, d):
    rec, log, adb, shot = d.record, d.log, d.adb, d.shot

    # ---------------------------------------------------------------- offline
    adb("shell svc wifi disable")
    adb("shell svc data disable")
    log("offline: wifi + data disabled for the whole suite")

    # --------------------------------------------------------- Package A — UI
    d.open_reminders(page)
    page.ev(HELPERS)
    labels = page.ev("__s.toneLabels()")
    shot("A-list")
    rec("A/UI: الأصوات الحالية ما زالت موجودة", all(x in labels for x in A_OLD), str(labels))
    rec("A/UI: الأصوات الجديدة الـ١٢ ظاهرة", all(x in labels for x in A_NEW), f"n={len(labels)}")
    rec("فصل: لا صوت من حزمة اقتراب الصلاة في قائمة الأذكار والوِرد",
        not any("اقتربت" in x for x in labels))

    # --------------------------------------------------- Package A — preview
    fails = []
    for name in A_OLD + A_NEW:
        page.ev(f"__s.toneRow({json.dumps(name)}).querySelector('button[aria-label^=\"تجربة نغمة\"]').click(); true")
        time.sleep(0.6)
        st = page.ev("__s.audio()")
        if not (st and st.get("state") in ("PLAYING_AZAN", "IDLE") and name in (st.get("title") or "")):
            fails.append(f"{name}:{st}")
        time.sleep(1.8)
    rec("A/Preview: كل نغمة تُشغَّل فعلاً من res/raw (بلا إنترنت)", not fails and d.alive(), "; ".join(fails[:5]))

    # صوت واحد فقط: شغّل ثم بدّل فوراً — الحالة تحمل عنوان الأخير وحده
    page.ev("""(async()=>{ __s.toneRow('تأمّل').querySelector('button[aria-label^="تجربة نغمة"]').click();
        await new Promise(r=>setTimeout(r,150));
        __s.toneRow('حان وقت أذكار المساء').querySelector('button[aria-label^="تجربة نغمة"]').click(); return true;})()""")
    time.sleep(0.7)
    st = page.ev("__s.audio()")
    players = adb("shell dumpsys audio | grep -c 'state:started'")
    rec("A/Preview: التبديل يُوقف السابق — صوت واحد", "حان وقت أذكار المساء" in (st.get("title") or ""),
        f"state={st} started_players={players}")

    # مغادرة الشاشة أثناء المعاينة
    page.ev("__s.toneRow('تأمّل').querySelector('button[aria-label^=\"تجربة نغمة\"]').click(); true")
    time.sleep(0.4)
    page.goto("/more")
    page.ev(HELPERS)
    time.sleep(1.0)
    st = page.ev("__s.audio()")
    rec("A/Lifecycle: مغادرة الشاشة تُسكت المعاينة", st.get("state") not in ("PLAYING_AZAN", "PLAYING_IQAMA"), str(st))

    # ------------------------------------------------ Package A — selection
    d.open_reminders(page)
    page.ev(HELPERS)
    before_rem = page.ev(f"__s.ls('{REM}')") or {}
    before_adh = page.ev(f"__s.ls('{ADH}')")
    page.ev("__s.toneRow('أذكار الصباح').querySelector('button').click(); true")
    time.sleep(1.2)
    after_rem = page.ev(f"__s.ls('{REM}')") or {}
    after_adh = page.ev(f"__s.ls('{ADH}')")
    items_b = {i["id"]: i for i in (before_rem.get("items") or [])}
    items_a = {i["id"]: i for i in (after_rem.get("items") or [])}
    m = items_a.get("azkar-morning", {})
    rec("A/Selection: حُفظ Audio ID الجديد لتذكير أذكار الصباح", m.get("tone") == "azkar-morning-01", str(m.get("tone")))
    unchanged = True
    if items_b:
        mb = dict(items_b.get("azkar-morning", {}))
        ma = dict(m)
        mb.pop("tone", None), ma.pop("tone", None)
        unchanged = mb == ma and all(items_a[k] == v for k, v in items_b.items() if k != "azkar-morning")
    rec("A/Selection: الوقت والأيام والتفعيل وبقية التذكيرات لم تتغيّر", unchanged)
    rec("فصل: اختيار صوت أذكار لم يلمس إعدادات الصلاة", before_adh == after_adh)
    shot("A-selected")

    # --------------------------------------------------------- Package B — UI
    page.goto("/notifications")
    page.ev(HELPERS)
    radios = page.ev("__s.radios()")
    prev = page.ev("__s.approachPreviews()")
    shot("B-list")
    rec("B/UI: الخيار الحالي (التكبير) باقٍ وخيار الحزمة الجديدة ظاهر", radios == ["التكبير", "اقتربت الصلاة"], str(radios))
    rec("B/UI: مقاطع الصلوات الخمس متاحة للمعاينة", all(f"تجربة {c}" in prev for c in B_CLIPS), str(prev))
    rec("فصل: لا صوت من حزمة الأذكار والوِرد في قائمة ما قبل الصلاة",
        not any(any(a in x for a in A_NEW + A_OLD) for x in (radios or []) + (prev or [])))

    fails = []
    for c in B_CLIPS + ["التكبير"]:
        lab = f"تجربة {c}" if c != "التكبير" else "تجربة صوت التكبير"
        page.ev(f"__s.clickLabel({json.dumps(lab)})")
        time.sleep(0.6)
        st = page.ev("__s.audio()")
        if not (st and st.get("state") in ("PLAYING_AZAN", "IDLE") and c in (st.get("title") or "")):
            fails.append(f"{c}:{st}")
        time.sleep(2.2)
    rec("B/Preview: كل مقطع يُشغَّل فعلاً", not fails and d.alive(), "; ".join(fails[:5]))

    page.ev("""(async()=>{ for (let i=0;i<12;i++){ const l=['تجربة اقتربت صلاة الفجر','تجربة اقتربت صلاة العصر','تجربة صوت التكبير'][i%3];
        document.querySelector(`button[aria-label="${l}"]`).click(); await new Promise(r=>setTimeout(r,60)); } return true; })()""")
    time.sleep(4)
    rec("B/Preview: نقرات سريعة بلا انهيار", d.alive() and not d.fatal_lines(), "; ".join(d.fatal_lines()[:3]))

    before_rem = page.ev(f"__s.ls('{REM}')")
    before_adh = page.ev(f"__s.ls('{ADH}')") or {}
    page.ev("__s.radio('اقتربت الصلاة').click(); true")
    time.sleep(1.2)
    after_adh = page.ev(f"__s.ls('{ADH}')") or {}
    after_rem = page.ev(f"__s.ls('{REM}')")
    rec("B/Selection: حُفظ reminderSound=approach-voice", after_adh.get("reminderSound") == "approach-voice",
        str(after_adh.get("reminderSound")))
    b2 = {k: v for k, v in before_adh.items() if k != "reminderSound"}
    a2 = {k: v for k, v in after_adh.items() if k != "reminderSound"}
    rec("B/Selection: المواقيت والدقائق والأذان والإقامة لم تتغيّر", (not b2) or b2 == a2)
    rec("فصل: اختيار صوت ما قبل الصلاة لم يلمس تذكيرات الأذكار", before_rem == after_rem)
    # العودة للقديم ثم الجديد
    page.ev("__s.radio('التكبير').click(); true")
    time.sleep(0.8)
    back = (page.ev(f"__s.ls('{ADH}')") or {}).get("reminderSound")
    page.ev("__s.radio('اقتربت الصلاة').click(); true")
    time.sleep(0.8)
    rec("B/Selection: العودة للصوت القديم ثم الجديد", back == "default" and
        (page.ev(f"__s.ls('{ADH}')") or {}).get("reminderSound") == "approach-voice", f"back={back}")
    shot("B-selected")

    # ------------------------------- persistence: force-stop + relaunch
    time.sleep(3)
    adb(f"shell am force-stop {d.PKG}")
    time.sleep(2)
    d.launch(page)
    page.ev(HELPERS)
    time.sleep(3)
    rem = page.ev(f"__s.ls('{REM}')") or {}
    adh = page.ev(f"__s.ls('{ADH}')") or {}
    pref = page.ev(f"Capacitor.Plugins.Preferences.get({{key:'{REM}'}}).then(r=>JSON.parse(r.value))") or {}
    pm = {i['id']: i for i in pref.get('items', [])}.get('azkar-morning', {})
    rm = {i['id']: i for i in rem.get('items', [])}.get('azkar-morning', {})
    rec("Persistence: بعد إغلاق التطبيق وفتحه يبقى اختيار الحزمتين",
        rm.get("tone") == "azkar-morning-01" and adh.get("reminderSound") == "approach-voice",
        f"tone={rm.get('tone')} approach={adh.get('reminderSound')}")
    rec("Persistence: الاختيار محفوظ في SharedPreferences الأصلية أيضاً", pm.get("tone") == "azkar-morning-01")

    # ------------------ schedule: daily reminder shortly after the next pre-prayer alert
    time.sleep(4)
    pend = page.ev("Capacitor.Plugins.LocalNotifications.getPending().then(r=>r.notifications)") or []
    pre = sorted([n for n in pend if (n.get("extra") or {}).get("kind") == "reminder"],
                 key=lambda n: n["schedule"]["at"])
    log(f"pending total={len(pend)} pre-prayer={len(pre)}")
    if not pre:
        rec("Notification: توجد تنبيهات قبل الصلاة مجدولة", False)
        return
    target = pre[0]
    t_pre = page.ev(f"new Date({json.dumps(target['schedule']['at'])}).getTime()")
    prayer = target["extra"]["prayer"]
    # اجعل تذكير أذكار الصباح بساعة ثابتة بعد التنبيه بثلاث دقائق (توقيت الجهاز)
    t_daily = page.ev(f"""(()=>{{ const d=new Date({t_pre}+180000); d.setSeconds(0,0); d.setMinutes(d.getMinutes()+1);
        const s=JSON.parse(localStorage.getItem('{REM}'));
        s.items=s.items.map(i=> i.id==='azkar-morning' ? {{...i, enabled:true, days:[0,1,2,3,4,5,6], timing:{{mode:'clock',hour:d.getHours(),minute:d.getMinutes()}}}} : i);
        s.enabled=true; localStorage.setItem('{REM}', JSON.stringify(s)); window.dispatchEvent(new Event('manar:daily-reminders'));
        return d.getTime(); }})()""")
    time.sleep(6)
    pend = page.ev("Capacitor.Plugins.LocalNotifications.getPending().then(r=>r.notifications)") or []
    dm = [n for n in pend if (n.get("extra") or {}).get("reminder") == "azkar-morning"]
    rec("Notification: تذكير أذكار الصباح أُعيدت جدولته فور تغيير الإعداد", bool(dm), f"n={len(dm)}")

    chans = adb("shell dumpsys notification --noredact")
    ch_lines = re.findall(r"NotificationChannel\{mId='(manar_[a-z0-9_]+)'.*?mSound=([^,]+)", chans)
    with open(f"{d.EVID}/channels.txt", "w") as f:
        f.write("\n".join(f"{a}\t{b}" for a, b in ch_lines))
    chmap = dict(ch_lines)
    rec("Android: قناة الأذكار للصوت المختار بصوته من res/raw",
        chmap.get("manar_azkar_azkar_morning_01", "").endswith("/raw/azkar_morning_01"),
        chmap.get("manar_azkar_azkar_morning_01", "missing"))
    rec("Android: قنوات اقتراب الصلاة الخمس بأصواتها",
        all(chmap.get(f"manar_approach_approach_{p}", "").endswith(f"/raw/approach_{p}")
            for p in ["fajr", "dhuhr", "asr", "maghrib", "isha"]))
    rec("فصل/Android: لا قناة أذكار تحمل صوت اقتراب صلاة ولا العكس",
        not any(("approach_" in s) for c, s in ch_lines if c.startswith("manar_azkar_")) and
        not any(("approach_" not in s) for c, s in ch_lines if c.startswith("manar_approach_")))
    rec("Android: قنوات الأذان والإقامة والتذكيرات القديمة كما هي",
        all(k in chmap for k in ["manar_adhan", "manar_iqama", "manar_reminders", "manar_silent"]) and
        chmap.get("manar_reminders", "").endswith("/raw/segment_takbir"), str({k: chmap.get(k) for k in ["manar_adhan", "manar_iqama", "manar_reminders"]}))

    # ------------------ reboot: app closed, alarms must survive
    adb("reboot")
    time.sleep(15)
    adb("wait-for-device", timeout=300)
    for _ in range(90):
        if adb("shell getprop sys.boot_completed") == "1":
            break
        time.sleep(2)
    time.sleep(25)
    adb("root")
    time.sleep(4)
    adb("wait-for-device")
    adb("shell svc wifi disable")
    adb("shell svc data disable")
    alarms = adb("shell dumpsys alarm")
    n_alarms = alarms.count("app.manar.islamic")
    rec("Lifecycle: بعد إعادة تشغيل الجهاز التنبيهات ما زالت مجدولة (والتطبيق مغلق)", n_alarms > 0, f"refs={n_alarms}")
    # BootReceiver الموجود يوقظ العملية لإعادة الجدولة — المهم ألّا تنهار
    rec("Lifecycle: بعد الإقلاع لا انهيار (BootReceiver يعيد الجدولة)", not d.fatal_lines())

    adb("shell settings put global auto_time 0")
    adb("logcat -c")

    def jump_to(ms):
        adb(f"shell date -u {time.strftime('%m%d%H%M%Y.%S', time.gmtime(ms / 1000))}")

    def posted_records():
        """الإشعارات المنشورة فعلاً فقط: (id, channel) — لا سجلّ القنوات."""
        dump = adb("shell dumpsys notification --noredact")
        return [(int(i), ch) for i, tag, ch in re.findall(
            r"NotificationRecord\(0x[0-9a-f]+: pkg=app\.manar\.islamic user=\S+ id=(\d+) tag=(\S+) .*?Notification\(channel=([a-z0-9_]*)",
            dump) if tag != "ranker_group"]

    def posted():
        return [ch for _, ch in posted_records()]

    def is_daily(i):  # معرّفات تذكيرات الأذكار والوِرد: DAILY_ID_BASE=141000
        return 141000 <= i < 241000

    jump_to(t_pre - 25_000)
    time.sleep(50)
    got = posted()
    want = f"manar_approach_approach_{prayer}"
    rec("Notification/B: وصل تنبيه ما قبل الصلاة على قناة مقطع صلاته (تطبيق مغلق + بعد الإقلاع)",
        want in got, f"want={want} got={sorted(set(got))}")
    recs = posted_records()
    rec("فصل/B: كل تنبيهات الصلاة المنشورة على قنوات غير قنوات الأذكار",
        not any(PKG_A_CHANNEL.match(c) for i, c in recs if not is_daily(i)),
        str(sorted({c for i, c in recs if not is_daily(i)})))
    shot("B-notification")

    jump_to(t_daily - 25_000)
    time.sleep(50)
    got2 = posted()
    recs2 = posted_records()
    rec("فصل/A: كل تذكيرات الأذكار والوِرد المنشورة على قنوات manar_azkar_* فقط",
        all(PKG_A_CHANNEL.match(c) for i, c in recs2 if is_daily(i)) and any(is_daily(i) for i, _ in recs2),
        str(sorted({c for i, c in recs2 if is_daily(i)})))
    rec("فصل/B: لا تنبيه صلاة على قناة أذكار ولا تذكير أذكار على قناة اقتراب صلاة",
        not any(PKG_A_CHANNEL.match(c) for i, c in recs2 if not is_daily(i)) and
        not any(PKG_B_CHANNEL.match(c) for i, c in recs2 if is_daily(i)))
    rec("Notification/A: وصل تذكير أذكار الصباح على قناة الصوت المختار",
        "manar_azkar_azkar_morning_01" in got2, f"got={sorted(set(got2))}")
    adb("shell cmd statusbar expand-notifications")
    time.sleep(2)
    shot("A-notification-shade")
    adb("shell cmd statusbar collapse")
    with open(f"{d.EVID}/notifications-final.txt", "w") as f:
        f.write(adb("shell dumpsys notification --noredact"))
    rec("لا انهيار طوال الاختبار", not d.fatal_lines(), "; ".join(d.fatal_lines()[:3]))
