#!/usr/bin/env bash
# منار — اختبار منظومة الأذان والإقامة والتنبيهات على محاكي أندرويد حقيقي.
#
# يُشغَّل من .github/workflows/android-runtime-test.yml داخل المحاكي:
#   bash scripts/android-runtime-test.sh <debug.apk> <release.apk> <out-dir>
#
# كل الاختبارات تجري ووضع الطيران مفعّل (بلا إنترنت)، والتطبيق مقتول
# (am kill — كما يفعل النظام، لا «إيقاف إجباري»)، والشاشة مطفأة.
#
#   أ) نسخة التصحيح (المستقبِل الاختباري + الشيفرة الأصلية نفسها):
#      ١. فكّ كامل وتشغيل لكل تسجيلات الإقامة الـ١٩ من res/raw.
#      ٢. تدفّق: أذان ← تنبيه قبل الإقامة ← إقامة، ومنع التكرار، وصوت واحد فقط.
#      ٣. إعادة الضبط بالمفاتيح نفسها بعد إطلاقها: لا يُطلق شيء مرّتين.
#      ٤. مورد مفقود: لا انهيار، لا صوت بديل، إشعار مكتوب.
#      ٤ب. الإيقاف السريع دون فتح التطبيق: زرّ الصوت وزرّ التشغيل، والشاشة
#          مضاءة ومطفأة — مع التحقق أن الصوت يُسمع فعلاً قبلها.
#      ٥. إعادة تشغيل الجهاز: الإقامة تُطلق دون فتح التطبيق.
#   ب) حزمة الإصدار (المصغّرة، كما تصل للمستخدم):
#      ٦. التطبيق نفسه يبني الجدول (JS → الطبقة الأصلية) — فحص محتواه.
#      ٧. تقديم ساعة الجهاز إلى موعد أذان ثم إقامة حقيقيين من ذلك الجدول.
#      ٦ب. إن كان WebView الجهاز أقدم من الحدّ الأدنى (لا يشغّل وحدات JavaScript،
#          كصورة أندرويد ٧ بلا متجر Play: Chrome 52) فالحزمة لا تعمل أصلاً؛
#          يُتحقَّق بدلاً من ذلك أن درع الإقلاع أظهر رسالة «حدّث WebView»
#          بدل شاشة استعادة معلّقة للأبد.

set -u
DBG_APK="$1"
REL_APK="$2"
OUT="${3:-evidence}"
mkdir -p "$OUT"
SUMMARY="$OUT/summary.txt"
: > "$SUMMARY"
FAILED=0

API=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
echo "API=$API" | tee -a "$SUMMARY"
# مخزن السجل الافتراضي في المحاكي صغير (٢٥٦ ك.ب) فتدور أسطر الاختبار خارجه على
# العدّاءات البطيئة الكثيرة الضجيج؛ نكبّره حتى تبقى كل أسطر كل خطوة.
adb logcat -G 16M > /dev/null 2>&1 || true

pass() { echo "PASS  $*" | tee -a "$SUMMARY"; }
fail() {
  echo "FAIL  $*" | tee -a "$SUMMARY"
  FAILED=1
}
note() { echo "NOTE  $*" | tee -a "$SUMMARY"; }
expect() { # expect <desc> <file> <regex> [count]
  local desc="$1" file="$2" re="$3" want="${4:-}"
  local n
  n=$(grep -cE "$re" "$file" || true)
  if [ -n "$want" ]; then
    if [ "$n" = "$want" ]; then pass "$desc ($n)"; else fail "$desc — وُجد $n والمتوقع $want"; fi
  elif [ "$n" -gt 0 ]; then pass "$desc"; else fail "$desc"; fi
}
expect_none() { # expect_none <desc> <file> <regex>
  if grep -qE "$3" "$2"; then
    fail "$1"
    grep -E "$3" "$2" | head -5 | tee -a "$SUMMARY"
  else pass "$1"; fi
}

expect_no_crash() { # expect_no_crash <desc> <file> — انهيار عملية منار فقط، لا أي تطبيق في المحاكي
  local hits
  hits=$(grep -A2 -E "FATAL EXCEPTION" "$2" | grep -E "Process: app\.manar\.islamic" || true)
  if [ -n "$hits" ]; then
    fail "$1"
    grep -B1 -A8 -E "FATAL EXCEPTION" "$2" | head -20 | tee -a "$SUMMARY"
  else pass "$1"; fi
  grep -A2 -E "FATAL EXCEPTION" "$2" | grep -E "Process: " | grep -vE "app\.manar\.islamic" \
    | head -3 | sed 's/^/NOTE  انهيار تطبيق آخر (مُتجاهَل): /' | tee -a "$SUMMARY" || true
}

