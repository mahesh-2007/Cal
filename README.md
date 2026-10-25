# MyCal AI for Android

The Android app wraps the existing `index.html` in a native Capacitor app. Keep
editing `index.html` and `icon.jpg` in the project root; the web assets are
copied into `www/` when building or syncing Android.

## Requirements

- Node.js 20 or newer
- Android Studio with the Android SDK installed
- JDK 21. If Android Studio bundles a newer JDK, select JDK 21 in its Gradle
  JDK setting.

## Install dependencies and sync the Android project

```sh
npm install
npm run android:sync
```

The Android project is included in this repository. Open it in Android Studio
with `npm run android:open`, let Gradle finish syncing, then choose
**Build > Build Bundle(s) / APK(s) > Build APK(s)**.
The generated APK is at
`%LOCALAPPDATA%\MyCalAI\AndroidBuild\app\outputs\apk\debug\app-debug.apk`.
Build intermediates are kept outside the synced project folder to avoid
OneDrive file-lock issues.

Before each Android build, run `npm run android:sync` to include the latest
changes to the web app.

The app ID is `com.mycalai.app`. Change it in `capacitor.config.json` before
publishing if you want a different permanent Android package name.

## Reminders

On the Today screen, set separate daily reminder times for breakfast, lunch,
dinner, and snacks. Set a weekly weight check-in by choosing its day and time
in **Weight reminder**. In **Coach > Ask Cal**, you can also enter a reminder in
plain language. Allow notifications and **Alarms & reminders** access when
Android asks; exact-alarm access is needed for reminders to fire at the chosen
time. Scheduled reminders use Android local notifications and can fire while
the app is closed. Meal log entries also have a manually selectable time.

## Health Connect steps

The Android build requires Android 8.0 (API 26) or newer. On Android 14 and
newer, Health Connect is built in; older supported phones need the Health
Connect app installed. In MyCal AI, tap **Connect Health Connect** and allow
step access. The app requests read-only access to steps, syncs daily totals
when opened or returned to the foreground, and leaves manually entered totals
unchanged. Android's Health Connect permission rationale and permission-usage
screen display the same `privacypolicy.html` included in the app. Review it
before distributing the app.

## JSON backups

Open **Settings > Data > Export JSON** to save a portable copy of your tracker
history. On Android, choose a destination in the system file picker; in a
browser, the JSON file downloads normally. On the new device, choose
**Import JSON** and select that file. Importing replaces tracker history on
that device, after confirmation. The AI key and Health Connect permission are
device-specific and are not included in backups.

## Install the APK on a phone

Copy
`%LOCALAPPDATA%\MyCalAI\AndroidBuild\app\outputs\apk\debug\app-debug.apk`
to the phone with a USB cable or Android file transfer. Open the APK on the
phone and allow installation from that source when Android asks. This debug APK
is for testing and personal use, not a Play Store release.
