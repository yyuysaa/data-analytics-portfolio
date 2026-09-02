# Requirements Document

## Introduction

PRESENT is an iOS-only, offline personal accountability app built with Expo SDK 57 (managed workflow), React Native 0.86.2 and React 19.2.3. The core loop already works: the user schedules one activity, receives a daily local nudge, checks in with a photo, and builds a consecutive-day streak (see `.kiro/specs/present-core-loop/`).

This spec hardens that working app for App Store submission. It covers 16 production issues across five themes: notification reliability, activity lifecycle control, capture and save correctness, first-run and feedback UX, and privacy compliance. Every requirement is an incremental change to the existing codebase — no rewrites, no backend, no Android behaviour, and no new screens beyond onboarding and data privacy.

## Glossary

- **PRESENT_App**: The root application module (`App.js`), owning navigation, the notification response listener, and app-state handling.
- **Home_Screen**: The main screen (`HomeScreen.js`) showing the streak, the scheduled activity, and the activity form.
- **Camera_Screen**: The photo check-in screen (`CameraScreen.js`).
- **Onboarding_Screen**: A new first-run screen explaining the core loop.
- **Data_Privacy_Screen**: A new screen offering data export, data deletion, and photo-storage information.
- **Nudge_Scheduler**: A new module (`src/utils/scheduleNotification.js`) that is the single caller of the notification scheduling and cancellation APIs.
- **Save_Controller**: A new hook (`src/hooks/useSaveActivity.js`) that owns the save-and-schedule flow, its in-flight lock, and its loading state.
- **Activity_Store**: The activity functions of `src/utils/storage.js` (`saveActivity`, `loadActivity`, `clearActivity`, `togglePause`).
- **Streak_Store**: The streak functions of `src/utils/storage.js` (`getStreakData`, `recordCheckIn`).
- **Photo_Index**: A stored JSON array of `{ uri, date }` records, one per saved check-in photo, under key `@present_photos`.
- **Photo_Counter**: The stored integer under key `@present_photo_count`, equal to the length of the Photo_Index, written in the same storage operation as the Photo_Index and read by the Home_Screen in place of parsing the Photo_Index.
- **Activity**: The stored record `{ name: string, time: "HH:mm", paused?: boolean, createdAt?: string }`. Exactly one Activity exists at a time.
- **Onboarding_Flag**: The stored value under key `@present_onboarding_done`, equal to `"true"` once onboarding has been completed.
- **Handled_Response_Identifier**: The in-memory identifier of the notification response that the PRESENT_App has already navigated for during the current app process. At most one such identifier is held, and it is not persisted across process restarts.
- **Nudge**: The notification body text produced by `generateNudge(activityName)`.
- **Check_In**: One recorded photo capture for a calendar day, as defined by `recordCheckIn()`.
- **Lapsed_Streak**: A streak whose `count` is greater than 0 and whose `lastCheckInDate` is earlier than the previous calendar day, where the current and previous calendar days are derived from the device's local timezone as `YYYY-MM-DD` strings.
- **Active_State**: The iOS `AppState` value `'active'`.

## Requirements

### Requirement 1: Fresh Nudge Text and Timezone-Resilient Scheduling

**User Story:** As a daily user, I want each nudge to read differently and to arrive at my chosen local clock time even after I travel or the clocks change, so that the reminder stays meaningful and punctual.

#### Acceptance Criteria