wait_boot() {
  adb wait-for-device
  local i=0
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
    i=$((i + 1))
    [ $i -gt 150 ] && break
  done
  sleep 8
  adb logcat -G 16M > /dev/null 2>&1 || true
}

airplane_on() {
  adb shell settings put global airplane_mode_on 1
  if [ "$API" -ge 30 ]; then adb shell cmd connectivity airplane-mode enable || true; fi
  adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true > /dev/null 2>&1 || true
  adb shell svc wifi disable || true
  adb shell svc data disable || true
  sleep 3
  if adb shell ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1; then
    fail "الشبكة ما زالت متاحة بعد تفعيل وضع الطيران"
  else pass "وضع الطيران: لا اتصال بالإنترنت"; fi
}

grant() {
  local pkg="$1"
  if [ "$API" -ge 33 ]; then adb shell pm grant "$pkg" android.permission.POST_NOTIFICATIONS || true; fi
  if [ "$API" -ge 31 ]; then adb shell appops set "$pkg" SCHEDULE_EXACT_ALARM allow || true; fi
}

kill_app() { # يقتل العملية كما يفعل النظام (لا force-stop)، ويتحقق أنها ماتت
  # force-stop يُلغي المنبّهات، فلا يُستعمل. `am kill` لا يقتل إلا عملية يعدّها النظام
  # في الخلفية، وعلى محاكٍ بطيء قد لا تكون نزلت إليها بعد ثوانٍ من HOME — فتبقى الواجهة
  # حيّة وتُعيد مزامنة جدولها فوق أحداث الاختبار. نُعيد المحاولة، ثم نقتلها بـ SIGKILL
  # (run-as لنسخة التصحيح، أو root) — وهو ما يفعله قاتل الذاكرة المنخفضة تماماً.
  local pkg="$1"
  adb shell input keyevent KEYCODE_HOME
  sleep 3
  local pid="" i
  for i in 1 2 3 4 5 6; do
    adb shell am kill "$pkg"
    sleep 2
    pid=$(adb shell pidof "$pkg" 2> /dev/null | tr -d '\r')
    [ -z "$pid" ] && break
    if [ "$i" -ge 3 ]; then
      adb shell run-as "$pkg" kill -9 "$pid" > /dev/null 2>&1 \
        || adb shell kill -9 "$pid" > /dev/null 2>&1 || true
      sleep 2
      pid=$(adb shell pidof "$pkg" 2> /dev/null | tr -d '\r')
      [ -z "$pid" ] && break
    fi
    adb shell input keyevent KEYCODE_HOME
    sleep 3
  done
  if [ -z "$pid" ]; then pass "التطبيق مغلق (لا عملية حيّة) قبل الموعد"; else fail "تعذّر إغلاق التطبيق ($pid) — النتائج التالية غير موثوقة"; fi
  adb shell input keyevent KEYCODE_SLEEP || adb shell input keyevent KEYCODE_POWER
  sleep 2
}

# ====================================================================
# أ) نسخة التصحيح
# ====================================================================
DP=app.manar.islamic.debug
RECV="$DP/app.manar.islamic.ManarTestReceiver"
adb install -r "$DBG_APK" | tee "$OUT/install-debug.txt"
grant "$DP"
airplane_on

adb shell am start -n "$DP/app.manar.islamic.MainActivity"
sleep 30
adb exec-out screencap -p > "$OUT/debug-launched.png" || true

# ---- ١. فكّ وتشغيل كل تسجيلات الإقامة ----
adb logcat -c
adb shell am broadcast -n "$RECV" -a app.manar.islamic.test.DECODE_ALL
# ٣٥ ثانية عادةً؛ المهلة ٦ دقائق لأن عدّاءات المحاكي تتباطأ أحياناً عشرة أضعاف.
for _ in $(seq 1 180); do
  adb logcat -d -s ManarTest:* > "$OUT/decode.txt"
  grep -q DECODE_DONE "$OUT/decode.txt" && break
  sleep 2
