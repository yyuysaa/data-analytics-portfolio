// storage.js
// -----------------------------------------------------------------------------
// Thin wrappers around AsyncStorage. AsyncStorage is the phone's simple
// key-value store: it can only hold strings, so anything shaped like an object
// gets turned into text with JSON.stringify on the way in and back into an
// object with JSON.parse on the way out.
//
// Every function here is async (it returns a Promise), so callers must use
// `await`, e.g. `const activity = await loadActivity();`.
//
// This file is the ONLY place that talks to AsyncStorage, so screens never have
// to know about keys or JSON.
// -----------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ACTIVITY_KEY, STREAK_KEY } from '../constants';

// --- Activity ----------------------------------------------------------------
// The app supports exactly one scheduled activity at a time, so there is a
// single storage key and saving simply overwrites whatever was there before.

/**
 * Save the user's scheduled activity, replacing any previous one.
 *
 * @param {{ name: string, time: string }} activity - name is free text
 *   (e.g. "Data Science class"), time is an "HH:mm" string (e.g. "13:00").
 * @returns {Promise<void>}
 */
export async function saveActivity(activity) {
  try {
    // Only keep the two fields we care about. This keeps the stored shape
    // predictable even if the caller hands us an object with extra keys.
    const toStore = { name: activity.name, time: activity.time };

    // setItem on an existing key overwrites it, which is exactly the
    // "one activity at a time" behaviour we want.
    await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(toStore));
  } catch (error) {
    // Minimal error handling: log it so we can see it in the dev console, but
    // never crash the app just because a write failed.
    console.warn('Could not save the activity:', error);
  }
}

/**
 * Load the saved activity.
 *
 * @returns {Promise<{ name: string, time: string } | null>} the stored activity,
 *   or null when nothing has been saved yet (or the stored value is unreadable).
 */
export async function loadActivity() {
  try {
    const stored = await AsyncStorage.getItem(ACTIVITY_KEY);

    // getItem returns null when the key has never been written.
    if (stored === null) {
      return null;
    }

    return JSON.parse(stored);
  } catch (error) {
    // Either reading or parsing failed. Treat a corrupted value the same as
    // "nothing saved" so the home screen can just show its empty state.
    console.warn('Could not load the activity:', error);
    return null;
  }
}

// --- Streak ------------------------------------------------------------------
// A streak counts consecutive DAYS, not check-ins. One photo on a given
// calendar day marks that day as done (Duolingo-style), and extra check-ins the
// same day change nothing.
//
// We store two things: `count` (the streak) and `lastCheckInDate` (the day of
// the most recent check-in, as a "YYYY-MM-DD" string). Comparing two of those
// strings is all we need to know whether the streak continues or restarts.
//
// All of the streak rules live in recordCheckIn() below so a future "streak
// freeze" can be added in one spot without touching the screens.

/**
 * Turn a Date object into a "YYYY-MM-DD" string using the phone's LOCAL time.
 *
 * We deliberately avoid toISOString() because that converts to UTC first, so a
 * check-in at 11pm local could be recorded as tomorrow (or yesterday) depending
 * on the timezone. getFullYear/getMonth/getDate all read local time, which is
 * the day the user actually experienced.
 *
 * @param {Date} date
 * @returns {string} e.g. "2026-07-31"
 */
function formatDate(date) {
  const year = date.getFullYear();

  // getMonth() is zero-based (January is 0), so add 1. padStart makes sure
  // single digits become "01" rather than "1", which keeps every string the
  // same length and therefore safe to compare with ===.
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Today's date as a "YYYY-MM-DD" string in the device's local timezone.
 *
 * @returns {string}
 */
export function getTodayString() {
  return formatDate(new Date());
}

/**
 * Yesterday's date as a "YYYY-MM-DD" string in the device's local timezone.
 *
 * Subtracting a day with setDate() is safe: JavaScript rolls the month and year
 * back for us, so the 1st of March correctly becomes the last day of February.
 *
 * @returns {string}
 */
function getYesterdayString() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

/**
 * Load the stored streak.
 *
 * @returns {Promise<{ count: number, lastCheckInDate: string | null }>} the
 *   saved streak, or a fresh { count: 0, lastCheckInDate: null } when the user
 *   has never checked in (or the stored value is unreadable).
 */
export async function getStreakData() {
  // A brand new user has no streak yet. Returning this shape instead of null
  // means callers can always read `.count` without checking for null first.
  const emptyStreak = { count: 0, lastCheckInDate: null };

  try {
    const stored = await AsyncStorage.getItem(STREAK_KEY);

    if (stored === null) {
      return emptyStreak;
    }

    const parsed = JSON.parse(stored);

    // Be forgiving about what is on disk: fall back to the empty values if a
    // field is missing so a half-written record can never crash the app.
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      lastCheckInDate: parsed.lastCheckInDate ?? null,
    };
  } catch (error) {
    console.warn('Could not load the streak:', error);
    return emptyStreak;
  }
}

/**
 * Record a check-in for today and update the streak.
 *
 * This is the ONE function that knows the streak rules:
 *   - Already checked in today  → nothing changes (a day is either done or not).
 *   - Last check-in was yesterday → the run continues, so count goes up by 1.
 *   - Anything else (a gap, or the very first check-in) → the streak restarts
 *     at 1, because today itself counts as one day.
 *
 * @returns {Promise<{ count: number, lastCheckInDate: string }>} the streak
 *   after this check-in, so the caller can show the new number right away.
 */
export async function recordCheckIn() {
  const today = getTodayString();
  const current = await getStreakData();

  // Rule 1: the day is already done. Return the existing data untouched so
  // multiple photos in one day never double-count the streak.
  if (current.lastCheckInDate === today) {
    return current;
  }

  let updated;

  if (current.lastCheckInDate === getYesterdayString()) {
    // Rule 2: yesterday and today in a row — the streak grows.
    updated = { count: current.count + 1, lastCheckInDate: today };
  } else {
    // Rule 3: a whole day (or more) passed with no check-in, or this is the
    // user's first ever check-in. Either way the run starts over at 1.
    //
    // 🔌 FREEZE POINT: a future "streak freeze" belongs right here. Before
    // resetting, check whether the user has a freeze available; if so, spend it
    // and keep `current.count + 1` instead of dropping back to 1.
    updated = { count: 1, lastCheckInDate: today };
  }

  try {
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  } catch (error) {
    // The save failed, but we still return the new numbers so the UI stays
    // responsive. Worst case the streak is recalculated on the next check-in.
    console.warn('Could not save the streak:', error);
  }

  return updated;
}