1. WHERE a stored Activity exists whose `paused` field resolves to `false` and whose `time` field matches `^([01]\d|2[0-3]):([0-5]\d)$`, WHEN the PRESENT_App enters Active_State, THE Nudge_Scheduler SHALL cancel all scheduled notifications and then schedule exactly 1 DAILY notification derived from that Activity.
2. WHEN THE Nudge_Scheduler schedules a DAILY notification, THE Nudge_Scheduler SHALL set the notification body to the string returned by the call `generateNudge(activity.name)` made during that same scheduling operation, and that body SHALL be non-empty and SHALL contain the Activity `name`.
3. WHEN THE Nudge_Scheduler schedules a DAILY notification, THE Nudge_Scheduler SHALL pass an integer hour in the range 0 to 23 and an integer minute in the range 0 to 59 parsed from the Activity `time` field, and SHALL pass no absolute date and no explicit timezone identifier in the trigger, so that the iOS notification system resolves the fire time against the device's current timezone offset.
4. WHEN a scheduling operation of THE Nudge_Scheduler resolves successfully, a query of scheduled notifications issued after that operation resolves SHALL report exactly 1 scheduled notification.
5. WHERE the stored Activity has `paused` equal to `true`, WHEN the PRESENT_App enters Active_State, a query of scheduled notifications issued after that operation resolves SHALL report 0 scheduled notifications.
6. IF no Activity record exists when the PRESENT_App enters Active_State, or `loadActivity` returns null because the stored Activity record is unreadable, THEN a query of scheduled notifications issued after that operation resolves SHALL report 0 scheduled notifications.
7. WHILE a scheduling operation of THE Nudge_Scheduler is in flight, THE Nudge_Scheduler SHALL return for each further scheduling request without issuing a cancellation call and without issuing a scheduling call.
8. IF a cancellation call or a scheduling call rejects with an error, THEN THE Nudge_Scheduler SHALL record the error through `console.warn` and release the in-flight lock before returning, so that the next scheduling request is accepted.
9. IF the stored Activity `time` field does not match `^([01]\d|2[0-3]):([0-5]\d)$`, THEN THE Nudge_Scheduler SHALL leave 0 notifications scheduled, leave the stored Activity record unchanged, and record the rejected value through `console.warn`.
10. WHEN the PRESENT_App enters Active_State within 1000 milliseconds of the most recently resolved scheduling operation, THE Nudge_Scheduler SHALL return without issuing a cancellation call and without issuing a scheduling call, independently of the in-flight lock of criterion 7.
11. WHERE a notification for the stored Activity has already been delivered on the current calendar day, WHEN THE Nudge_Scheduler schedules a DAILY notification, THE Nudge_Scheduler SHALL set the next fire time to the Activity time on the next calendar day, dismiss zero already-delivered notifications, and re-deliver zero already-delivered notifications.

### Requirement 2: Pause and Delete a Scheduled Activity

**User Story:** As a user whose plans changed, I want to pause or delete my activity, so that PRESENT stops nudging me about something I am not doing.

#### Acceptance Criteria

1. WHILE the Home_Screen displays a stored Activity, THE Home_Screen SHALL display a Pause control and a Delete control on the activity card, each presenting a touch target of at least 44 by 44 points.
2. WHEN the user activates the Delete control, THE Home_Screen SHALL display a confirmation prompt that states the Activity name and states that the streak count and the check-in history are retained.
3. WHEN the user confirms deletion, THE Activity_Store SHALL remove the Activity record from storage.
4. WHEN the user confirms deletion, THE Nudge_Scheduler SHALL cancel all scheduled notifications.
5. WHEN deletion completes, THE Home_Screen SHALL display the no-activity empty state, set the activity name field to an empty string, and reset the time picker selection to the first-launch default value.
6. WHEN the user cancels the confirmation prompt, THE Activity_Store SHALL retain the Activity record unchanged and the set of scheduled notifications SHALL remain unchanged.
7. WHEN the user activates the Pause control, THE Activity_Store SHALL set the Activity `paused` field to `true`, and after that write resolves successfully THE Nudge_Scheduler SHALL cancel all scheduled notifications.
8. WHILE the stored Activity has `paused` equal to `true`, THE Home_Screen SHALL display a Paused badge on the activity card and replace the Pause control with a Resume control presenting a touch target of at least 44 by 44 points.
9. WHEN the user activates the Resume control, THE Activity_Store SHALL set the Activity `paused` field to `false` and THE Nudge_Scheduler SHALL schedule one DAILY notification for the Activity time.
10. WHERE a stored Activity record omits the `paused` field, THE Activity_Store SHALL report `paused` as `false`.
11. WHEN the user confirms deletion of the Activity, THE Streak_Store SHALL retain the `count` value and the `lastCheckInDate` value held immediately before the deletion.
12. IF the storage write of a pause operation or a resume operation rejects, THEN THE Home_Screen SHALL display an error message, display the control set and the Paused badge derived from the previously stored `paused` value, and the number of scheduled notifications SHALL remain unchanged.
13. THE Home_Screen SHALL expose, for the Pause control, the Resume control and the Delete control, an accessibility label that names the control action and the Activity name.