done
expect "فكّ ترميز كامل لكل ملف إقامة (MediaCodec)" "$OUT/decode.txt" "DECODE iqamah_[0-9]{2} OK" 19
expect "تشغيل كل ملف إقامة (MediaPlayer)" "$OUT/decode.txt" "PLAY iqamah_[0-9]{2} OK" 19
expect "خلاصة الفكّ والتشغيل" "$OUT/decode.txt" "DECODE_DONE pass=19 fail=0"
grep -E "FAIL|DECODE_DONE" "$OUT/decode.txt" | head -8 | sed 's/^/DIAG decode: /' >> "$OUT/diag.txt" || true

# ---- ٢. التدفّق الكامل والتطبيق مغلق والشاشة مطفأة ----
# نُغلق التطبيق أولاً: لو بقيت واجهته حيّة لأعادت مزامنة جدولها الحقيقي فوق
# أحداث الاختبار (replaceAll — وهو السلوك الصحيح). المستقبِل وحده يوقظ العملية.
adb shell input keyevent KEYCODE_WAKEUP
kill_app "$DP"
adb logcat -c
adb shell am broadcast -n "$RECV" -a app.manar.islamic.test.SCHEDULE --es scenario flow
sleep 3
adb shell am kill "$DP"
adb shell dumpsys alarm > "$OUT/flow-alarms.txt"
sleep 200
adb shell input keyevent KEYCODE_WAKEUP
adb logcat -d > "$OUT/flow-logcat.txt"
adb shell dumpsys notification --noredact > "$OUT/flow-notifications.txt"
F="$OUT/flow-logcat.txt"
expect "التكرار داخل القائمة يُصفّى بالمفتاح (٨ → ٦)" "$F" "SCHEDULED scenario=flow requested=8 armed=6"
expect "الأذان يُطلق مرّة واحدة" "$F" "fire t_dhuhr_adhan kind=adhan" 1
expect "صوت الأذان من مكتبة الأذان" "$F" "start key=t_dhuhr_adhan sound=madinah_short kind=adhan"
expect "إشعار دخول الوقت بعد انتهاء الأذان" "$F" "completed key=t_dhuhr_adhan"
expect "تنبيه قبل الإقامة (نصّي)" "$F" "fire t_dhuhr_iqamah_reminder kind=notice" 1
expect "الإقامة تُطلق مرّة واحدة" "$F" "fire t_dhuhr_iqamah kind=iqama" 1
expect "صوت الإقامة من مكتبة الإقامة" "$F" "start key=t_dhuhr_iqamah sound=iqamah_08 kind=iqama"
expect "الإقامة اكتملت" "$F" "completed key=t_dhuhr_iqamah"
expect "صوت واحد فقط: الجديد يوقف السابق" "$F" "stopped previous key=t_asr_iqamah before key=t_asr_adhan"
expect "إشعار دخول الوقت بلا أذان" "$F" "fire t_maghrib_prayer_notice kind=notice" 1
# السجلّ يشمل كل تطبيقات المحاكي (بحث Google وخدمات Play…)، فتُحصر الفحوص في منار وحدها:
# «FileNotFoundException» من تطبيق آخر ليس خطأً في منار وكان يُفشل الاختبار على API 34.
expect_no_crash "لا انهيار" "$F"
expect_none "لا خطأ فكّ ترميز ولا ملف مفقود" "$F" \
  "ManarAudio.*(decoder error|missing raw|playback failed)|(Manar[A-Za-z]*|app\.manar\.islamic).*FileNotFound"
grep -E "start key=t_[a-z]+_iqamah " "$F" | grep -vE "sound=iqamah_[0-9]{2} " && fail "حدث إقامة بصوت غير إقامة" || pass "كل أحداث الإقامة بأصوات iqamah_*"
grep -E "start key=t_[a-z]+_adhan " "$F" | grep -E "sound=iqamah_" && fail "حدث أذان بصوت إقامة" || pass "لا حدث أذان بصوت إقامة"
expect "الإشعارات النصّية ظاهرة" "$OUT/flow-notifications.txt" "id=30900[37]"

# ---- ٣. إعادة الضبط بالمفاتيح نفسها ----
adb logcat -c
adb shell am broadcast -n "$RECV" -a app.manar.islamic.test.SCHEDULE --es scenario refire
sleep 50
adb logcat -d > "$OUT/refire-logcat.txt"
expect "المفاتيح المُطلقة لا تُضبط ثانية" "$OUT/refire-logcat.txt" "SCHEDULED scenario=refire requested=2 armed=0"
expect "لا إطلاق مكرّر" "$OUT/refire-logcat.txt" "fire t_dhuhr_(adhan|iqamah) " 0

