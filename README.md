# MyCal AI

MyCal AI is a personal food, fitness, water, and weight tracker for Android.
Your tracker data is stored on your device; there is no account or cloud sync.
Gemini AI is optional, and the app's core tracking and offline food estimates
work without a Gemini key.

The web app is organized into `index.html` for structure, `styles.css` for
presentation, and `app.js` for application behavior. `npm run build:web`
copies these files and the required plugin assets into `www/`.

## Features

- Log meals using a photo, a meal description, or saved foods. Edit saved meal
  nutrition and portion sizes, which automatically scale with the portion.
- Track calories, macronutrients, workouts, steps, weight, and water.
- Edit saved workout routines, including sets, reps, and weights.
- View front/back muscle maps with primary and supporting regions, plus
  estimated strength trends on-device. Muscle highlights are local exercise
  name estimates, not measured activation.
- See a separate estimate of workout and step calories burned today. This
  estimate is informational only and never increases the daily calorie limit.
- Get automatic weekly, monthly, and yearly activity recaps after each period
  ends, with swipeable cards for meals, workouts, steps, macros, and habits.
  Reopen recent recaps from the Coach screen.
- Receive local notifications when a recap is ready, with a period-specific
  tagline. Notification permission is requested only when there is recap
  activity to notify you about.
- Set your daily water target with the pencil button beside the water tracker.
- Choose recurring water reminder intervals from 30 minutes to 12 hours. Water
  reminders run from 8 AM to 10 PM and stop for the day when the target is met.
- Create meal and weight reminders.
- Optionally connect Health Connect for read-only step tracking.
- Optionally use Gemini for AI meal analysis and coaching.
- Export and import a JSON backup of your tracker history.

Nutrition and activity values are estimates, not medical advice.
Your daily calorie goal is an intake limit; workouts and steps do not increase
the remaining calorie allowance.

## Your data and privacy

Tracker information is saved in the app's on-device IndexedDB storage. It is
not uploaded to a MyCal account or synced to the cloud. Existing local tracker
data is migrated automatically the first time an updated app opens. Clearing
app data or uninstalling the app can erase its local data. Export a backup
before moving to a new phone or uninstalling.

Use **Settings > Data > Export JSON** to save a backup, and **Import JSON** to
restore one. Importing replaces the tracker history currently on this device.
Backups do not include your Gemini API key or Health Connect permission.

If you use Gemini, meal photos or descriptions you submit for AI analysis are
sent to Google's Gemini service. Your API key is stored on this device and is
not included in backups. Gemini features need an internet connection. You can
continue using offline tracking and food estimates without a key.
Exercise muscle highlights use the locally bundled `body-muscles` anatomy
chart and exercise-name matching. They do not analyze or upload body photos.
Workout and step calorie-burn estimates are also calculated on-device; step
and workout estimates may overlap.

For Health Connect steps, the app requests read-only access. You can review
the [privacy policy](./privacypolicy.html) for more information.

## Gemini AI (optional)

To enable AI features, open **Settings**, follow the **How to connect Gemini**
steps, and enter your Google AI Studio key. You can also choose **Continue
without AI** and use the app without connecting Gemini.

## App updates

When a newer version is available, MyCal AI checks for it when you open the
app while connected to the internet. The update message lists the new
features and shows **Update now** and **Do it later**.

If you choose **Do it later**, you can keep using the app; the update message
can appear again the next time you open it. If you choose **Update now**,
Android opens its installer and asks you to approve the installation. Android
may also ask you to allow app installs from MyCal AI. The update is not
installed silently.

The first version with in-app updates must be installed manually. After that,
installing an update signed by the same publisher keeps your existing app and
its local data.

## Reminders and steps

Choose meal reminder times on the Today screen and set a weekly weight
reminder in Settings. Allow notifications and alarms when Android requests
permission.

Connect Health Connect from **Steps today** and allow read-only step access.
Health Connect is built into Android 14 and newer; older supported phones may
need the Health Connect app installed.
