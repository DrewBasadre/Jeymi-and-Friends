#!/usr/bin/env bash
#
# Open the Pavo Android emulator with a visible window, then build + run the app.
# Run this from your OWN Terminal — a GUI emulator window cannot open from an
# automated/headless shell.
#
# Prereqs (one-time): JDK 17, Android SDK (platform 36, build-tools 36, an
# emulator system image) and an AVD named "pavo".
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

AVD="${1:-pavo}"

# Boot the emulator (visible window) unless one is already running.
if ! adb devices | grep -q "emulator-"; then
  echo "Booting emulator '$AVD'…"
  "$ANDROID_HOME/emulator/emulator" -avd "$AVD" -gpu host >/tmp/pavo-emulator.log 2>&1 &
  adb wait-for-device
  echo "Waiting for boot to complete…"
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
fi

cd "$(dirname "$0")"
npm run android