# ---- ٤. مورد مفقود ----
adb logcat -c
adb shell am broadcast -n "$RECV" -a app.manar.islamic.test.SCHEDULE --es scenario missing
sleep 35
adb logcat -d > "$OUT/missing-logcat.txt"
adb shell dumpsys notification --noredact > "$OUT/missing-notifications.txt"
expect "مورد مفقود يُسجَّل" "$OUT/missing-logcat.txt" "missing raw resource: iqamah_99"
expect_none "مورد مفقود: لا صوت بديل" "$OUT/missing-logcat.txt" "start key=t_missing_iqamah"
expect_no_crash "مورد مفقود: لا انهيار" "$OUT/missing-logcat.txt"
expect "مورد مفقود: يبقى الإشعار المكتوب" "$OUT/missing-notifications.txt" "id=309201"

# ---- ٤ب. الإيقاف السريع بأزرار الجهاز والتطبيق مغلق ----
wait_log() { # wait_log <regex> <seconds> — ينتظر سطراً في السجلّ بدل مهلة ثابتة
  local re="$1" max="$2" i=0
  while [ $i -lt "$max" ]; do
    adb logcat -d 2> /dev/null | grep -qE "$re" && return 0
    sleep 1
    i=$((i + 1))
  done
  return 1
}
OLD_TIMEOUT=$(adb shell settings get system screen_off_timeout | tr -d '\r')
adb shell input keyevent KEYCODE_WAKEUP
kill_app "$DP"
adb logcat -c
adb shell am broadcast -n "$RECV" -a app.manar.islamic.test.SCHEDULE --es scenario quick
sleep 3
adb shell am kill "$DP"
Q="$OUT/quick-logcat.txt"
# ١) زرّ الصوت والشاشة مطفأة.
if wait_log "start key=t_q1_adhan" 110; then
  sleep 4
  adb shell dumpsys audio > "$OUT/quick-audio-playing.txt" 2>&1 || true
  adb shell dumpsys media_session > "$OUT/quick-media-session.txt" 2>&1 || true
  DIAG="$OUT/diag.txt"
  echo "DIAG interactive=$(adb shell dumpsys power | grep -m1 -oE 'mWakefulness=[A-Za-z]+')" | tee -a "$DIAG"
  echo "DIAG music-before=$(adb shell dumpsys audio | grep -m1 -oE 'STREAM_MUSIC.*' | head -c 200)" | tee -a "$DIAG"
  grep -E "global priority|Volume default|default volume|package=app.manar|active=|state=PlaybackState" \
    "$OUT/quick-media-session.txt" | head -12 | sed 's/^/DIAG /' | tee -a "$DIAG"
  grep -E "USAGE_MEDIA|USAGE_ALARM" "$OUT/quick-audio-playing.txt" | grep -i started | head -4 | sed 's/^/DIAG /' | tee -a "$DIAG"
  VOL_DEV=$(adb shell getevent -pl 2> /dev/null | tr -d '\r' \
    | awk '/^add device/{d=$NF} /KEY_VOLUMEDOWN/{print d; exit}')
  echo "DIAG volume-device=${VOL_DEV:-none}" | tee -a "$DIAG"
  adb shell log -t ManarTest DIAG_VOLKEY_MARK
  # هل يصل المفتاح إلى نواة الجهاز أصلاً؟ نسجّل أحداث الإدخال الخام حول الضغطة.
  adb shell "timeout 6 getevent -lt" > "$OUT/quick-getevent.txt" 2>&1 &
  GETEVENT_PID=$!
  sleep 1
  # `input keyevent` يُعلَّم «محقوناً» فيسلك والشاشة مطفأة مسار الشاشة المضاءة.
  # مفتاح عتادي حقيقي: نكتب الحدث في جهاز الإدخال الذي يعلن KEY_VOLUMEDOWN في النواة
  # (sendevent بصلاحية الجذر)، فيصل إلى النظام غير «محقون» ويسلك مسار الشاشة المطفأة
  # الفعلي. أحداث لوحة المحاكي (adb emu event) لا تصل إلى النواة مع -no-window.
  if [ -n "$VOL_DEV" ] && adb shell su 0 sh -c "'sendevent $VOL_DEV 1 114 1; sendevent $VOL_DEV 0 0 0; sleep 0.1; sendevent $VOL_DEV 1 114 0; sendevent $VOL_DEV 0 0 0'" > /dev/null 2>&1; then
    note "زرّ الصوت والشاشة مطفأة: مفتاح عتادي عبر جهاز إدخال النواة ($VOL_DEV)"
  elif adb emu event send EV_KEY:KEY_VOLUMEDOWN:1 EV_SYN:0:0 > /dev/null 2>&1 \
    && adb emu event send EV_KEY:KEY_VOLUMEDOWN:0 EV_SYN:0:0 > /dev/null 2>&1; then
    note "زرّ الصوت والشاشة مطفأة: مفتاح من لوحة المحاكي"
  else
    note "لا مفتاح عتادي متاح — مفتاح محقون"
    adb shell input keyevent KEYCODE_VOLUME_DOWN
  fi
  wait_log "muted by=volume-(key|stream) key=t_q1_adhan" 15 || true
  wait "$GETEVENT_PID" 2> /dev/null || true
  tail -2 "$SUMMARY" | sed 's/^/DIAG /' | tee -a "$DIAG"
  echo "DIAG ---- getevent (raw input) ----" | tee -a "$DIAG"
  grep -iE "VOLUME|KEY_" "$OUT/quick-getevent.txt" | head -8 | sed 's/^/DIAG /' | tee -a "$DIAG"
  echo "DIAG getevent-lines=$(wc -l < "$OUT/quick-getevent.txt")" | tee -a "$DIAG"
  echo "DIAG ---- logcat after volume key (screen off) ----" | tee -a "$DIAG"
  adb logcat -d | sed -n '/DIAG_VOLKEY_MARK/,$p' > "$OUT/quick-volume-key-logcat.txt"
  grep -iE "key bridge|MediaSession|dispatchVolume|adjustSuggested|adjustStreamVolume|skipping volume|ManarAudio|PhoneWindowManager|interceptKey|VolumeDialog|routing|KEYCODE_VOLUME|VOLUME_DOWN|WindowManager.*Volume|AudioService|volume" \
    "$OUT/quick-volume-key-logcat.txt" | tail -40 | sed 's/^/DIAG /' | tee -a "$DIAG"
  echo "DIAG ---- unfiltered tail ----" | tee -a "$DIAG"
  grep -vE "ManarTest|chatty|GoogleApiManager|Finsky|GmsClient|Phenotype|logd|BufferPool|freezing|ProcessStats" \
    "$OUT/quick-volume-key-logcat.txt" | head -25 | cut -c1-220 | sed 's/^/DIAG /' | tee -a "$DIAG"
  adb shell dumpsys audio | grep -m3 -iE "STREAM_MUSIC|- STREAM_MUSIC" | sed 's/^/DIAG /' | tee -a "$DIAG" || true
  adb shell dumpsys media_session | grep -iE "Media button session|global priority|Sessions Stack" -A2 | head -12 | sed 's/^/DIAG /' | tee -a "$DIAG" || true
