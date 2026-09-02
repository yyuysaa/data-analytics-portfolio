# Implementation Plan: iOS Launch Hardening

## Overview

This plan hardens the existing, working PRESENT app for App Store submission. It is an incremental change set over the current codebase — `App.js`, `src/constants.js`, `src/utils/storage.js`, `src/utils/generateNudge.js`, `src/screens/HomeScreen.js`, `src/screens/CameraScreen.js` — plus four new files: `src/utils/scheduleNotification.js`, `src/hooks/useSaveActivity.js`, `src/screens/OnboardingScreen.js`, `src/screens/DataPrivacyScreen.js`. No rewrites, no backend, no Android work.

Implementation language: JavaScript (React Native 0.86.2 / React 19.2.3 on Expo SDK 57 managed workflow).

Order is bottom-up so every task is independently verifiable: test infrastructure → storage layer → scheduler and save hook → existing screens → new screens → `App.js` wiring → `app.json` → device verification.

Property tests use fast-check with a minimum of 100 iterations, and each test is tagged `Feature: ios-launch-hardening, Property {number}: {property text}` as specified in the design's Testing Strategy.

## Tasks

- [ ] 1. Set up test infrastructure and the export dependency
  - [ ] 1.1 Install the sharing dependency for data export
    - Run `npx expo install expo-sharing` so the resolved version matches Expo SDK 57 (do not hand-pick a version in `package.json`)
    - If `expo-sharing` cannot provide the JSON share flow on its own, also `npx expo install expo-file-system` to write the export document to a shareable file first
    - Confirm the installed versions land in `package.json` dependencies and that `npx expo-doctor` reports no version mismatch
    - _Requirements: 11.3_

  - [ ] 1.2 Set up the Jest + fast-check test harness
    - No test framework exists yet. Install dev dependencies with versions checked against the installed `expo`, `react` and `react-native` versions rather than guessed: `jest-expo`, `jest`, `fast-check`, `@testing-library/react-native`, `react-test-renderer`
    - Add a `jest` block to `package.json` using the `jest-expo` preset with `transformIgnorePatterns` covering `react-native`, `expo`, `@expo` and `@react-navigation`
    - Add a `"test"` script that runs Jest once (no watch mode) and a `"test:ci"` script with `--ci`
    - Create `jest.setup.js` registering the mocks every later task depends on: `@react-native-async-storage/async-storage` (its official Jest mock), `expo-notifications`, `expo-camera`, `expo-media-library`, `expo-sharing`, and `@react-navigation/native` focus-effect helpers
    - Add one placeholder test asserting `generateNudge('X')` returns a non-empty string containing `'X'`, and confirm `npm test` passes
    - _Requirements: NFR — enables every test task below_