### Requirement 3: Save Feedback and Single-Flight Saving

**User Story:** As a user tapping "Save & Schedule", I want visible confirmation that the save worked and protection against a double tap, so that I trust my nudge is set up exactly once.

#### Acceptance Criteria

1. WHEN the user activates the Save & Schedule control, THE Save_Controller SHALL acquire the ref-based in-flight lock and set `isSaving` to `true` before the first storage write.
2. WHILE `isSaving` is `true`, THE Home_Screen SHALL render an activity indicator in place of the Save & Schedule label and set the control to disabled.
3. WHILE a `saveAndSchedule` operation is in flight, THE Save_Controller SHALL return `false` for each additional `saveAndSchedule` call received before that operation settles, and perform zero storage writes and zero scheduling calls for those calls.
4. WHEN a `saveAndSchedule` operation completes successfully, THE Save_Controller SHALL return `true` and THE Activity_Store SHALL hold the activity name trimmed of leading and trailing whitespace, the selected time in `HH:mm` form, and `paused` equal to `false`, so that saving while the Activity is paused resumes that Activity.
5. WHEN a `saveAndSchedule` operation finishes, THE Save_Controller SHALL release the in-flight lock and set `isSaving` to `false` on both the success path and the error path, and WHERE the Home_Screen has unmounted before that operation settles, THE Save_Controller SHALL perform zero `isSaving` state updates.
6. WHEN a `saveAndSchedule` operation returns `true`, THE Home_Screen SHALL display for 2000 milliseconds a confirmation message that states the saved Activity name and the saved time in `HH:mm` form, and SHALL cancel the pending hide timer if the Home_Screen unmounts before those 2000 milliseconds elapse.
7. IF a `saveAndSchedule` operation returns `false` for a reason other than rejection by the in-flight lock of criterion 3, THEN THE Home_Screen SHALL display an error message that states the reason for the failure and retain the entered activity name and the selected time in the form.
8. WHEN the user activates the Save & Schedule control with an activity name that is empty after trimming leading and trailing whitespace, THE Save_Controller SHALL return `false` and perform zero storage writes.
9. WHEN THE Activity_Store writes an Activity, THE Activity_Store SHALL store the `time` field in a format matching `^\d{2}:\d{2}$`.
10. WHEN the user activates the Save & Schedule control with an activity name longer than 60 characters after trimming leading and trailing whitespace, THE Save_Controller SHALL return `false` and perform zero storage writes and zero scheduling calls.
11. IF the storage write of a `saveAndSchedule` operation rejects, THEN THE Save_Controller SHALL perform zero scheduling calls, leave the stored Activity record unchanged, and return `false`.
12. IF the storage write of a `saveAndSchedule` operation resolves and the scheduling call then rejects, THEN THE Save_Controller SHALL retain the written Activity record and return `false`, and THE Home_Screen SHALL display a message stating that the activity was saved and that the nudge was not scheduled.

### Requirement 4: Time Selection Transparency

**User Story:** As a user picking a time, I want to know when my first nudge will actually arrive, so that I am not silently waiting until tomorrow.

#### Acceptance Criteria

