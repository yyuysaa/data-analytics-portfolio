# Design: PRESENT Core Loop

#[[file:requirements.md]]

---

## 1. Project Structure

```
PRESENT - app/
├── App.js                   # Entry point: sets up navigation and notification listeners
├── app.json                 # Expo configuration
├── package.json
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js    # Main screen: add activity, view streak
│   │   └── CameraScreen.js  # Camera check-in screen
│   ├── utils/
│   │   ├── generateNudge.js # AI nudge placeholder (swap later)
│   │   └── storage.js       # AsyncStorage helpers for activity & streak
│   └── constants.js         # Hardcoded nudge messages, keys, etc.
```

All logic lives in a flat `src/` folder with two screens and two utility files. No nested layers, no state management libraries.

---

## 2. Navigation Flow

```
┌─────────────┐   tap notification   ┌───────────────┐   photo saved   ┌─────────────┐
│ HomeScreen  │ ──────────────────▶  │ CameraScreen  │ ─────────────▶  │ HomeScreen  │
│             │                       │               │                  │ (streak      │
│             │                       │               │                  │  updated)    │
└─────────────┘                       └───────────────┘                  └─────────────┘
```

- **Navigation library:** `@react-navigation/native` with a simple stack navigator.
- Two screens only: `Home` and `Camera`.

---

## 3. Component Design

### 3.1 HomeScreen

| Element | Purpose |
|---------|---------|
| Text input | Activity name (e.g. "Data Science class") |
| Time picker | Select hour & minute — use a simple `DateTimePicker` from `@react-native-community/datetimepicker` |
| "Save & Schedule" button | Saves activity to AsyncStorage, schedules the local notification |
| Streak display | Large number showing current streak count |
| Current activity display | Shows the name and time of the saved activity (if any) |

**Behavior on mount:**
1. Load saved activity and streak from AsyncStorage.
2. Display them.

**Behavior on "Save & Schedule":**
1. Save `{ name, time }` to AsyncStorage.
2. Cancel any previously scheduled notification.
3. Call `generateNudge(activityName)` to get the nudge text.
4. Schedule a new local notification at the chosen time with the nudge as the body.

### 3.2 CameraScreen

| Element | Purpose |
|---------|---------|
| Camera view | Full-screen camera preview |
| Capture button | Takes a photo |

**Behavior:**
1. Request camera and media-library permissions on mount.
2. On capture: save photo to the device media library via `expo-media-library`.
3. Record the check-in via `recordCheckIn()` (see Storage Utility below) — this handles streak logic.
4. Navigate back to HomeScreen.

---

## 4. Data Model (AsyncStorage)

| Key | Value | Example |
|-----|-------|---------|
| `@present_activity` | JSON string | `{"name":"Data Science","time":"13:00"}` |
| `@present_streak` | JSON string | `{"count":7,"lastCheckInDate":"2026-07-31"}` |

- `count`: current consecutive-day streak.
- `lastCheckInDate`: ISO date string (`YYYY-MM-DD`) of the most recent check-in day.

Simple key-value. No relational data. Time stored as `HH:mm` string.

---

## 5. Notification Design

- **Library:** `expo-notifications`
- **Type:** Local scheduled notification (not push).
- **Trigger:** Calendar trigger at the specified hour and minute (repeats daily once set).
- **Content:** Title = "PRESENT" ; Body = output of `generateNudge(activityName)`.
- **Tap behavior:** The app registers a notification response listener in `App.js`. On tap, it navigates to `CameraScreen`.

### Permission Handling
- Request notification permissions on first "Save & Schedule" action.
- If denied, show a simple alert — no complex fallback.

---

## 6. generateNudge(activityName) — AI Placeholder

```js
// src/utils/generateNudge.js

// 🔌 SWAP POINT: Replace the body of this function with a real AI API call later.
// It should return a string — the encouraging nudge message.

const nudges = [
  `Time for {activity} — go be brilliant! ✨`,
  `Hey, {activity} is calling. You've got this! 💪`,
  `Your future self will thank you. {activity} starts now! 🚀`,
  `Shine time! {activity} awaits. Show up and be PRESENT. 🌟`,
  `Small steps, big wins. Let's do {activity}! 🎯`,
];

export function generateNudge(activityName) {
  const template = nudges[Math.floor(Math.random() * nudges.length)];
  return template.replace('{activity}', activityName);
}
```

One exported function; one file. Easy to find, easy to replace.

---

## 7. Storage Utility

```js
// src/utils/storage.js
// Thin wrappers around AsyncStorage for activity and streak data.

export async function saveActivity(activity) { /* store JSON */ }
export async function loadActivity() { /* parse JSON or return null */ }
export async function getStreakData() { /* return { count, lastCheckInDate } */ }

// Core streak logic lives here in ONE function so a streak-freeze can be
// added later without touching multiple files.
export async function recordCheckIn() {
  // 1. Get today's date as YYYY-MM-DD.
  // 2. Load current streak data.
  // 3. If lastCheckInDate === today → do nothing (already checked in today).
  // 4. If lastCheckInDate === yesterday → increment count by 1, update date.
  // 5. Otherwise (gap > 1 day, or first ever) → set count to 1, update date.
  // 🔌 FREEZE POINT: Step 5 is where a future "streak freeze" check would go —
  //    before resetting, check if the user has a freeze available.
}
```

---

## 8. Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo` | Managed workflow runtime |
| `expo-notifications` | Schedule & receive local notifications |
| `expo-camera` | Camera preview and photo capture |
| `expo-media-library` | Save photos to device gallery |
| `@react-native-async-storage/async-storage` | Local key-value persistence |
| `@react-navigation/native` | Screen navigation |
| `@react-navigation/native-stack` | Stack navigator |
| `@react-native-community/datetimepicker` | Native time picker |
| `react-native-safe-area-context` | Safe area insets (required by react-navigation) |
| `react-native-screens` | Native screen containers (required by react-navigation) |

---

## 9. Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| One activity at a time | Simplest possible data model; no list UI needed |
| Daily repeating notification | User sets it once, it fires every day at that time |
| Consecutive-day streak with reset | Matches user mental model (Duolingo-style); all logic in one `recordCheckIn` function for easy future freeze addition |
| `expo-camera` over `expo-image-picker` | Gives a dedicated full-screen camera feel matching the "check-in" UX |
| No state management lib (Redux, Zustand) | Two screens + AsyncStorage is simple enough with React state |
| Comments in every file | Beginner readability requirement |

---

## 10. Future Extension Points

- **Real AI nudges:** Replace `generateNudge` body with an API call (OpenAI, etc.).
- **Multiple activities:** Change AsyncStorage value from single object to array; add a FlatList on HomeScreen.
- **Streak Freeze:** Add a freeze inventory to AsyncStorage; in `recordCheckIn()` step 5, check if a freeze is available before resetting to 1. The current design isolates all streak logic in that one function for exactly this reason.
- **Social feed:** New navigation tab + cloud backend (separate spec).
