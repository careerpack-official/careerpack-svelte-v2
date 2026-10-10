#!/usr/bin/env bash
set -euo pipefail
SCRIPT="$(cd "$(dirname "$0")" && pwd)/backup-prod.sh"
TEMP_BASE="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
TEMP="$(mktemp -d "$TEMP_BASE/careerpack-cloud-backup-test.XXXXXX")"
[[ "$TEMP" == "$TEMP_BASE"/careerpack-cloud-backup-test.* ]] || exit 1
trap 'rm -rf -- "$TEMP"' EXIT
export BACKUP_DIR="$TEMP/archives" PROD_ENV_FILE="$TEMP/target.env"
export BACKUP_PASSPHRASE_FILE="$TEMP/key" GNUPGHOME="$TEMP/gpg" KEEP=1
mkdir "$GNUPGHOME" "$TEMP/fixture" "$TEMP/fixture/_tables" "$TEMP/fixture/users"
chmod 700 "$GNUPGHOME"
printf 'test-only' > "$PROD_ENV_FILE"
printf 'test-private-backup-passphrase' > "$BACKUP_PASSPHRASE_FILE"
printf '{"name":"users"}\n' > "$TEMP/fixture/_tables/documents.jsonl"
printf '{"_id":"test-only"}\n' > "$TEMP/fixture/users/documents.jsonl"
export FIXTURE="$TEMP/fixture"
pnpm() {
  local out=""
  while [[ "$#" -gt 0 ]]; do
    if [[ "$1" == --path ]]; then out="$2"; break; fi
    shift
  done
  [[ -n "$out" ]] || return 1
  (cd "$FIXTURE" && zip -qr "$out" .)
}
export -f pnpm

mv "$BACKUP_PASSPHRASE_FILE" "$TEMP/saved-key"
if bash "$SCRIPT" >/dev/null 2>&1; then echo 'Missing key accepted'; exit 1; fi
test ! -e "$BACKUP_DIR"
mv "$TEMP/saved-key" "$BACKUP_PASSPHRASE_FILE"
mkdir "$BACKUP_DIR"
printf 'old-verified-backup' > "$BACKUP_DIR/careerpack-prod-20000101-000000.zip.gpg"
printf 'invalid JSON\n' > "$FIXTURE/users/documents.jsonl"
if bash "$SCRIPT" >/dev/null 2>&1; then echo 'Corrupt JSON accepted'; exit 1; fi
test -f "$BACKUP_DIR/careerpack-prod-20000101-000000.zip.gpg"
test "$(find "$BACKUP_DIR" -name '*.zip' | wc -l)" -eq 0

printf '{"_id":"test-only"}\n' > "$FIXTURE/users/documents.jsonl"
gpg() { return 1; }
export -f gpg
if bash "$SCRIPT" >/dev/null 2>&1; then echo 'Encryption failure accepted'; exit 1; fi
test -f "$BACKUP_DIR/careerpack-prod-20000101-000000.zip.gpg"
unset -f gpg
bash "$SCRIPT" >/dev/null
test "$(find "$BACKUP_DIR" -type f | wc -l)" -eq 1
ARCHIVE="$(find "$BACKUP_DIR" -name '*.gpg')"
gpg --batch --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" --output "$TEMP/restored.zip" --decrypt "$ARCHIVE" 2>/dev/null
test "$(unzip -p "$TEMP/restored.zip" users/documents.jsonl)" = '{"_id":"test-only"}'
echo 'Cloud backup validation, encryption and retention checks passed'