- [ ] 2. Extend the storage layer
  - [ ] 2.1 Add the new storage keys and export constants
    - Add `ONBOARDING_KEY = '@present_onboarding_done'`, `PHOTOS_KEY = '@present_photos'`, `PHOTO_COUNT_KEY = '@present_photo_count'` to `src/constants.js`
    - Add `EXPORT_SCHEMA_VERSION = 1`
    - Keep the existing header comment style: one line per key explaining the stored shape
    - _Requirements: 11.2, 11.6, 12.1, 12.4_

  - [ ] 2.2 Implement the activity lifecycle functions in `storage.js`
    - Extend `saveActivity` to persist `{ name, time, paused, createdAt }`, storing `name` trimmed, `time` in `HH:mm` form matching `^\d{2}:\d{2}$`, `paused` defaulting to `false`, and `createdAt` as an ISO timestamp when absent
    - Extend `loadActivity` to report `paused` as `false` when the stored record omits the field (legacy records)
    - Add `clearActivity()` removing `ACTIVITY_KEY`
    - Add `togglePause()` reading the activity, writing the record with `paused` inverted, and returning the updated record or `null` when no activity exists — the write must resolve before the caller cancels notifications
    - Let write rejections propagate to the caller rather than swallowing them, so the Home_Screen can surface the failure paths
    - _Requirements: 2.3, 2.7, 2.9, 2.10, 3.4, 3.9_

  - [ ]* 2.3 Write property tests for the activity lifecycle
    - **Property 9: Pause/resume round trip, write-ordered and failure-safe** (storage half: double toggle restores the original record, including a legacy record with no `paused` field)
    - **Property 3: Time-of-day round trip through storage** (storage half: any hour 0–23 and minute 0–59 round-trips through the stored `HH:mm` string, which matches `^\d{2}:\d{2}$`)
    - **Validates: Requirements 2.7, 2.9, 2.10, 3.9**

  - [ ] 2.4 Implement `appendPhotoRecord()`
    - Read `PHOTOS_KEY`, tolerate absent, unparseable and non-array values by treating them as `[]`
    - Append the `{ uri, date }` record and write `PHOTOS_KEY` and `PHOTO_COUNT_KEY` in a single `multiSet` so the two values can never disagree
    - `date` must match `^\d{4}-\d{2}-\d{2}$` in device local time — reuse the existing local-date formatter, never `toISOString()`
    - _Requirements: 6.6, 12.7_

  - [ ]* 2.5 Write property test for the photo counter invariant
    - **Property 39: The counter equals the index length after every append**
    - **Validates: Requirements 12.7**

  - [ ] 2.6 Implement `readFocusSnapshot()` and the counter repair path
    - One `multiGet` over exactly the 3 keys `ACTIVITY_KEY`, `STREAK_KEY`, `PHOTO_COUNT_KEY`
    - Add `parseCounter(value)` returning an integer ≥ 0 or `null` for absent, negative, non-integer and non-numeric values
    - Add `deriveAndStorePhotoCount()` performing one extra `PHOTOS_KEY` read, deriving the length and persisting it to `PHOTO_COUNT_KEY` — idempotent, so the next focus is back to 3 reads
    - Never read or parse `PHOTOS_KEY` on the healthy path, at any index length
    - Return `{ activity, streak, photoCount }` and let a `multiGet` rejection or an unparseable Activity/streak value surface to the caller with zero writes
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.6_

  - [ ]* 2.7 Write property tests for the focus snapshot
    - **Property 26: Focus refresh does bounded work**
    - **Property 27: The photo counter is authoritative at every length**
    - **Property 38: The photo counter self-heals and read faults stay safe**
    - **Validates: Requirements 12.2, 12.4, 12.5, 12.6**

  - [ ] 2.8 Implement `exportAllData()` and `deleteAllData()`
    - `exportAllData(now = new Date())` returns a JSON string holding `schemaVersion`, `exportedAt` as an ISO 8601 string, and one `data` entry per key for all five keys, each holding the exact stored string or `null` — never a re-parsed object, so a value that is not itself valid JSON still survives
    - `exportAllData` performs zero storage writes
    - `deleteAllData()` cancels all scheduled notifications first, then `multiRemove`s the five keys, letting a partial removal rejection propagate so the caller can offer an idempotent retry
    - `deleteAllData()` issues zero calls that delete or modify photo library assets
    - _Requirements: 11.2, 11.4, 11.6, 11.9, 11.11, 11.13_

  - [ ]* 2.9 Write property test for export fidelity
    - **Property 23: Export completeness, purity and round trip**
    - **Validates: Requirements 11.2, 11.4**

