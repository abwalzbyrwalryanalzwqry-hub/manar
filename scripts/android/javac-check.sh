#!/usr/bin/env bash
# منار — فحص ترجمة ملفات Java الأصلية بلا Android SDK ولا Gradle.
#
# يُنزّل android.jar (المنصّة 36) ومكتبات androidx وCapacitor المستعملة إلى
# ذاكرة مؤقتة، ثم يترجم android/app/src/main/java بـjavac مع صنفَي R وBuildConfig
# مولَّدين. لا يُخرج حزمة ولا يفحص مستوى الواجهة (NewApi) — فقط أن الكود يُترجم.
# مفيد حين يكون «بناء أندرويد» في CI متوقفاً. الاستعمال:
#   bash scripts/android/javac-check.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE="${MANAR_JAVAC_CACHE:-$HOME/.cache/manar-javac}"
G=https://dl.google.com/android/maven2
mkdir -p "$CACHE/jars"
fetch_aar() { # group/path artifact version
  local out="$CACHE/jars/$2.jar"
  [ -f "$out" ] && return
  curl -sfLo "$CACHE/x.aar" "$G/$1/$2/$3/$2-$3.aar"
  unzip -qo "$CACHE/x.aar" classes.jar -d "$CACHE" && mv "$CACHE/classes.jar" "$out"
}
if [ ! -f "$CACHE/android.jar" ]; then
  curl -sfLo "$CACHE/platform.zip" https://dl.google.com/android/repository/platform-36_r02.zip
  unzip -qo -j "$CACHE/platform.zip" '*/android.jar' -d "$CACHE"
  rm -f "$CACHE/platform.zip"
fi
fetch_aar androidx/core core 1.15.0
fetch_aar androidx/media media 1.7.0
fetch_aar androidx/appcompat appcompat 1.7.0
fetch_aar androidx/activity activity 1.9.2
fetch_aar androidx/fragment fragment 1.8.4
fetch_aar androidx/lifecycle lifecycle-runtime 2.6.1
fetch_aar androidx/lifecycle lifecycle-viewmodel 2.6.1
fetch_aar androidx/savedstate savedstate 1.2.1
fetch_aar androidx/drawerlayout drawerlayout 1.1.1
fetch_aar androidx/customview customview 1.1.0
[ -f "$CACHE/jars/lifecycle-common.jar" ] || curl -sfLo "$CACHE/jars/lifecycle-common.jar" \
  "$G/androidx/lifecycle/lifecycle-common/2.6.1/lifecycle-common-2.6.1.jar"
[ -f "$CACHE/jars/annotation.jar" ] || curl -sfLo "$CACHE/jars/annotation.jar" \
  "$G/androidx/annotation/annotation-jvm/1.8.1/annotation-jvm-1.8.1.jar"
CAP=$(node -p "require('$ROOT/node_modules/@capacitor/android/package.json').version")
if [ ! -f "$CACHE/jars/capacitor-$CAP.jar" ]; then
  curl -sfLo "$CACHE/cap.aar" "https://repo1.maven.org/maven2/com/capacitorjs/core/$CAP/core-$CAP.aar"
  unzip -qo "$CACHE/cap.aar" classes.jar -d "$CACHE" && mv "$CACHE/classes.jar" "$CACHE/jars/capacitor-$CAP.jar"
fi

GEN="$CACHE/gen/app/manar/islamic"
rm -rf "$CACHE/gen" "$CACHE/out" && mkdir -p "$GEN" "$CACHE/out"
python3 - "$ROOT" "$GEN" <<'PY'
import glob, re, sys
root, gen = sys.argv[1], sys.argv[2]
names = {}
for f in glob.glob(root + "/android/app/src/main/java/**/*.java", recursive=True):
    for t, n in re.findall(r"\bR\.(\w+)\.(\w+)", open(f, encoding="utf8").read()):
        names.setdefault(t, set()).add(n)
out = "package app.manar.islamic;\npublic final class R {\n"
for t, ns in names.items():
    out += f" public static final class {t} {{\n" + "".join(
        f"  public static final int {n}=0;\n" for n in sorted(ns)) + " }\n"
open(gen + "/R.java", "w").write(out + "}\n")
open(gen + "/BuildConfig.java", "w").write(
    "package app.manar.islamic;\npublic final class BuildConfig {"
    " public static final boolean DEBUG=false;"
    " public static final String APPLICATION_ID=\"app.manar.islamic\"; }\n")
PY
CP="$CACHE/android.jar:$(ls "$CACHE"/jars/*.jar | tr '\n' ':')"
JAVAC=(javac)
command -v javac >/dev/null || JAVAC=(java -m jdk.compiler/com.sun.tools.javac.Main)
"${JAVAC[@]}" -source 17 -target 17 -nowarn -proc:none -encoding UTF-8 -cp "$CP" -d "$CACHE/out" \
  $(find "$ROOT/android/app/src/main/java" -name '*.java') "$GEN"/*.java
echo "javac: OK ($(find "$ROOT/android/app/src/main/java" -name '*.java' | wc -l) files)"