fi
# ٢) زرّ التشغيل والشاشة مضاءة (مهلة انطفاء طويلة حتى لا تنطفئ وحدها).
adb shell settings put system screen_off_timeout 600000
adb shell input keyevent KEYCODE_WAKEUP
if wait_log "start key=t_q2_iqamah" 110; then
  sleep 4
  adb shell input keyevent KEYCODE_POWER
  wait_log "muted by=power-key key=t_q2_iqamah" 15 || true
fi
# ٣) زرّ التشغيل والشاشة مطفأة (أطفأتها الضغطة السابقة).
adb shell input keyevent KEYCODE_SLEEP || true
if wait_log "start key=t_q3_adhan" 110; then
  sleep 4
  adb shell input keyevent KEYCODE_POWER
  wait_log "muted by=power-key key=t_q3_adhan" 15 || true
fi
# ٤) زرّ الصوت والشاشة مضاءة.
adb shell input keyevent KEYCODE_WAKEUP
if wait_log "start key=t_q4_iqamah" 110; then
  sleep 4
  adb shell input keyevent KEYCODE_VOLUME_UP
  wait_log "muted by=volume-(key|stream) key=t_q4_iqamah" 15 || true
fi
sleep 3
adb logcat -d > "$Q"
adb shell dumpsys notification --noredact > "$OUT/quick-notifications.txt"
[ -n "$OLD_TIMEOUT" ] && [ "$OLD_TIMEOUT" != "null" ] \
  && adb shell settings put system screen_off_timeout "$OLD_TIMEOUT" || true
