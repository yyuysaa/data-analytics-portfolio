
# Implementation Plan: PRESENT Core Loop

- [x] 1. Initialize the Expo project and install dependencies
  - Scaffold a blank Expo (managed workflow) project in the workspace root
  - Install: `expo-notifications`, `expo-camera`, `expo-media-library`, `@react-native-async-storage/async-storage`, `@react-navigation/native`, `@react-navigation/native-stack`, `@react-native-community/datetimepicker`, `react-native-safe-area-context`, `react-native-screens`
  - Add iOS camera and photo-library permission strings to `app.json`
  - Confirm the dev server starts and the blank app loads in Expo Go
  - _Requirements: NFR-2, NFR-3_

- [x] 2. Create the folder structure and shared constants
  - Create `src/screens/` and `src/utils/`
  - Create `src/constants.js` exporting the two AsyncStorage keys (`@present_activity`, `@present_streak`) and the array of hardcoded nudge templates
  - Add a header comment in `constants.js` explaining that these are the app's shared values
  - _Requirements: NFR-1_

- [x] 3. Implement the AI nudge placeholder
  - Create `src/utils/generateNudge.js`
  - Export `generateNudge(activityName)` that picks a random template from `constants.js` and substitutes `{activity}` with the activity name
  - Add a prominent `SWAP POINT` comment marking where the real AI API call will replace the hardcoded body
  - _Requirements: FR-2.2, FR-2.3, FR-2.4_

- [x] 4. Implement the storage helpers for the activity
  - Create `src/utils/storage.js`
  - Implement `saveActivity(activity)` to write `{ name, time }` as JSON under `@present_activity`, overwriting any previous activity
  - Implement `loadActivity()` to read and parse the stored activity, returning `null` when nothing is saved
  - _Requirements: FR-1.3, FR-1.4_

- [x] 5. Implement the consecutive-day streak logic
  - Add a small `getTodayString()` helper returning today's date as `YYYY-MM-DD`
  - Implement `getStreakData()` returning `{ count, lastCheckInDate }`, defaulting to `{ count: 0, lastCheckInDate: null }`
  - Implement `recordCheckIn()` in `src/utils/storage.js` as the single place all streak rules live:
    - If `lastCheckInDate` is today, return the existing data unchanged so same-day check-ins never double-count
    - If `lastCheckInDate` is yesterday, increment `count` by 1 and set `lastCheckInDate` to today
    - Otherwise (a gap, or the first ever check-in), set `count` to 1 and set `lastCheckInDate` to today
    - Mark the reset branch with a `FREEZE POINT` comment noting where a future streak freeze would be checked before resetting
  - Persist the updated object and return it so callers can show the new count
  - _Requirements: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6_

- [x] 6. Build the HomeScreen UI
  - Create `src/screens/HomeScreen.js`
  - Add a `TextInput` for the activity name and a `DateTimePicker` in time mode for the hour and minute
  - On mount, load the saved activity and streak data and render them (activity name plus time, and the streak count as a large number)
  - Show a friendly empty state when no activity has been saved yet
  - Add comments above each section explaining its purpose
  - _Requirements: FR-1.1, FR-1.2, FR-4.2_

- [x] 7. Wire up saving and notification scheduling on HomeScreen
  - Add a "Save & Schedule" button handler that:
    - Requests notification permissions and shows a simple alert if they are denied
    - Saves the activity via `saveActivity()`
    - Cancels all previously scheduled notifications so only one is ever active
    - Calls `generateNudge(activityName)` and schedules a daily repeating local notification with title `PRESENT` and the nudge as the body
  - Refresh the displayed activity after saving
  - _Requirements: FR-1.3, FR-1.4, FR-2.1, FR-2.2_

- [x] 8. Build the CameraScreen check-in flow
  - Create `src/screens/CameraScreen.js`
  - Request camera and media-library permissions on mount and render a short message while permissions are pending or denied
  - Render a full-screen `expo-camera` preview with a single capture button
  - On capture: take the photo, save it to the device media library via `expo-media-library`, call `recordCheckIn()`, then navigate back to Home
  - Add comments above each section explaining its purpose
  - _Requirements: FR-3.2, FR-3.3, FR-3.4, FR-4.1, FR-4.2_

- [x] 9. Set up navigation and the notification tap handler in App.js
  - Configure a native stack navigator with `Home` and `Camera` screens wrapped in `NavigationContainer` and `SafeAreaProvider`
  - Set the foreground notification handler so notifications display while the app is open
  - Register a notification response listener that navigates to `Camera` when the user taps a nudge, and clean the listener up on unmount
  - Ensure HomeScreen re-reads the streak when it regains focus so the new count appears after a check-in
  - Add comments explaining the listener wiring
  - _Requirements: FR-3.1, FR-4.2_

- [ ] 10. Verify the full loop on a physical device
  - Run the app in Expo Go on an iPhone
  - Save an activity scheduled one or two minutes ahead and confirm the notification arrives with a warm, activity-specific nudge
  - Tap the notification, confirm the camera opens, take a photo, and confirm it appears in the photo library
  - Confirm the home screen streak reads 1, then force-quit and reopen to confirm the activity and streak persist
  - Check in a second time the same day and confirm the streak stays at 1
  - Temporarily set `lastCheckInDate` to yesterday, check in, and confirm the streak becomes 2; set it to several days ago and confirm it resets to 1
  - _Requirements: FR-1.3, FR-2.1, FR-3.1, FR-3.3, FR-4.3, FR-4.4, FR-4.5, FR-4.6_