1. WHERE the selected time, compared at whole-minute granularity in the device's local timezone, is earlier than or equal to the current device local time on the current calendar day, THE Home_Screen SHALL display the tomorrow hint variant, stating the selected time in `HH:mm` form and stating that the first nudge arrives tomorrow.
2. WHERE the selected time, compared at whole-minute granularity in the device's local timezone, is strictly later than the current device local time on the current calendar day, THE Home_Screen SHALL display the today hint variant, stating the selected time in `HH:mm` form and stating that the first nudge arrives today at that time.
3. WHEN the user changes the selected time, THE Home_Screen SHALL re-evaluate the comparison against the device local time read at the moment of that change and display the hint variant matching the newly selected time.
4. WHILE the activity form is displayed and the PRESENT_App is in Active_State, THE Home_Screen SHALL re-evaluate the comparison against the current device local time at intervals of at most 60 seconds and update the displayed hint to the variant matching that evaluation, so that a displayed today variant whose selected time has passed changes to the tomorrow variant within 60 seconds of that time passing.
5. WHEN the Home_Screen renders the activity form and the user has performed zero changes to the time picker, THE Home_Screen SHALL display the hint derived from the picker default value of the current device local time, which by criterion 1 is the tomorrow variant.
6. WHEN the displayed hint text changes from its previously displayed value, THE Home_Screen SHALL announce the updated hint text to the iOS screen reader.

### Requirement 5: Exit Path from the Camera Screen

**User Story:** As a user who opened the camera by accident or changed my mind, I want a visible way back, so that I am not trapped on a full-screen camera.

#### Acceptance Criteria

1. WHILE the Camera_Screen is displayed, THE PRESENT_App SHALL display a back control inside the top safe-area inset of the Camera_Screen whose contrast ratio against the pixels rendered directly behind it is at least 4.5 to 1 for every camera preview content, including an all-white preview and an all-black preview.
2. WHEN the user activates the Camera_Screen back control, THE PRESENT_App SHALL display the Home_Screen within 500 milliseconds and leave the Streak_Store records and the Photo_Index unchanged.
3. THE Camera_Screen back control SHALL present a touch target of at least 44 by 44 points.
4. THE Camera_Screen back control SHALL expose the button accessibility role and an accessibility label that names the Home_Screen as the destination.
5. WHILE `isCapturing` is `true`, THE PRESENT_App SHALL set the Camera_Screen back control to disabled and perform zero navigation for any activation of that control, so that no capture attempt is abandoned between the photo asset creation and the `recordCheckIn` write.
6. WHILE the Camera_Screen displays the permission-pending holding state or the permission-denied holding state, THE PRESENT_App SHALL display a back control that satisfies criteria 1 through 4, and activating either that control or the existing Back to Home link SHALL display the Home_Screen.
7. IF the user activates the Camera_Screen back control while the Camera_Screen is the only route on the navigation stack, THEN THE PRESENT_App SHALL display the Home_Screen as the only route on the navigation stack and SHALL NOT background or terminate the PRESENT_App.

### Requirement 6: Reliable and Transactional Photo Check-In

**User Story:** As a user checking in, I want either a saved photo with a recorded streak day or a clear error I can retry, so that a glitch never strands the shutter or silently loses my day.

#### Acceptance Criteria

