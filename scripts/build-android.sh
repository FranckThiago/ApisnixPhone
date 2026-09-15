#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -x "$project_root/apps/android/gradlew" ]]; then
  echo "Prepare the sources first: python3 scripts/prepare-sources.py android" >&2
  exit 1
fi
if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  echo "Set ANDROID_HOME to the installed Android SDK directory." >&2
  exit 1
fi
cd "$project_root/apps/android"
./gradlew :app:assembleDebug --console=plain
mkdir -p "$project_root/dist/android"
shopt -s nullglob
apks=(app/build/outputs/apk/debug/apisnixphone-*.apk)
if (( ${#apks[@]} == 0 )); then
  echo "Build completed without an ApisnixPhone APK." >&2
  exit 1
fi
cp "${apks[@]}" "$project_root/dist/android/"
echo "Internal test APKs: $project_root/dist/android (not a production release)."
