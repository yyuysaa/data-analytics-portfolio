# Task 10 — Device Verification Checklist

Everything that can be checked without a phone has already been checked (bundle, lint,
SDK API signatures, streak rules, cross-file contracts). What is left needs a real
iPhone, because the camera, the photo library and notification delivery do not exist
in a simulator or on the desktop.

## Before you start

- **Node version.** The installed Node is v20.17.0; Expo SDK 57 asks for >= 20.19.4 and
  prints an "outdated and unsupported" warning on every command. It still bundles fine,
  but upgrading first saves you from chasing a phantom bug (`nvm install 20.19.4` or grab
  the current LTS from nodejs.org).
- **Same Wi-Fi.** Phone and Mac on the same network, then `npx expo start` and scan the QR
  code with the Camera app.
- **Expo Go is enough.** This app only uses *local* scheduled notifications, which
  [still work in Expo Go](https://docs.expo.dev/versions/latest/sdk/notifications/) — only
  remote push needs a development build. If notifications turn out not to fire at all in
  Expo Go, fall back to `npx expo run:ios` on a cabled iPhone.
- **Say yes to the prompts.** Notifications on the first "Save & Schedule", camera and
  photo library on the first visit to the camera screen. If you tap "Don't Allow" by
  reflex, iOS will not ask again — you have to fix it in Settings → PRESENT (or
  Settings → Expo Go).

## Step 1 — App loads

Scan the QR code.

**Expect:** a cream screen titled PRESENT, a big `0` above "day streak", a "Today's
activity" card reading "Nothing scheduled yet…", a text box, an inline spinner-style time
picker, and a peach "Save & Schedule" button that is greyed out until you type something.

## Step 2 — Schedule a nudge (FR-1.3, FR-2.1, FR-2.2)

Type an activity name (something distinctive, like "Data Science class"), set the picker
one or two minutes into the future, tap **Save & Schedule**.

**Expect:** an iOS notification permission prompt on first use. The "Today's activity"
card then updates to the name plus the time in 24-hour form (`14:07`). Lock the phone or
send the app to the background and wait for the clock to tick over.

**Expect at the scheduled minute:** a banner titled **PRESENT** whose body is one of five
warm messages with your activity name spliced in, e.g. "Time for Data Science class — go
be brilliant! ✨". The name must appear in the body — that is the FR-2.2 check.

> Note: the trigger is a *daily repeating* one, so it will also fire at this time tomorrow.
> Schedule something else (or delete the app) when you are done testing.

## Step 3 — Check in with a photo (FR-3.1, FR-3.2, FR-3.3)

Tap the notification.

**Expect:** the app opens straight onto a black full-screen camera preview with a white
ring shutter at the bottom and the hint "Take a photo to check in". Camera and photo
library prompts appear the first time. The shutter is dimmed for a moment until the camera
reports ready, then goes solid.

Tap the shutter.

**Expect:** the hint changes to "Saving your check-in…", then you land back on the home
screen. Open the Photos app — the photo should be in your library (Recents).

**Also worth trying:** tap the notification while the app is fully closed (force-quit
first). It should still land on the camera, not the home screen — that is the cold-start
path App.js handles with a pending-route ref.

## Step 4 — Streak appears and persists (FR-4.2, FR-4.6)

**Expect:** back on the home screen the big number reads **1**, and the hint under it has
changed to "One photo check-in keeps your streak going."

Force-quit the app (swipe up), reopen it.

**Expect:** still `1`, and the activity name and time are still in the card and pre-filled
into the form. That is the AsyncStorage persistence check.

## Step 5 — Same day does not double count (FR-4.5)

Trigger a second check-in the same day. You do not need to wait for another notification —
you can reach the camera screen again by tapping the notification if it is still in
Notification Centre, or by scheduling one a minute ahead again.

**Expect:** the photo saves as usual, and the streak still reads **1**. It must not go
to 2.

## Step 6 — Increment and reset (FR-4.3, FR-4.4)

This step needs you to fake the stored date, since you cannot wait a day. There is no UI
for it, so pick one of these:

**Option A — dev-only button (simplest on a phone).** Temporarily add this to HomeScreen,
above the return statement, and a `Pressable` that calls it:

```js
// TEMPORARY — task 10 verification only, delete afterwards.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STREAK_KEY } from '../constants';

async function fakeLastCheckIn(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ count: 1, lastCheckInDate: date }));
}
```

**Option B — debugger console.** Press `j` in the `expo start` terminal to open the Hermes
debugger, then run the same two `AsyncStorage.setItem` calls from its console.

Then:

1. Set `lastCheckInDate` to **yesterday** with `count: 1`, reopen the home screen (it
   re-reads on focus, so it should show `1`), and check in.
   **Expect: 2.**
2. Set `lastCheckInDate` to **several days ago** with any count, then check in.
   **Expect: 1.**

Delete the temporary code when you are done.

---

## If something looks wrong

| Symptom | Most likely cause |
|---|---|
| No notification arrives | Permission denied, or Focus/Do Not Disturb is on. Check Settings → Notifications → Expo Go. |
| Notification arrives but tapping does nothing | The response listener in App.js — check the Metro terminal for errors. |
| Camera screen stuck on "Getting the camera ready…" | A permission hook never resolved; reload the app from the dev menu. |
| Photo taken but not in Photos | The photo-library permission was granted read-only or denied. This app asks write-only. |
| Streak jumps by more than 1 | `recordCheckIn()` being called twice — but the same-day rule is verified in code, so suspect a double navigation instead. |