1. WHEN a capture attempt finishes on the success path, on any rejection path, or on the path where the rollback deletion also fails, THE Camera_Screen SHALL set `isCapturing` to `false` within 1000 milliseconds of the capture attempt settling.
2. WHILE `isCapturing` is `true`, THE Camera_Screen SHALL set the shutter control to disabled and SHALL start zero additional capture attempts.
3. IF `takePictureAsync` rejects, THEN THE Camera_Screen SHALL append zero records to the Photo_Index, leave the Streak_Store records unchanged, remain on the Camera_Screen, and display an error message that states the capture can be retried when the rejection does not indicate a denied or restricted camera permission, or states that camera access must be enabled in iOS Settings when the rejection does indicate a denied or restricted camera permission.
4. IF `MediaLibrary.Asset.create` rejects, THEN THE Camera_Screen SHALL append zero records to the Photo_Index, leave the Streak_Store records unchanged, remain on the Camera_Screen, and display an error message that states the save can be retried when the rejection does not indicate a denied or restricted photo-library permission, or states that photo-library access must be enabled in iOS Settings when the rejection does indicate a denied or restricted photo-library permission.
5. IF `recordCheckIn` rejects after the photo asset is created, THEN THE Camera_Screen SHALL delete the created photo asset, append zero records to the Photo_Index, leave the Streak_Store records unchanged, display an error message stating that the check-in did not complete and can be retried, and remain on the Camera_Screen.
6. WHEN the photo asset is created and `recordCheckIn` resolves, including when `recordCheckIn` resolves as a same-day no-op, THE Camera_Screen SHALL append exactly one record of `{ uri, date }` to the Photo_Index, where `uri` is the URI of the created asset and `date` is the current calendar day in the device's local timezone in a format matching `^\d{4}-\d{2}-\d{2}$`, and display the Home_Screen.
7. WHEN a single capture attempt completes successfully, THE Streak_Store SHALL hold exactly one Check_In for the current calendar day, whether or not a Check_In for that day existed before the attempt.
8. IF the deletion of the created photo asset rejects while rolling back a rejected `recordCheckIn`, THEN THE Camera_Screen SHALL leave the Streak_Store records unchanged, append zero records to the Photo_Index, remain on the Camera_Screen, and display an error message stating that the streak day was not recorded, that the captured photo may remain in the iOS Photos app, and that the check-in can be retried.
9. IF the append to the Photo_Index rejects after `recordCheckIn` resolves, THEN THE Camera_Screen SHALL retain the recorded Check_In, retain the created photo asset, display zero error messages, and display the Home_Screen.
10. IF the PRESENT_App leaves Active_State while `isCapturing` is `true` and the capture attempt has not settled, THEN THE Camera_Screen SHALL, on the next return to Active_State, set `isCapturing` to `false`, leave the Streak_Store records unchanged, append zero records to the Photo_Index, and display a message stating that the capture was interrupted by the app being backgrounded and can be retried, worded differently from the capture-failure error message of criterion 3.

### Requirement 7: Streak Lapse Explanation

**User Story:** As a user who missed a day, I want PRESENT to tell me why my streak changed, so that the number never drops without explanation.

#### Acceptance Criteria

1. WHEN the Home_Screen focus read resolves with a streak record whose `count` is greater than 0 and whose `lastCheckInDate` is earlier than the previous calendar day — where the current calendar day and the previous calendar day are derived from the device local timezone as `YYYY-MM-DD` strings, so that gaps spanning month ends, year ends and DST transitions are classified by the same comparison (a Lapsed_Streak) — THE Home_Screen SHALL display, in the same render that displays the streak count, a message stating that a missed day ended the previous streak and that a new photo check-in starts a new streak, and SHALL keep that message visible until the Home_Screen loses focus or the user activates the message dismiss control, with no elapsed-time dismissal.
2. WHEN a Check_In sets the streak count to 1 and the `lastCheckInDate` held immediately before that Check_In was non-null and earlier than the previous calendar day, THE Home_Screen SHALL display the lapse explanation message on the first Home_Screen focus following that Check_In alongside the streak count of 1.
3. WHILE the stored streak record has `count` greater than 0 and `lastCheckInDate` equal to the current calendar day or the previous calendar day as derived in criterion 1, THE Home_Screen SHALL display the streak-continuing hint and hide both the lapse explanation message and the start-your-streak hint.
4. WHILE the stored streak record has `lastCheckInDate` equal to null or `count` equal to 0, THE Home_Screen SHALL display the start-your-streak hint and hide both the lapse explanation message and the streak-continuing hint.
5. WHEN the user activates the dismiss control on the lapse explanation message, THE Home_Screen SHALL hide that message for the remainder of the current Home_Screen focus and display it again on the next Home_Screen focus whose streak record still satisfies the Lapsed_Streak condition of criterion 1.
6. THE Home_Screen SHALL derive the lapse explanation message from the stored `count` and `lastCheckInDate` alone and SHALL state no numeric value for the streak length held before the lapse, because the Streak_Store record retains only `count` and `lastCheckInDate` and requires no additional stored field.
7. IF the streak record read on Home_Screen focus is unreadable, or holds a `lastCheckInDate` that does not match `^\d{4}-\d{2}-\d{2}$`, or holds a `lastCheckInDate` later than the current calendar day, THEN THE Home_Screen SHALL display a streak count of 0, display the start-your-streak hint, and hide the lapse explanation message.