expect "الأذان يُشغَّل والتطبيق مغلق" "$Q" "start key=t_q1_adhan sound=afasy_full_1 kind=adhan"
expect "الإيقاف السريع مُفعَّل مع التشغيل" "$Q" "quick-stop armed screen=off"
if [ "$API" -ge 26 ]; then
  expect "الصوت يُسمع فعلاً (مشغّل منبّه نشط)" "$OUT/quick-audio-playing.txt" "state:started.*USAGE_ALARM|USAGE_ALARM.*state:started"
else
  note "API $API: لا قائمة مشغّلات في dumpsys audio — يُكتفى بسجلّ بدء التشغيل"
fi
expect "زرّ الصوت يُسكت الأذان" "$Q" "muted by=volume-(key|stream) key=t_q1_adhan" 1
if [ "$API" -ge 33 ]; then # ما دون ٣٣ جلسة بعيدة لا تغيّر صوت الجهاز أصلاً
  expect "درجة صوت الوسائط تُعاد بعد الإسكات بالزرّ" "$Q" "restored stream=3 level="
fi
expect_none "لا محاولة لإعادة قناة مُسمّاة بلا صلاحية" "$Q" "restored stream=(9|10|11) |setStreamVolume\(\) for STREAM_(ASSISTANT|ACCESSIBILITY|TTS).*app\.manar"
expect "زرّ الصوت والشاشة مضاءة يُسكت الإقامة" "$Q" "muted by=volume-(key|stream) key=t_q4_iqamah" 1
expect "زرّ التشغيل والشاشة مضاءة يُسكت الإقامة" "$Q" "muted by=power-key key=t_q2_iqamah" 1
expect "زرّ التشغيل والشاشة مطفأة يُسكت الأذان" "$Q" "muted by=power-key key=t_q3_adhan" 1
expect "لا صوت يكمل بعد الإيقاف" "$Q" "completed key=t_q[1-4]_" 0
expect "يبقى تنبيه الصلاة مكتوباً بعد الإسكات" "$OUT/quick-notifications.txt" "id=40995"
expect_no_crash "الإيقاف السريع: لا انهيار" "$Q"

# ---- ٥. إعادة تشغيل الجهاز ----
adb shell am broadcast -n "$RECV" -a app.manar.islamic.test.SCHEDULE --es scenario reboot
sleep 2
T0=$(date +%s)
adb reboot
wait_boot
echo "boot took $(($(date +%s) - T0))s" | tee -a "$SUMMARY"
adb shell input keyevent KEYCODE_SLEEP || true
adb shell dumpsys alarm > "$OUT/reboot-alarms.txt"
REMAIN=$((250 - ($(date +%s) - T0)))
[ $REMAIN -gt 0 ] && sleep $REMAIN
sleep 20
adb logcat -d > "$OUT/reboot-logcat.txt"
expect "إعادة الضبط بعد الإقلاع" "$OUT/reboot-logcat.txt" "re-arm after android.intent.action.(LOCKED_)?BOOT_COMPLETED"
expect "الإقامة تُطلق بعد إعادة التشغيل دون فتح التطبيق" "$OUT/reboot-logcat.txt" "fire t_isha_iqamah kind=iqama" 1
expect "صوت الإقامة بعد إعادة التشغيل" "$OUT/reboot-logcat.txt" "start key=t_isha_iqamah sound=iqamah_19"
expect_no_crash "لا انهيار بعد إعادة التشغيل" "$OUT/reboot-logcat.txt"

adb uninstall "$DP" > /dev/null || true

# ====================================================================
# ب) حزمة الإصدار
# ====================================================================
RP=app.manar.islamic
airplane_on
adb install -r "$REL_APK" | tee "$OUT/install-release.txt"
grant "$RP"
adb logcat -c
adb shell input keyevent KEYCODE_WAKEUP
adb shell am start -n "$RP/app.manar.islamic.MainActivity"
sleep 40
adb exec-out screencap -p > "$OUT/release-launched.png" || true
# شاشات الترحيب (إن وُجدت) — نفس نقاط اختبار التثبيت.
for i in 1 2 3 4; do
  adb shell input tap 539 2165
  sleep 6
done
adb exec-out screencap -p > "$OUT/release-after-onboarding.png" || true
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am start -n "$RP/app.manar.islamic.MainActivity"
sleep 20
adb exec-out screencap -p > "$OUT/release-relaunched.png" || true