- [ ] 3. Checkpoint - storage layer green
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement the nudge scheduler
  - [ ] 4.1 Create `src/utils/scheduleNotification.js`
    - Export `scheduleDailyNudge(activityName, hour, minute)`, `cancelAllNudges()` and `refreshNudgeOnForeground()`
    - Validate the stored `time` against `^([01]\d|2[0-3]):([0-5]\d)$` before scheduling; on a mismatch schedule nothing, leave the stored record unchanged, and `console.warn` the rejected value
    - Call `generateNudge(activity.name)` inside each scheduling operation so the body is fresh, non-empty and contains the activity name
    - Cancel all scheduled notifications, then schedule exactly one DAILY trigger carrying integer `hour` and `minute` only — no absolute date, no timezone identifier, so iOS resolves the fire time against the device's current offset
    - Skip scheduling entirely when no activity exists, the record is unreadable, or `paused` is `true`, leaving 0 notifications scheduled
    - Guard with a module-level in-flight lock: concurrent requests return without issuing a cancel or schedule call, and the lock is released in a `finally` on both the success and the rejection path with the error recorded through `console.warn`
    - Add a separate debounce: an entry within 1000 ms of the most recently resolved scheduling operation returns without issuing a cancel or schedule call, independently of the in-flight lock
    - Dismiss and re-present zero already-delivered notifications
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

  - [ ]* 4.2 Write property test for fresh nudge text
    - **Property 1: Fresh nudge text on every schedule**
    - **Validates: Requirements 1.2**

  - [ ]* 4.3 Write property test for the scheduled-count invariant
    - **Property 2: Exactly one scheduled notification iff an active activity exists**
    - **Validates: Requirements 1.1, 1.4, 1.5, 1.6**

  - [ ]* 4.4 Write property test for the trigger shape
    - **Property 3: Time-of-day round trip through storage** (trigger half: the DAILY trigger carries the same integer hour and minute and no date or timezone field)
    - **Validates: Requirements 1.3, 3.9**

  - [ ]* 4.5 Write property test for the scheduler lock
    - **Property 4: Scheduler lock is single-flight and always released**
    - **Validates: Requirements 1.7, 1.8**

  - [ ]* 4.6 Write property test for malformed times
    - **Property 28: Malformed activity times are never scheduled**
    - **Validates: Requirements 1.9**

  - [ ]* 4.7 Write property test for foreground debouncing
    - **Property 29: Foreground rescheduling is debounced**
    - **Validates: Requirements 1.10**

  - [ ]* 4.8 Write example test for already-delivered notifications
    - Both branches (a notification delivered today / not delivered today): the next fire time is the activity time on the next calendar day, with zero dismiss calls and zero re-present calls
    - _Requirements: 1.11_

- [ ] 5. Implement the save controller hook
  - [ ] 5.1 Create `src/hooks/useSaveActivity.js`
    - Return `{ isSaving, saveAndSchedule, error }`
    - `saveAndSchedule(name, time)` acquires a ref-based lock and sets `isSaving` to `true` before the first storage write; concurrent calls return `false` with zero storage writes and zero scheduling calls
    - Reject before any side effect when the trimmed name is empty or longer than 60 characters, returning `false`
    - On success store the trimmed name, the `HH:mm` form of the selected time, and `paused: false` (so saving a paused activity resumes it), then schedule via `scheduleDailyNudge` and return `true`
    - When the storage write rejects: issue zero scheduling calls, leave the stored record unchanged, return `false`, and expose the reason through `error`
    - When the write resolves and scheduling rejects: retain the written record, return `false`, and expose a reason distinguishing "saved but not scheduled"
    - Release the lock and clear `isSaving` in a `finally` on every path, and guard state updates behind a mounted ref so an unmount before settlement performs zero `isSaving` updates
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.8, 3.10, 3.11, 3.12_

  - [ ]* 5.2 Write property test for single-flight saving
    - **Property 10: Save is single-flight and writes the normalised record**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 5.3 Write property test for the `isSaving` lifecycle
    - **Property 11: isSaving is always cleared**
    - **Validates: Requirements 3.5**

  - [ ]* 5.4 Write property test for name validation
    - **Property 14: Invalid activity names are rejected before any side effect**
    - **Validates: Requirements 3.8, 3.10**

  - [ ]* 5.5 Write property test for save failure ordering
    - **Property 30: A failed save never leaves an unscheduled surprise**
    - **Validates: Requirements 3.11, 3.12**

