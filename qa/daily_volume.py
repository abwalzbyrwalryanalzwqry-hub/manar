"""منار — اختبار آية اليوم وحديث اليوم ومستوى الأصوات على المحاكي (يُستدعى من driver.py)."""
import json
import re
import time

ADH = "manar.adhan-settings.v2"
REM = "manar.daily-reminders.v1"

H = r"""
window.__d = {
  cards(){
    const v=[...document.querySelectorAll('a[href*="/quran/mushaf"]')].find(a=>a.innerText.includes('﴿'));
    const hc=document.querySelector('.gradient-night.rounded-3xl');
    if(!v||!hc) return null;
    const card=v.closest('.rounded-3xl');
    return {chip:card.querySelector('.gradient-gold').innerText,
            dur:card.querySelector('.gradient-gold').nextElementSibling.innerText,
            verse:v.innerText.slice(0,40), href:v.getAttribute('href'),
            meaning:!!card.querySelector('p'),
            hlabel:hc.querySelector('.text-gold').innerText, hadith:hc.querySelector('p').innerText.slice(0,40)};
  },
  click(sel){ const b=document.querySelector(sel); if(!b) return false; b.click(); return true; },
  clickText(t){ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith(t)); if(!b) return false; b.click(); return true; },
  volCard(){ return [...document.querySelectorAll('div.rounded-2xl')].find(d=>d.querySelector(':scope > div > div')?.textContent.trim()==='مستوى الأصوات'); },
  setRange(i,v){ const c=this.volCard(); const e=c.querySelectorAll('input[type=range]')[i];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,String(v));
    e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true; },
  volBtn(t){ const c=this.volCard(); const b=[...c.querySelectorAll('button')].find(x=>x.innerText.trim()===t); if(!b) return null; if(b.disabled) return 'disabled'; b.click(); return 'clicked'; },
  ls(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } },
};
true
"""