# إصدار WebView الذي حمّله التطبيق فعلاً (من سجلّ الإقلاع)، وإلا فمن خدمة التحديث.
WV_MIN=$(sed -n 's/^export const MIN_WEBVIEW_CHROME = \([0-9]*\);.*/\1/p' "$(dirname "$0")/boot-guard.mjs")
WV_MIN=${WV_MIN:-61}
WV_VER=$(adb logcat -d -s WebViewFactory:* | tr -d '\r' | sed -n 's/.*Loading [^ ]* version \([0-9.]*\).*/\1/p' | tail -1)
if [ -z "$WV_VER" ]; then
  WV_VER=$(adb shell dumpsys webviewupdate 2> /dev/null | tr -d '\r' \
    | sed -n 's/.*Current WebView package (name, version): ([^,]*, \([0-9.]*\)).*/\1/p' | head -1)
fi
WV_MAJOR=${WV_VER%%.*}
note "WebView: ${WV_VER:-غير معروف} — الحدّ الأدنى للحزمة Chrome $WV_MIN"
OLD_WEBVIEW=0
case "$WV_MAJOR" in '' | *[!0-9]*) ;; *) [ "$WV_MAJOR" -lt "$WV_MIN" ] && OLD_WEBVIEW=1 ;; esac

ROOT_OK=0
if adb root > /dev/null 2>&1; then
  sleep 4
  adb wait-for-device
  if adb shell id | grep -q "uid=0"; then ROOT_OK=1; fi
fi
if [ $OLD_WEBVIEW = 1 ]; then
  # الحزمة لا تعمل على هذا المحرّك، فلا جدول متوقَّع. المطلوب: رسالة صريحة لا شاشة معلّقة.
  # الدرع يحفظ نتيجته في localStorage؛ نبحث عنها في ملفات WebView (sqlite قديماً،
  # leveldb حديثاً؛ القيم UTF-16 أو Latin-1).
  if [ $ROOT_OK = 1 ]; then
    mkdir -p "$OUT/release-webview-storage"
    adb shell "find /data/data/$RP/app_webview -type f 2> /dev/null" | tr -d '\r' > "$OUT/release-webview-files.txt"
    i=0
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      i=$((i + 1))
      adb exec-out "cat '$f'" > "$OUT/release-webview-storage/$i.bin" 2> /dev/null || true
    done < "$OUT/release-webview-files.txt"
    if python3 - "$OUT/release-webview-storage" << 'PY'; then
import os, sys
d = sys.argv[1]
want = "unsupported chrome="
for n in os.listdir(d):
    b = open(os.path.join(d, n), "rb").read()
    if want.encode("utf-16-le") in b or want.encode("latin-1") in b:
        sys.exit(0)
sys.exit(1)
PY
      pass "الإصدار: WebView قديم ($WV_VER) — درع الإقلاع أظهر رسالة «حدّث WebView» بدل شاشة معلّقة"
    else
      fail "الإصدار: WebView قديم ($WV_VER) ولم يُظهر درع الإقلاع رسالة التحديث"
    fi
  else
    note "adb root غير متاح — لا فحص لرسالة درع الإقلاع"
  fi
  note "الإصدار: لا جدول متوقَّع على WebView $WV_VER — جدولة الإصدار تُختبر على المحاكي الأحدث"
elif [ $ROOT_OK = 1 ]; then
  adb shell cat /data/data/$RP/shared_prefs/manar_adhan_schedule.xml > "$OUT/release-schedule.xml" 2> /dev/null || true
else
  note "adb root غير متاح — لا فحص لمحتوى الجدول ولا تقديم للساعة"
fi

if [ -s "$OUT/release-schedule.xml" ]; then
  python3 - "$OUT/release-schedule.xml" "$OUT/release-plan.env" << 'PY' | tee -a "$SUMMARY"