- [ ] 6. Home screen: bounded refresh and streak messaging
  - [ ] 6.1 Replace the focus read with `readFocusSnapshot()`
    - Swap the two-call `Promise.all(loadActivity, getStreakData)` for the single 3-key snapshot read and store the returned `photoCount`
    - Show the loading placeholder only while the first focus read after mount is in flight
    - On a rejected read or an unparseable value: clear the placeholder, show a "saved data could not be read" message, and perform zero storage writes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 6.2 Write example tests for the focus read shape
    - Assert one `multiGet` containing exactly the 3 expected keys, the loading placeholder appearing only on the first focus after mount, and the read-failure render
    - _Requirements: 12.1, 12.3, 12.5_

  - [ ] 6.3 Implement the streak lapse explanation
    - Derive the three mutually exclusive states from the stored `count` and `lastCheckInDate` alone, using `YYYY-MM-DD` local-timezone strings for the current and previous calendar day: lapse explanation, streak-continuing hint, start-your-streak hint
    - The lapse message states that a missed day ended the previous streak and that a new photo check-in starts a new streak, and names no numeric value for the previous streak length
    - The message stays visible until the screen loses focus or the user activates the dismiss control — no elapsed-time dismissal — and reappears on the next focus that still satisfies the lapse condition
    - Degrade to count 0 plus the start hint when the record is unreadable, `lastCheckInDate` fails `^\d{4}-\d{2}-\d{2}$`, or `lastCheckInDate` is later than the current day
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 6.4 Write property test for streak message selection
    - **Property 20: Streak message matches the stored record**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6**

  - [ ]* 6.5 Write property test for corrupt streak records
    - **Property 34: Corrupt streak records degrade to the start state**
    - **Validates: Requirements 7.7**

  - [ ]* 6.6 Write property test for lapse dismissal scope
    - **Property 33: Lapse dismissal is scoped to one focus**
    - **Validates: Requirements 7.5**

- [ ] 7. Checkpoint - scheduler, save hook and refresh green
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Home screen: activity lifecycle controls and save feedback
  - [ ] 8.1 Add Pause, Resume and Delete controls to the activity card
    - Render Pause and Delete for an unpaused activity, and a Paused badge plus Resume for a paused one; render neither set when no activity exists
    - Each control presents a touch target of at least 44 × 44 points and an accessibility label naming both the action and the activity name
    - Delete shows a confirmation prompt stating the activity name and that the streak count and check-in history are retained; confirming calls `clearActivity()` then cancels all notifications; cancelling changes nothing
    - After deletion show the no-activity empty state, clear the name field, and reset the time picker to the first-launch default
    - Pause/Resume call `togglePause()` and only cancel or schedule after that write resolves; on a write rejection show an error, keep the controls and badge derived from the previously stored `paused` value, and leave the scheduled count unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13_

  - [ ]* 8.2 Write property test for control rendering
    - **Property 5: Activity controls reflect activity state**
    - **Validates: Requirements 2.1, 2.8**

  - [ ]* 8.3 Write property test for the delete confirmation copy
    - **Property 6: Delete confirmation names the activity**
    - **Validates: Requirements 2.2**

  - [ ]* 8.4 Write property test for delete completeness
    - **Property 7: Delete completeness without collateral loss**
    - **Validates: Requirements 2.3, 2.4, 2.11**

  - [ ]* 8.5 Write property test for cancelled deletion
    - **Property 8: Cancelled deletion is a no-op**
    - **Validates: Requirements 2.6**

  - [ ]* 8.6 Write property test for pause/resume at the screen level
    - **Property 9: Pause/resume round trip, write-ordered and failure-safe** (screen half: scheduled count after each toggle, cancel issued only after the write resolves, and the failure render)
    - **Validates: Requirements 2.7, 2.9, 2.12**

  - [ ]* 8.7 Write example tests for control statics and the post-delete render
    - Measure the 44 × 44 touch targets of the Pause, Resume and Delete controls, assert their accessibility labels, and assert the single deterministic post-deletion transition including the picker default reset
    - _Requirements: 2.1, 2.5, 2.8, 2.13_

  - [ ] 8.8 Wire the save flow through `useSaveActivity`
    - Replace the inline save handler with the hook, keeping the existing notification-permission prompt ahead of it
    - While `isSaving`, render an activity indicator in place of the label and disable the control
    - On `true`, show a confirmation for 2000 ms stating the saved name and the saved `HH:mm` time, and clear the pending hide timer on unmount
    - On a `false` that is not a lock rejection, show an error stating the reason and retain the entered name and selected time; for the saved-but-not-scheduled case state both facts
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.12_

  - [ ]* 8.9 Write property test for the save confirmation
    - **Property 12: Save confirmation reports what was saved**
    - **Validates: Requirements 3.6**

  - [ ]* 8.10 Write property test for preserved form input
    - **Property 13: Failed save preserves form input**
    - **Validates: Requirements 3.7**

  - [ ]* 8.11 Write example tests for the saving render and timer cleanup
    - Assert the lock/`isSaving` ordering, the indicator-plus-disabled render, and that no state update happens after unmount inside the 2000 ms confirmation window
    - _Requirements: 3.1, 3.2, 3.6_

