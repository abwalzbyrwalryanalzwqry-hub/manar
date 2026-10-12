#!/usr/bin/env bash
# يجلب ملفات خط ثمانية من المستودع الخاص manar-fonts إلى public/fonts قبل البناء.
#
# ترخيص ثمانية يمنع رفع ملفات الخط إلى مستودع عام، فهي لا توجد في هذا المستودع؛
# تُجلب وقت البناء فقط وتُضمَّن داخل حزمة التطبيق (وهو ما يجيزه الترخيص).
#
# المصادر (بالترتيب):
#   MANAR_FONTS_DIR         مجلد محلي فيه الملفات (للتطوير على جهازك).
#   MANAR_FONTS_DEPLOY_KEY  مفتاح نشر SSH للقراءة فقط على manar-fonts (في CI).
# MANAR_REQUIRE_FONTS=true  يجعل غياب الخط خطأً يوقف البناء (بناء main والإصدار).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/public/fonts"
REPO="git@github.com:abwalzbyrwalryanalzwqry-hub/manar-fonts.git"
# مفتاح خادم GitHub المنشور رسمياً — تثبيته يمنع انتحال الخادم.
GITHUB_HOST_KEY="github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"
FILES=(
  thmanyah-sans-Light.woff2
  thmanyah-sans-Regular.woff2
  thmanyah-sans-Medium.woff2
  thmanyah-sans-Bold.woff2
  thmanyah-sans-Black.woff2
  thmanyah-serif-display-Regular.woff2
  thmanyah-serif-display-Bold.woff2
)

out() { [ -n "${GITHUB_OUTPUT:-}" ] && echo "$1" >> "$GITHUB_OUTPUT" || true; }
missing() {
  if [ "${MANAR_REQUIRE_FONTS:-false}" = "true" ]; then
    echo "::error::$1"
    exit 1
  fi
  echo "::warning::$1 — سيُبنى التطبيق بالخطوط البديلة المضمّنة."
  out "fetched=false"
  exit 0
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "${MANAR_FONTS_DIR:-}" ]; then
  SRC="$MANAR_FONTS_DIR"
elif [ -n "${MANAR_FONTS_DEPLOY_KEY:-}" ]; then
  umask 077
  printf '%s\n' "$MANAR_FONTS_DEPLOY_KEY" > "$TMP/key"
  printf '%s\n' "$GITHUB_HOST_KEY" > "$TMP/known_hosts"
  GIT_SSH_COMMAND="ssh -i $TMP/key -o IdentitiesOnly=yes -o UserKnownHostsFile=$TMP/known_hosts -o StrictHostKeyChecking=yes" \
    git clone --quiet --depth 1 "$REPO" "$TMP/fonts"
  rm -f "$TMP/key"
  SRC="$TMP/fonts"
else
  missing "لا مصدر لخط ثمانية (MANAR_FONTS_DEPLOY_KEY أو MANAR_FONTS_DIR)"
fi

if [ -f "$SRC/SHA256SUMS" ]; then
  (cd "$SRC" && sha256sum --quiet -c SHA256SUMS) || { echo "::error::فشل التحقق من سلامة ملفات الخط"; exit 1; }
fi

for f in "${FILES[@]}"; do
  [ -f "$SRC/$f" ] || missing "ملف الخط ناقص: $f"
done
for f in "${FILES[@]}"; do
  install -m 0644 "$SRC/$f" "$DEST/$f"
done

echo "خط ثمانية: نُسخت ${#FILES[@]} ملفات إلى public/fonts."
out "fetched=true"