### Requirement 8: First-Run Onboarding

**User Story:** As a first-time user, I want a short explanation of how PRESENT works, so that I understand the loop before I am asked for permissions.

#### Acceptance Criteria

1. WHEN the PRESENT_App launches and the Onboarding_Flag is absent, holds any value other than `"true"`, or cannot be read from storage, THE PRESENT_App SHALL display the Onboarding_Screen as the first screen without displaying the Home_Screen.
2. WHEN the PRESENT_App launches and the Onboarding_Flag equals the exact string `"true"`, THE PRESENT_App SHALL display the Home_Screen as the first screen without displaying the Onboarding_Screen.
3. THE Onboarding_Screen SHALL present the four steps of the loop — scheduling one activity, receiving a daily nudge, taking a check-in photo, and building a consecutive-day streak — as visible text distributed across no fewer than 2 and no more than 3 pages, with each of the four steps appearing on at least one page.
4. WHEN the user reaches the final Onboarding_Screen page and activates the continue control, THE Onboarding_Screen SHALL issue exactly one notification permission request and SHALL set the continue control to disabled until that request resolves.
5. WHEN the notification permission request resolves with either a granted or a denied outcome, THE Onboarding_Screen SHALL set the Onboarding_Flag to `"true"` and, once that write resolves, SHALL display the Home_Screen, or the retained pending route where Requirement 9 criterion 6 applies.
6. IF the notification permission request resolves with a denied outcome, THEN THE Onboarding_Screen SHALL display the Home_Screen with a message stating that nudges can be enabled from iOS Settings and SHALL keep that message visible for at least 4000 milliseconds or until the user dismisses it.
7. WHEN the user activates the skip control on any Onboarding_Screen page, THE Onboarding_Screen SHALL set the Onboarding_Flag to `"true"`, issue zero notification permission requests, and display the Home_Screen.
8. IF the write of the Onboarding_Flag rejects, THEN THE Onboarding_Screen SHALL display the Home_Screen without an error prompt and leave the Onboarding_Flag absent, so that the next launch displays the Onboarding_Screen again.
9. WHILE an Onboarding_Screen page other than the first page is displayed, THE Onboarding_Screen SHALL display a back control that returns to the immediately preceding page and leaves the Onboarding_Flag unchanged.
10. WHEN the displayed Onboarding_Screen page changes, THE Onboarding_Screen SHALL update a page indicator stating the current page position and the total page count, and SHALL expose that position and count to the iOS screen reader.

### Requirement 9: Cold-Start Navigation from a Nudge Tap

**User Story:** As a user tapping a nudge while the app is closed, I want to land on the camera, so that checking in takes one tap regardless of app state.

#### Acceptance Criteria