- [ ] 9. Home screen: first-nudge hint and privacy entry points
  - [ ] 9.1 Add the first-nudge timing hint
    - Compare the selected time to the current device local time at whole-minute granularity: earlier or equal renders the tomorrow variant, strictly later renders the today variant, each stating the selected time in `HH:mm`
    - Re-evaluate on every picker change against the clock read at that moment
    - While the form is displayed and the app is active, re-evaluate at intervals of at most 60 seconds so a today variant flips to tomorrow within 60 seconds of the time passing; clear the interval on unmount and while backgrounded
    - Announce the hint text to the iOS screen reader exactly once per change, and zero times when the text is unchanged
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 9.2 Write property test for hint variant selection
    - **Property 15: First-nudge hint matches the selected time**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 9.3 Write property test for clock tracking and announcements
    - **Property 31: The first-nudge hint tracks the clock and announces its changes**
    - **Validates: Requirements 4.4, 4.6**

  - [ ]* 9.4 Write example test for the untouched-picker default
    - One render against a frozen clock with zero picker changes shows the tomorrow variant
    - _Requirements: 4.5_

  - [ ] 9.5 Add the privacy policy control and the Privacy and Data entry
    - Read the privacy policy URL from the Expo config (`extra.privacyPolicyUrl`) and open it with `Linking.openURL`, passing the configured string unmodified
    - Both the privacy policy control and the Privacy and Data control present 44 × 44 point touch targets with accessibility labels identifying their destination
    - The Privacy and Data control navigates to the Data_Privacy_Screen
    - On an `openURL` rejection or an unsupported-URL report, show an error containing the URL as selectable text, stay on Home, and write nothing to storage
    - _Requirements: 10.2, 10.4, 10.6, 11.10_

  - [ ]* 9.6 Write example tests for the privacy controls
    - Assert one `Linking.openURL` call with the unmodified configured string, the static touch targets and labels, and the failure branch (message contains the URL, route unchanged, zero writes)
    - _Requirements: 10.2, 10.4, 10.6_