def run(page, d):
    rec, log, adb, shot = d.record, d.log, d.adb, d.shot
    adb("root")
    time.sleep(4)
    adb("wait-for-device")
    adb("shell svc wifi disable")
    adb("shell svc data disable")
    adb("shell settings put global auto_time 0")
    log("daily/volume: offline, auto_time off")
    page.ev("localStorage.setItem('manar.askedLocation','1'); true")

    def home():
        page.goto("/home")
        for _ in range(25):
            try:
                page.ev(H)
                c = page.ev("__d.cards()")
                if c and "﴿" in c["verse"] and "«" in c["hadith"]:
                    return c
            except Exception:
                pass
            time.sleep(1)
        return None

    def set_local(y, mo, da, hh, mi):
        # ضبط ساعة الجهاز على وقت محلي محدد (المنطقة الزمنية للمحاكي)
        tz = adb("shell getprop persist.sys.timezone") or "UTC"
        adb(f"shell \"TZ={tz} date {mo:02d}{da:02d}{hh:02d}{mi:02d}{y}.00\"")
        time.sleep(2)

    def relaunch(kill=False):
        if kill:
            adb(f"shell am force-stop {d.PKG}")
            time.sleep(2)
        else:
            adb("shell input keyevent KEYCODE_HOME")
            time.sleep(3)
        adb(f"shell am start -n {d.PKG}/app.manar.islamic.MainActivity")
        time.sleep(8)
        page.connect()

    # ------------------------------------------------ آية اليوم / حديث اليوم
    set_local(2026, 9, 23, 10, 0)
    relaunch(kill=True)
    c1 = home()
    shot("daily-day1")
    rec("Daily: البطاقتان تعرضان محتوى حقيقياً بلا إنترنت", bool(c1) and c1["meaning"], json.dumps(c1, ensure_ascii=False))

    # اليوم التالي والتطبيق في الخلفية ثم يعود للواجهة (بلا إعادة تشغيل)
    set_local(2026, 9, 24, 9, 0)
    relaunch(kill=False)
    page.ev(H)
    time.sleep(2)
    c2 = page.ev("__d.cards()")
    rec("Daily: تتغيّر الآية عند عودة التطبيق في يوم جديد", bool(c1 and c2) and c2["chip"] != c1["chip"],
        f"{c1 and c1['chip']} -> {c2 and c2['chip']}")
    rec("Daily: يتغيّر الحديث عند عودة التطبيق في يوم جديد", bool(c1 and c2) and c2["hadith"] != c1["hadith"],
        f"{c1 and c1['hlabel']} -> {c2 and c2['hlabel']}")
    shot("daily-day2")

    # منتصف الليل والتطبيق مفتوح أمام المستخدم
    set_local(2026, 9, 24, 23, 59)
    relaunch(kill=True)
    before = home()
    time.sleep(75)
    page.ev(H)
    after = page.ev("__d.cards()")
    rec("Daily: التبدّل عند منتصف الليل والتطبيق مفتوح", bool(before and after) and after["chip"] != before["chip"],
        f"{before and before['chip']} -> {after and after['chip']}")

    # إعادة تشغيل كاملة في اليوم نفسه تعطي المحتوى نفسه (ثبات)
    set_local(2026, 9, 23, 18, 0)
    relaunch(kill=True)
    c1b = home()
    rec("Daily: اليوم نفسه يعطي الآية والحديث نفسيهما بعد إعادة التشغيل",
        bool(c1 and c1b) and c1b["chip"] == c1["chip"] and c1b["hadith"] == c1["hadith"],
        f"{c1b and c1b['chip']}")

    # الأزرار
    page.ev("__d.click('button[aria-label=\"حفظ الآية\"]')")
    time.sleep(1)
    bms = page.ev("Object.keys(localStorage).filter(k=>k.includes('bookmark')).map(k=>localStorage.getItem(k)).join('')")
    ref = re.search(r"surah=(\d+)&ayah=(\d+)", c1b["href"]) if c1b else None
    rec("Daily: زر الحفظ يضيف الآية إلى المحفوظات",
        bool(ref) and f'"id":"{ref.group(1)}:{ref.group(2)}"' in (bms or ""), (bms or "")[:120])
    pressed = page.ev("!!document.querySelector('button[aria-pressed=\"true\"]')")
    rec("Daily: زر الحفظ يعكس الحالة", pressed)

    page.ev("__d.clickText('اقرأ المزيد')")
    time.sleep(1.5)
    sheet = page.ev("(document.querySelector('[role=dialog][aria-label=\"حديث اليوم\"]')||{}).innerText||''")
    shot("daily-hadith-sheet")
    rec("Daily: «اقرأ المزيد» يفتح الحديث كاملاً بسنده ومصدره",
        "الرواية كاملة بسندها" in sheet and "حَدَّثَنَا" in sheet and "المصدر" in sheet, sheet[:80])
    page.ev("__d.click('[role=dialog] button[aria-label=\"إغلاق\"]')")
    time.sleep(1)

    page.ev("__d.clickText('استمع')")
    time.sleep(3)
    loc = page.ev("location.pathname+location.search")
    rec("Daily: «استمع» يفتح التلاوة على الآية نفسها", bool(ref) and loc == f"/quran/recitations?surah={ref.group(1)}&ayah={ref.group(2)}", loc)
    page.ev("history.back()")
    time.sleep(3)
    page.ev(H)
    page.ev("__d.click('button[aria-label=\"مشاركة الآية\"]')")
    time.sleep(3)
    loc = page.ev("location.pathname+location.search")
    rec("Daily: «مشاركة» يفتح بطاقة مشاركة الآية نفسها", bool(ref) and loc == f"/quran/share?surah={ref.group(1)}&ayah={ref.group(2)}", loc)
    rec("Daily: لا انهيار", d.alive() and not d.fatal_lines(), "; ".join(d.fatal_lines()[:3]))

    # ------------------------------------------------------ مستوى الأصوات
    adb("logcat -c")
    page.goto("/notifications")
    page.ev(H)
    for _ in range(15):
        if page.ev("!!__d.volCard()"):
            break
        time.sleep(1)
    page.ev("__d.volCard().scrollIntoView({block:'center'})")
    before_ls = page.ev(f"__d.ls('{ADH}')") or {}
    for i, v in enumerate([80, 50, 75, 50]):
        page.ev(f"__d.setRange({i},{v})")
    time.sleep(0.5)
    mid_ls = page.ev(f"__d.ls('{ADH}')") or {}
    rec("Volume: لا يُحفظ شيء قبل «تأكيد»", mid_ls.get("adhanVolume") == before_ls.get("adhanVolume"),
        f"{before_ls.get('adhanVolume')} / {mid_ls.get('adhanVolume')}")
    shot("volume-dirty")

    # التجربة تُشغَّل بالقيمة قيد الضبط فعلاً في المشغّل الأصلي
    page.ev("__d.click('button[aria-label=\"تجربة الأذان\"]')")
    time.sleep(3)
    page.ev("__d.click('button[aria-label=\"تجربة الأذان\"]')")
    time.sleep(1)
    page.ev("__d.click('button[aria-label=\"تجربة التنبيهات\"]')")
    time.sleep(3)
    lc = adb("logcat -d -s ManarAudio")
    plays = re.findall(r"play (\S+) volume=([\d.]+) usage=(\w+)", lc)
    log(f"ManarAudio: {plays}")
    rec("Volume/Native: تجربة الأذان بمستوى العام×الأذان (٠٫٤) على مسار المنبّه",
        any(abs(float(v) - 0.4) < 0.01 and u == "alarm" for _, v, u in plays), str(plays))
    rec("Volume/Native: تجربة التنبيهات بدرجتها (٠٫٤) على مسار الإشعارات",
        any(abs(float(v) - 0.4) < 0.01 and u == "notification" for _, v, u in plays), str(plays))
    adhan_raw = next((s for s, v, u in plays if u == "alarm"), "")

    r = page.ev("__d.volBtn('تأكيد')")
    time.sleep(6)  # مزامنة الجدولة بعد الحفظ
    st = page.ev(f"__d.ls('{ADH}')") or {}
    rec("Volume: «تأكيد» يحفظ القيم الأربع", r == "clicked" and [st.get(k) for k in
        ["volume", "adhanVolume", "iqamaVolume", "reminderVolume"]] == [0.8, 0.5, 0.75, 0.5],
        str([st.get(k) for k in ["volume", "adhanVolume", "iqamaVolume", "reminderVolume"]]))
    shot("volume-saved")
    prefs = adb(f"shell cat /data/data/{d.PKG}/shared_prefs/manar_volumes.xml")
    with open(f"{d.EVID}/manar_volumes.xml", "w") as f:
        f.write(prefs)
    fl = dict(re.findall(r'<float name="(\w+)" value="([\d.]+)"', prefs))
    rec("Volume/Native: المستويات محفوظة للخدمة الأصلية (تعمل والتطبيق مغلق)",
        fl.get("master") == "0.8" and fl.get("adhan") == "0.5" and fl.get("iqama") == "0.75", str(fl))

    # إلغاء يعيد المحفوظ
    page.ev("__d.setRange(1,20)")
    time.sleep(0.3)
    page.ev("__d.volBtn('إلغاء')")
    time.sleep(0.5)
    st2 = page.ev(f"__d.ls('{ADH}')") or {}
    val = page.ev("__d.volCard().querySelectorAll('input[type=range]')[1].value")
    rec("Volume: «إلغاء» يعيد القيمة المحفوظة ولا يحفظ التعديل", st2.get("adhanVolume") == 0.5 and val == "50", f"ls={st2.get('adhanVolume')} ui={val}")

    # الأذان والإقامة لحظة المنبّه والتطبيق مغلق: يقرآن المستوى المحفوظ
    adb(f"shell am force-stop {d.PKG}")
    time.sleep(2)
    adb("logcat -c")
    if adhan_raw:
        adb(f"shell am broadcast -n {d.PKG}/.AdhanAlarmReceiver -a app.manar.islamic.action.ADHAN_FIRE "
            f"--es sound {adhan_raw} --es title QA --es body QA --es kind adhan")
        time.sleep(5)
        adb(f"shell am broadcast -n {d.PKG}/.AdhanAlarmReceiver -a app.manar.islamic.action.ADHAN_FIRE "
            f"--es sound {adhan_raw} --es title QA --es body QA --es kind iqama")
        time.sleep(5)
    lc = adb("logcat -d -s ManarAudio")
    fired = re.findall(r"play (\S+) volume=([\d.]+) usage=(\w+)", lc)
    log(f"alarm fire: {fired}")
    rec("Volume/Native: أذان المنبّه (تطبيق مغلق) بمستوى ٠٫٤", any(abs(float(v) - 0.4) < 0.01 for _, v, _u in fired[:1]), str(fired))
    rec("Volume/Native: إقامة المنبّه (تطبيق مغلق) بمستوى ٠٫٦", len(fired) > 1 and abs(float(fired[1][1]) - 0.6) < 0.01, str(fired))
    adb(f"shell am startservice -n {d.PKG}/.AdhanService -a app.manar.islamic.action.STOP")
    time.sleep(2)
    rec("Volume: لا انهيار في المنبّه", not d.fatal_lines(), "; ".join(d.fatal_lines()[:3]))

    # قنوات الإشعار بالدرجة المختارة: العام ٠٫٨ × التنبيهات ٠٫٥ = ٠٫٤ ← الدرجة ٤٠
    relaunch(kill=True)
    page.goto("/notifications")
    time.sleep(6)
    chans = adb("shell dumpsys notification --noredact")
    ch = dict(re.findall(r"NotificationChannel\{mId='(manar_[a-z0-9_]+)'.*?mSound=([^,]+)", chans))
    with open(f"{d.EVID}/channels-volume.txt", "w") as f:
        f.write("\n".join(f"{a}\t{b}" for a, b in sorted(ch.items())))
    v40 = {k: s for k, s in ch.items() if k.endswith("_v40")}
    rec("Volume/Channels: قنوات الدرجة ٤٠ للأذكار والوِرد بأصواتها المخفّضة",
        ch.get("manar_azkar_azkar_morning_01_v40", "").endswith("/raw/azkar_morning_01_v40"), ch.get("manar_azkar_azkar_morning_01_v40", "missing"))
    rec("Volume/Channels: قنوات الدرجة ٤٠ لاقتراب الصلاة والتكبير",
        all(ch.get(f"manar_approach_approach_{p}_v40", "").endswith(f"/raw/approach_{p}_v40") for p in ["fajr", "dhuhr", "asr", "maghrib", "isha"])
        and ch.get("manar_reminders_v40", "").endswith("/raw/segment_takbir_v40"), f"n={len(v40)}")
    rec("Volume/Channels: القنوات الأصلية كما هي",
        ch.get("manar_reminders", "").endswith("/raw/segment_takbir") and "manar_adhan" in ch and
        ch.get("manar_azkar_azkar_morning_01", "").endswith("/raw/azkar_morning_01"))

    # إشعار تذكير يصل فعلاً على قناة الدرجة
    t_daily = page.ev(f"""(() => {{ const d=new Date(Date.now()+3*60000); d.setSeconds(0,0);
        const s=JSON.parse(localStorage.getItem('{REM}'))||{{enabled:true,items:[]}};
        s.items=s.items.map(i=> i.id==='azkar-morning' ? {{...i, enabled:true, tone:'azkar-morning-01', days:[0,1,2,3,4,5,6], timing:{{mode:'clock',hour:d.getHours(),minute:d.getMinutes()}}}} : i);
        s.enabled=true; localStorage.setItem('{REM}', JSON.stringify(s)); window.dispatchEvent(new Event('manar:daily-reminders'));
        return d.getTime(); }})()""")
    time.sleep(8)
    adb(f"shell am force-stop {d.PKG}")
    adb(f"shell date -u {time.strftime('%m%d%H%M%Y.%S', time.gmtime((t_daily - 20000) / 1000))}")
    time.sleep(50)
    dump = adb("shell dumpsys notification --noredact")
    posted = re.findall(r"NotificationRecord\(0x[0-9a-f]+: pkg=app\.manar\.islamic user=\S+ id=(\d+) tag=\S+ .*?Notification\(channel=([a-z0-9_]*)", dump)
    daily = [c for i, c in posted if 141000 <= int(i) < 241000]
    rec("Volume/Notification: تذكير الأذكار وصل على قناة الدرجة ٤٠ (والتطبيق مغلق)",
        "manar_azkar_azkar_morning_01_v40" in daily, str(sorted(set(daily))))

    # تغيير الدرجة يحذف قنوات الدرجة السابقة ويُنشئ الجديدة
    relaunch(kill=True)
    page.goto("/notifications")
    page.ev(H)
    for _ in range(15):
        if page.ev("!!__d.volCard()"):
            break
        time.sleep(1)
    page.ev("__d.setRange(3,100)")  # 0.8 × 1.0 = 80
    page.ev("__d.volBtn('تأكيد')")
    time.sleep(8)
    chans = adb("shell dumpsys notification --noredact")
    ids = set(re.findall(r"NotificationChannel\{mId='(manar_[a-z0-9_]+)'", chans))
    deleted = adb("shell dumpsys notification --noredact | grep -c \"mDeleted=true\"")
    live40 = [i for i in ids if i.endswith("_v40")]
    rec("Volume/Channels: الدرجة الجديدة ٨٠ أُنشئت", "manar_reminders_v80" in ids and "manar_azkar_azkar_morning_01_v80" in ids)
    rec("Volume/Channels: قنوات الدرجة القديمة ٤٠ حُذفت", not live40 or deleted not in ("", "0"), f"live40={len(live40)} deleted={deleted}")

    # مستخدم قديم لم يحرّك المؤشر (٠٫٧): يُرفع إلى ١٠٠٪ ولا يخفت أذانه
    page.ev(f"""(()=>{{ const s=JSON.parse(localStorage.getItem('{ADH}')); delete s.adhanVolume; delete s.iqamaVolume; delete s.reminderVolume; s.volume=0.7;
        localStorage.setItem('{ADH}', JSON.stringify(s)); return true; }})()""")
    page.goto("/notifications")
    page.ev(H)
    time.sleep(2)
    vals = page.ev("[...__d.volCard().querySelectorAll('input[type=range]')].map(e=>e.value)")
    rec("Volume/Migration: الإعداد القديم الافتراضي (٧٠٪) يظهر ١٠٠٪", vals == ["100", "100", "100", "100"], str(vals))
    # إعادة المستويات إلى ١٠٠٪ حتى تجري بقية الاختبارات على القنوات الأصلية
    page.ev(f"""(()=>{{ const s=JSON.parse(localStorage.getItem('{ADH}')); Object.assign(s,{{volume:1,adhanVolume:1,iqamaVolume:1,reminderVolume:1}});
        localStorage.setItem('{ADH}', JSON.stringify(s)); window.dispatchEvent(new CustomEvent('manar:adhan-settings')); return true; }})()""")
    time.sleep(6)
    rec("لا انهيار طوال اختبار الميزات الجديدة", d.alive() and not d.fatal_lines(), "; ".join(d.fatal_lines()[:3]))
    adb("shell settings put global auto_time 1")