import html, json, re, sys
xml = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r'<string name="events">(.*?)</string>', xml, re.S)
events = json.loads(html.unescape(m.group(1))) if m else []
def ok(c, d): print(("PASS  " if c else "FAIL  ") + d)
ok(len(events) > 0, f"الإصدار: التطبيق ضبط {len(events)} حدثاً بنفسه")
kinds = {e["kind"] for e in events}
ok({"adhan", "iqama"} <= kinds, f"الإصدار: أنواع الأحداث {sorted(kinds)}")
ok(len({e["key"] for e in events}) == len(events), "الإصدار: مفاتيح فريدة")
ok(len({e["id"] for e in events}) == len(events), "الإصدار: معرّفات فريدة")
iq = [e for e in events if e["kind"] == "iqama"]
ok(all(re.fullmatch(r"iqamah_\d\d", e["sound"]) or e["sound"] == "" for e in iq), "الإصدار: كل أحداث الإقامة بأصوات iqamah_*")
ok(not any(e["sound"].startswith("iqamah") for e in events if e["kind"] == "adhan"), "الإصدار: لا أذان بصوت إقامة")
ok(all(re.fullmatch(r"[a-z]+_[a-z_]+_\d{4}_\d{2}_\d{2}", e["key"]) for e in events), "الإصدار: صيغة المفاتيح fajr_iqamah_YYYY_MM_DD")
print("NOTE  أمثلة: " + ", ".join(e["key"] for e in sorted(events, key=lambda e: e["at"])[:6]))
# أول إقامة بصوت، وأذان صلاتها.
iq = sorted([e for e in iq if e["sound"]], key=lambda e: e["at"])
if iq:
    e = iq[0]
    prayer = e["key"].split("_")[0]
    day = e["key"][-10:]
    a = next((x for x in events if x["key"] == f"{prayer}_adhan_{day}"), None)
    with open(sys.argv[2], "w") as f:
        f.write(f"IQ_KEY={e['key']}\nIQ_AT={e['at']//1000}\nIQ_SOUND={e['sound']}\n")
        if a:
            f.write(f"AD_KEY={a['key']}\nAD_AT={a['at']//1000}\nAD_SOUND={a['sound']}\n")
PY
  grep -q "^FAIL" "$SUMMARY" && FAILED=1
elif [ $OLD_WEBVIEW = 0 ]; then
  [ $ROOT_OK = 1 ] && fail "الإصدار: لم يُحفظ أي جدول بعد فتح التطبيق"
fi

set_clock() { # set_clock <epoch-seconds>
  local t="$1"
  adb shell settings put global auto_time 0 || true
  adb shell "date @$t" > /dev/null 2>&1 || adb shell "date -u $(date -u -d @"$t" +%m%d%H%M%Y.%S)" > /dev/null 2>&1 || true
  local now
  now=$(adb shell date +%s | tr -d '\r')
  local d=$((now - t))
  [ ${d#-} -lt 10 ]
}

if [ -f "$OUT/release-plan.env" ]; then
  # shellcheck disable=SC1090
  . "$OUT/release-plan.env"
  kill_app "$RP"
  adb logcat -c
  if [ -n "${AD_AT:-}" ] && set_clock $((AD_AT - 20)); then
    sleep 45
    adb logcat -d > "$OUT/release-adhan-logcat.txt"
    expect "الإصدار: أذان حقيقي في موعده والتطبيق مغلق ($AD_KEY)" "$OUT/release-adhan-logcat.txt" "fire $AD_KEY kind=adhan" 1
    expect "الإصدار: صوت الأذان ($AD_SOUND)" "$OUT/release-adhan-logcat.txt" "start key=$AD_KEY sound=$AD_SOUND"
  else
    note "تعذّر ضبط الساعة لموعد الأذان"
  fi
  adb logcat -c
  if set_clock $((IQ_AT - 20)); then
    sleep 60
    adb logcat -d > "$OUT/release-iqama-logcat.txt"
    adb shell dumpsys notification --noredact > "$OUT/release-notifications.txt"
    expect "الإصدار: إقامة حقيقية في موعدها والتطبيق مغلق ($IQ_KEY)" "$OUT/release-iqama-logcat.txt" "fire $IQ_KEY kind=iqama" 1
    expect "الإصدار: صوت الإقامة ($IQ_SOUND)" "$OUT/release-iqama-logcat.txt" "start key=$IQ_KEY sound=$IQ_SOUND kind=iqama"
    expect_no_crash "الإصدار: لا انهيار" "$OUT/release-iqama-logcat.txt"
    expect_none "الإصدار: لا خطأ صوت" "$OUT/release-iqama-logcat.txt" "ManarAudio.*(decoder error|missing raw|playback failed)"
  else
    note "تعذّر ضبط الساعة لموعد الإقامة"
  fi
fi

adb logcat -d > "$OUT/release-final-logcat.txt"
expect_no_crash "الإصدار: لا انهيار طوال الاختبار" "$OUT/release-final-logcat.txt"

echo "----" | tee -a "$SUMMARY"
if [ $FAILED = 0 ]; then echo "ALL PASSED" | tee -a "$SUMMARY"; else echo "SOME CHECKS FAILED" | tee -a "$SUMMARY"; fi
exit $FAILED