- [ ] 10. Camera screen: exit path and transactional check-in
  - [ ] 10.1 Add the back control and its holding-state twin
    - Render a back control inside the top safe-area inset over the preview, using an opaque contrast scrim behind the glyph so contrast holds against all-white and all-black previews
    - 44 × 44 point touch target, `button` accessibility role, and a label naming the home screen as the destination
    - Disable it while `isCapturing` is `true` and perform zero navigation for activations in that state
    - Render an equivalent control on the permission-pending and permission-denied holding states alongside the existing Back to Home link
    - When Camera is the only route on the stack, reset the stack so Home is the only route rather than backgrounding or terminating the app
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 10.2 Write property test for leaving the camera
    - **Property 16: Leaving the camera never records a check-in**
    - **Validates: Requirements 5.2**

  - [ ]* 10.3 Write example and smoke tests for the back control
    - Assert the touch target, role and label, the disabled-while-capturing render with zero navigation, both permission holding states, the single-route stack reset, and the static contrast-scrim style token
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 10.4 Make the check-in transactional
    - Wrap `handleCapture` so `isCapturing` is cleared in a `finally` on every path, and keep the shutter disabled and starting zero extra captures while it is `true`
    - On `takePictureAsync` rejection: append nothing, leave the streak unchanged, stay on Camera, and show either a retry message or an "enable camera access in iOS Settings" message depending on whether the rejection indicates a denied or restricted permission
    - On `Asset.create` rejection: same shape, with the photo-library wording
    - On `recordCheckIn` rejection after the asset exists: delete the asset, append nothing, leave the streak unchanged, stay on Camera, show a retry message
    - If the rollback deletion also rejects: leave the streak unchanged, append nothing, stay on Camera, and state that the streak day was not recorded and the photo may remain in Photos
    - On success (including a same-day no-op `recordCheckIn`): `appendPhotoRecord({ uri, date })` exactly once, then navigate Home; if only the append rejects, keep the check-in and asset, show zero errors, and still navigate Home
    - If the app leaves the active state mid-capture, clear `isCapturing` on return and show an interruption message worded differently from the capture-failure message
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [ ]* 10.5 Write property test for the capture flag
    - **Property 17: isCapturing is always reset**
    - **Validates: Requirements 6.1**

  - [ ]* 10.6 Write property test for check-in atomicity
    - **Property 18: Transactional check-in — no partial state**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6**

  - [ ]* 10.7 Write property test for daily idempotence
    - **Property 19: One check-in per calendar day**
    - **Validates: Requirements 6.7**

  - [ ]* 10.8 Write property test for cleanup failures
    - **Property 32: Cleanup failures never fabricate or lose a streak day**
    - **Validates: Requirements 6.8, 6.9**

  - [ ]* 10.9 Write example tests for the shutter and the backgrounding branch
    - Assert the disabled shutter render with zero extra `takePictureAsync` calls for N taps, and the interruption message asserted distinct from the capture-failure wording
    - _Requirements: 6.2, 6.10_

- [ ] 11. Checkpoint - existing screens green
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Build the onboarding screen
  - [ ] 12.1 Create `src/screens/OnboardingScreen.js`
    - 2 to 3 pages covering all four loop steps as visible text: schedule one activity, receive a daily nudge, take a check-in photo, build a consecutive-day streak
    - A page indicator stating the current position and total count, exposed to the screen reader, plus a back control on every page after the first that leaves the onboarding flag unchanged
    - On the final page, the continue control issues exactly one notification permission request and stays disabled until it resolves
    - On either outcome, write `ONBOARDING_KEY = "true"` and, once the write resolves, show Home (or the retained pending route from the cold-start gate); on a denied outcome show a message about enabling nudges in iOS Settings that stays visible at least 4000 ms or until dismissed
    - The skip control writes the flag, issues zero permission requests, and shows Home
    - If the flag write rejects, show Home with no error prompt and leave the flag absent so the next launch onboards again
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

  - [ ]* 12.2 Write property test for onboarding idempotence
    - **Property 21: Onboarding idempotence**
    - **Validates: Requirements 8.1, 8.2, 8.5, 8.7**

  - [ ]* 12.3 Write example tests for onboarding copy and branches
    - Assert the four loop steps across 2–3 pages, the single permission request, the denied-outcome message and its duration, the flag-write rejection branch, page navigation, and the page indicator
    - _Requirements: 8.3, 8.4, 8.6, 8.8, 8.9, 8.10_

