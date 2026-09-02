import AsyncStorage from '@react-native-async-storage/async-storage';

import { ACTIVITY_KEY, STREAK_KEY } from '../constants';

// --- Activity ----------------------------------------------------------------

/**
 * Save the user's scheduled activity, replacing any previous one.
 * @param {{ name: string, time: string }} activity
 */
export async function saveActivity(activity) {
  try {
    await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify({ name: activity.name, time: activity.time }));
  } catch (error) {
    console.warn('Could not save the activity:', error);
  }
}

/**
 * Load the saved activity.
 * @returns {Promise<{ name: string, time: string } | null>}
 */
export async function loadActivity() {
  try {
    const stored = await AsyncStorage.getItem(ACTIVITY_KEY);
    return stored !== null ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Could not load the activity:', error);
    return null;
  }
}

// --- Streak ------------------------------------------------------------------
// Streak counts consecutive days (Duolingo-style). One check-in per day is
// enough — extra check-ins the same day don't change the count.

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return formatDate(new Date());
}

function getYesterdayString() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

/**
 * Load the stored streak.
 * @returns {Promise<{ count: number, lastCheckInDate: string | null }>}
 */
export async function getStreakData() {
  const emptyStreak = { count: 0, lastCheckInDate: null };
  try {
    const stored = await AsyncStorage.getItem(STREAK_KEY);
    if (stored === null) return emptyStreak;
    const parsed = JSON.parse(stored);
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
 * - Same day → no change.
 * - Yesterday → streak continues (+1).
 * - Any gap → streak resets to 1.
 *
 * @returns {Promise<{ count: number, lastCheckInDate: string }>}
 */
export async function recordCheckIn() {
  const today = getTodayString();
  const current = await getStreakData();

  if (current.lastCheckInDate === today) return current;

  const updated =
    current.lastCheckInDate === getYesterdayString()
      ? { count: current.count + 1, lastCheckInDate: today }
      : { count: 1, lastCheckInDate: today };

  try {
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Could not save the streak:', error);
  }

  return updated;
}