1. WHEN the PRESENT_App launches, THE PRESENT_App SHALL call `getLastNotificationResponseAsync` exactly once, and SHALL treat a rejection of that call as the absence of a launch notification response while recording the rejection through `console.warn`.
2. IF `getLastNotificationResponseAsync` resolves with a notification response whose identifier differs from the handled response identifier, THEN THE PRESENT_App SHALL issue exactly one navigation command to the Camera_Screen within 500 milliseconds of the navigator reporting readiness.
3. WHILE the navigator has not reported readiness, THE PRESENT_App SHALL retain at most one pending route name and SHALL issue exactly one navigation command to that retained route name when readiness is reported.
4. WHEN the PRESENT_App issues a navigation command for a pending route, THE PRESENT_App SHALL clear the pending route name before the readiness handler returns, so that a later navigator remount issues zero further navigation commands for that route.
5. WHILE the navigator has reported readiness, WHEN the notification response listener receives a notification response whose identifier differs from the handled response identifier, THE PRESENT_App SHALL issue exactly one navigation command to the Camera_Screen within 500 milliseconds of receiving that response.
6. WHERE the Onboarding_Flag is absent, WHEN `getLastNotificationResponseAsync` resolves with a notification response, THE PRESENT_App SHALL display the Onboarding_Screen, retain the Camera route as the pending route name, and issue exactly one navigation command to the Camera_Screen when the Onboarding_Flag is set to `"true"`.
7. WHEN the PRESENT_App issues a navigation command for a notification response, THE PRESENT_App SHALL retain that response's identifier in memory as the handled response identifier for the current app process, holding at most one such identifier.
8. IF `getLastNotificationResponseAsync` resolves with a notification response whose identifier equals the handled response identifier, or whose notification delivery timestamp is more than 300 seconds earlier than the current launch, THEN THE PRESENT_App SHALL issue zero navigation commands to the Camera_Screen for that response and display the first screen selected by Requirement 8 criteria 1 and 2.
9. IF a notification response is available for navigation and no Activity record exists or the stored Activity has `paused` equal to `true`, THEN THE PRESENT_App SHALL display the Home_Screen, issue zero navigation commands to the Camera_Screen, and clear the pending route name.

### Requirement 10: Privacy Policy Availability

**User Story:** As an App Store reviewer and as a user, I want a reachable privacy policy, so that data handling is documented before installation.

#### Acceptance Criteria

1. THE PRESENT_App configuration SHALL include a privacy policy URL that is a non-empty string beginning with `https://`.
2. WHEN the user activates the privacy policy control, THE Home_Screen SHALL request the device browser to open the privacy policy URL read from the PRESENT_App configuration, with the URL string unmodified.
3. THE privacy policy document reachable at the configured privacy policy URL without any login or authentication step SHALL state that Activity data, streak data and the Photo_Index remain on the device, that the PRESENT_App collects zero analytics, that the PRESENT_App transmits zero user data to a server, that camera access is used only to capture a check-in photo, that saved check-in photos are written to the iOS photo library and remain under user control, and a last-updated date given as year, month and day; and these statements SHALL match the "Data Not Collected" answer given for every data category in the App Store Connect privacy questionnaire for the PRESENT_App.
4. WHILE the Home_Screen is displayed, THE Home_Screen SHALL display a privacy policy control that presents a touch target of at least 44 by 44 points and exposes an accessibility label identifying the privacy policy.
5. THE PRESENT_App iOS configuration SHALL include a privacy manifest whose accessed-API types list contains at least one entry declaring the User Defaults API category with a non-empty declared reason, covering the AsyncStorage persistence used by the Activity_Store, the Streak_Store, the Onboarding_Flag and the Photo_Index.
6. IF the browser open request for the privacy policy URL rejects, or reports that no installed application can open the URL, THEN THE Home_Screen SHALL display an error message that states the privacy policy URL as selectable text, remain on the Home_Screen, and leave every stored value unchanged.

### Requirement 11: Data Export and Data Deletion

**User Story:** As a user exercising my data rights, I want to export or delete everything PRESENT stores about me, so that I stay in control of my own record.

#### Acceptance Criteria