- [ ] 13. Build the data privacy screen
  - [ ] 13.1 Create `src/screens/DataPrivacyScreen.js`
    - Export My Data and Delete All Data controls, each with a 44 × 44 point touch target and an accessibility label naming the action
    - Export calls `exportAllData()` and presents the iOS share sheet exactly once; dismissing without sharing leaves storage byte-for-byte unchanged with zero writes and no error
    - Display the Photo_Index count, treating an absent or unparseable index as 0, and state that those photos stay in the iOS Photos app under user control
    - Delete shows a confirmation stating that deletion is permanent and that Photos check-ins are not deleted, with exactly one confirm and one cancel option; confirming calls `deleteAllData()`
    - On an export read or share rejection, show "export did not complete", leave storage unchanged, and keep the control enabled
    - On a partial delete rejection, show "deletion did not complete", leave 0 notifications scheduled, and keep the control enabled for an idempotent retry
    - Provide a back control returning to Home
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.8, 11.9, 11.10, 11.12, 11.13_

  - [ ]* 13.2 Write property test for the displayed photo count
    - **Property 25: Photo count matches the index**
    - **Validates: Requirements 11.8**

  - [ ]* 13.3 Write property test for the export envelope and failure purity
    - **Property 36: Export envelope and export failure purity**
    - **Validates: Requirements 11.11, 11.12**

  - [ ]* 13.4 Write property test for deletion completeness
    - **Property 24: Deletion completeness**
    - **Validates: Requirements 11.6, 11.9**

  - [ ]* 13.5 Write property test for deletion retry convergence
    - **Property 37: Deletion converges under retry**
    - **Validates: Requirements 11.13**

  - [ ]* 13.6 Write example tests for the privacy screen statics
    - Assert the control render, the single share-sheet call, the fixed confirmation copy, the post-deletion Home render (streak 0, no-activity empty state), and navigation to the screen and back
    - _Requirements: 11.1, 11.3, 11.5, 11.7, 11.10_

- [ ] 14. Wire everything together in `App.js`
  - [ ] 14.1 Register the new routes and the onboarding gate
    - Add `Onboarding` and `DataPrivacy` to the stack, and give `Camera` the transparent-header options from the design where the back control is header-based
    - Read `ONBOARDING_KEY` before rendering the navigator and pick the initial route: `Onboarding` when the flag is absent, unreadable, or any value other than the exact string `"true"`; `Home` when it equals `"true"`
    - Hold the app on a minimal splash render until that read settles so the Home screen is never shown first to a new user
    - _Requirements: 8.1, 8.2, 11.10_

  - [ ] 14.2 Reschedule the nudge on foreground
    - Add an `AppState` listener calling `refreshNudgeOnForeground()` on entry to the active state, and remove the listener on unmount
    - Keep `App.js` free of scheduling logic — the scheduler module owns the lock, the debounce and the validation
    - _Requirements: 1.1, 1.5, 1.6, 1.10_

  - [ ] 14.3 Handle cold-start navigation from a nudge tap
    - Call `getLastNotificationResponseAsync()` exactly once on launch, treating a rejection as "no launch response" and recording it through `console.warn`
    - Keep at most one handled-response identifier in memory for the process, and at most one pending route name; navigate exactly once per fresh response and clear the pending route before the readiness handler returns
    - Ignore a response whose identifier equals the handled identifier or whose delivery timestamp is more than 300 seconds before launch, falling back to the onboarding-gate route
    - When the onboarding flag is absent, show Onboarding, retain `Camera` as the pending route, and navigate once the flag becomes `"true"`
    - When no activity exists or the activity is paused, show Home, issue zero Camera navigations, and clear the pending route
    - Keep the existing warm-start response listener on the same dedupe path
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [ ]* 14.4 Write property test for cold-start navigation
    - **Property 22: Cold-start navigation lands on Camera exactly once**
    - **Validates: Requirements 9.2, 9.3, 9.4**

  - [ ]* 14.5 Write property test for response deduplication
    - **Property 35: Camera navigation happens once per fresh actionable response**
    - **Validates: Requirements 9.5, 9.7, 9.8, 9.9**

  - [ ]* 14.6 Write example tests for launch wiring and the onboarding gate
    - Assert exactly one `getLastNotificationResponseAsync()` call plus its rejection branch, and the branch where a launch response is retained across onboarding
    - _Requirements: 9.1, 9.6_

