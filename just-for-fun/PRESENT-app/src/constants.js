// constants.js
// -----------------------------------------------------------------------------
// These are the app's shared values — the things more than one file needs to
// know about. Keeping them here means there is exactly ONE place to edit a
// storage key or reword a nudge, instead of hunting through screens and utils.
// -----------------------------------------------------------------------------

// --- AsyncStorage keys -------------------------------------------------------
// The "@" prefix is a common convention so our keys never collide with keys
// written by libraries.

// Stores the single scheduled activity: {"name":"Data Science","time":"13:00"}
export const ACTIVITY_KEY = '@present_activity';

// Stores the streak: {"count":7,"lastCheckInDate":"2026-07-31"}
export const STREAK_KEY = '@present_streak';

// --- Nudge templates ---------------------------------------------------------
// Hardcoded stand-ins for AI-generated messages. generateNudge() picks one at
// random and swaps the {activity} placeholder for the user's activity name, so
// every template MUST contain {activity} exactly once.
export const NUDGE_TEMPLATES = [
  'Time for {activity} — go be brilliant! ✨',
  "Hey, {activity} is calling. You've got this! 💪",
  'Your future self will thank you. {activity} starts now! 🚀',
  'Shine time! {activity} awaits. Show up and be PRESENT. 🌟',
  "Small steps, big wins. Let's do {activity}! 🎯",
];