1. THE Data_Privacy_Screen SHALL display an Export My Data control and a Delete All Data control, each presenting a touch target of at least 44 by 44 points and each exposing an accessibility label naming the control action.
2. WHEN the user activates the Export My Data control, THE Data_Privacy_Screen SHALL produce, within 3000 milliseconds for a Photo_Index of up to 500 records, a JSON document containing one entry for every storage key the PRESENT_App writes — `ACTIVITY_KEY`, `STREAK_KEY`, `ONBOARDING_KEY`, `PHOTOS_KEY` and `PHOTO_COUNT_KEY` — where each entry holds the exact string read from that key or null when the key is absent, so that `JSON.parse` of the export document reproduces every stored value unchanged, including a stored value that is not itself parseable as JSON.
3. WHEN the export document is produced, THE Data_Privacy_Screen SHALL present the iOS share sheet containing the export document exactly once.
4. WHEN the Export My Data control completes, including when the user dismisses the share sheet without selecting a share action, THE Data_Privacy_Screen SHALL leave every stored value byte-for-byte unchanged, perform zero storage writes, and display no error message.
5. WHEN the user activates the Delete All Data control, THE Data_Privacy_Screen SHALL display a confirmation prompt that states that deletion is permanent, states that check-in photos in the iOS Photos app are not deleted, and offers exactly one confirm option and one cancel option.
6. WHEN the user confirms deletion, THE Data_Privacy_Screen SHALL remove the keys `ACTIVITY_KEY`, `STREAK_KEY`, `ONBOARDING_KEY`, `PHOTOS_KEY` and `PHOTO_COUNT_KEY` from storage and leave 0 notifications scheduled, so that the Onboarding_Flag is absent and the next launch displays the Onboarding_Screen.
7. WHEN deletion completes, THE Home_Screen SHALL display a streak count of 0 and the no-activity empty state.
8. THE Data_Privacy_Screen SHALL display the number of check-in photos recorded in the Photo_Index for any count from 0 to 500, treat an absent or unparseable Photo_Index as a count of 0, and state that those photos remain in the iOS Photos app under user control.
9. WHEN the user confirms deletion, THE Data_Privacy_Screen SHALL perform zero calls that delete or modify iOS photo library assets, leaving the number of iOS photo library assets unchanged.
10. WHEN the user activates the Privacy and Data control on the Home_Screen, THE PRESENT_App SHALL display the Data_Privacy_Screen with a back control that returns to the Home_Screen.
11. THE export document SHALL include a schema version number and the export creation timestamp in ISO 8601 format.
12. IF a storage read or the share sheet presentation rejects during an export, THEN THE Data_Privacy_Screen SHALL display an error message stating that the export did not complete, leave every stored value unchanged, and keep the Export My Data control enabled for a retry.
13. IF the removal of one or more storage keys rejects during a confirmed deletion, THEN THE Data_Privacy_Screen SHALL display an error message stating that the deletion did not complete, leave 0 notifications scheduled, and keep the Delete All Data control enabled so that a retry removes any key that still holds a value.

### Requirement 12: Bounded Home Screen Refresh

**User Story:** As a long-term user with hundreds of check-ins, I want the home screen to stay responsive, so that returning from the camera feels instant.

#### Acceptance Criteria

1. WHEN the Home_Screen gains focus, THE Home_Screen SHALL read the Activity record, the streak record and the stored photo counter value in a single `multiGet` call containing exactly those 3 keys.
2. WHERE the stored photo counter value is present, WHEN the Home_Screen gains focus, THE Home_Screen SHALL perform at most 3 storage key reads for any Photo_Index length from 0 to 1000 records.
3. THE Home_Screen SHALL display the loading placeholder in place of the empty state only while the first focus read after Home_Screen mount is in flight.
4. WHEN the Home_Screen gains focus, THE Home_Screen SHALL take the displayed photo count from the stored photo counter value and SHALL NOT read or parse the Photo_Index array, for any Photo_Index length from 0 to 1000 records.
5. IF the focus `multiGet` call rejects or returns a stored value that cannot be parsed, THEN THE Home_Screen SHALL stop displaying the loading placeholder, display a message indicating that saved data could not be read, and leave every stored value unchanged.
6. IF the stored photo counter value is absent or is not an integer of 0 or greater when the Home_Screen gains focus, THEN THE Home_Screen SHALL derive the photo count from one additional Photo_Index read and SHALL store that derived count as the photo counter value.
7. WHEN a record is appended to the Photo_Index, THE Camera_Screen SHALL write the appended Photo_Index and a photo counter value equal to the resulting Photo_Index length in a single storage write operation, so that a Photo_Index append that does not complete leaves both the Photo_Index and the photo counter value unchanged.