- [ ] 15. Configure `app.json` for submission
  - [ ] 15.1 Add the privacy manifest and the privacy policy URL
    - Add `ios.privacyManifests` with one `NSPrivacyAccessedAPITypes` entry for `NSPrivacyAccessedAPICategoryUserDefaults` and reason `CA92.1`, `NSPrivacyTracking: false`, empty `NSPrivacyTrackingDomains` and empty `NSPrivacyCollectedDataTypes`
    - Add `extra.privacyPolicyUrl` as an `https://` string — the design's `https://present-app.example.com/privacy` is a placeholder that must be replaced with the real hosted URL before submission (see Notes)
    - _Requirements: 10.1, 10.5_

  - [ ]* 15.2 Write smoke tests for the configuration values
    - Assert `extra.privacyPolicyUrl` is a non-empty string starting with `https://`, and assert the User Defaults privacy manifest entry with its non-empty reason list
    - _Requirements: 10.1, 10.5_

- [ ] 16. Final checkpoint - full suite green
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Device verification on a physical iPhone — REQUIRES THE USER'S DEVICE, NOT COMPLETABLE BY AN AGENT
  - This task cannot be executed by a coding agent. It needs a physical iPhone, a real timezone change, and human eyes on the camera preview. Run it manually and record the outcome.
  - Change the device timezone after scheduling and confirm the nudge still fires at the chosen local clock time (Requirement 1.3, timezone-resolution half)
  - Point the camera at an all-white scene and an all-black scene and confirm the back control stays legible against both (Requirement 5.1, 4.5:1 ratio over a live preview)
  - Export with roughly 500 photo records and confirm the share sheet appears within 3 seconds (Requirement 11.2, wall-clock bound)
  - Confirm the hosted privacy policy URL loads on device with no login, and that its statements match the App Store Connect "Data Not Collected" answers (Requirement 10.3)
  - _Requirements: 1.3, 5.1, 10.3, 11.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. Core implementation tasks are never optional.
- **Requirement 10.3 is not a coding task.** The privacy policy document itself must be written and hosted by the user at a publicly reachable `https://` URL with no login step. The design's `https://present-app.example.com/privacy` is a placeholder and must be replaced in `app.json` before submission. The hosted text must state that activity, streak and photo-index data stay on the device, that the app collects zero analytics and transmits zero user data, what camera access is used for, that check-in photos live in the iOS photo library under user control, and a last-updated date — and it must agree with the "Data Not Collected" answers in the App Store Connect privacy questionnaire.
- Task 17 is device verification and is listed separately for the same reason: it needs the user's physical iPhone.
- Every property test is tagged `Feature: ios-launch-hardening, Property {number}: {property text}` and runs at least 100 fast-check iterations.
- The design's remaining criteria are routed to example, smoke, integration or device tests per the "Criteria Covered by Non-Property Tests" table in design.md; those appear as example/smoke sub-tasks above.
- iOS only. No Android behaviour is in scope, even where the existing code has Android branches.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6"] },
    { "id": 5, "tasks": ["2.7", "2.8"] },
    { "id": 6, "tasks": ["2.9", "4.1"] },
    { "id": 7, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "5.1"] },
    { "id": 8, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.1", "10.1", "12.1", "13.1", "15.1"] },
    { "id": 9, "tasks": ["6.2", "6.3", "10.2", "10.3", "12.2", "12.3", "13.2", "13.3", "13.4", "13.5", "13.6", "14.1", "15.2"] },
    { "id": 10, "tasks": ["6.4", "6.5", "6.6", "8.1", "10.4", "14.2"] },
    { "id": 11, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "10.5", "10.6", "10.7", "10.8", "10.9", "14.3"] },
    { "id": 12, "tasks": ["8.8"] },
    { "id": 13, "tasks": ["8.9", "8.10", "8.11", "14.4", "14.5", "14.6"] },
    { "id": 14, "tasks": ["9.1"] },
    { "id": 15, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 16, "tasks": ["9.5"] },
    { "id": 17, "tasks": ["9.6"] }
  ]
}
```
