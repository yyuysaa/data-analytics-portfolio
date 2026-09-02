// generateNudge.js
// -----------------------------------------------------------------------------
// The app's nudge writer. Given an activity name, it returns one warm,
// encouraging sentence that mentions that activity — the text we put in the
// body of the notification.
//
// This lives in its own tiny file on purpose: today the message comes from a
// hardcoded list, but later it will come from a real AI model. Keeping it
// isolated means that upgrade touches exactly one function.
// -----------------------------------------------------------------------------

import { NUDGE_TEMPLATES } from '../constants';

/**
 * Build an encouraging nudge message for an activity.
 *
 * @param {string} activityName - e.g. "Data Science class"
 * @returns {string} A ready-to-send nudge, e.g. "Time for Data Science class — go be brilliant! ✨"
 */
export function generateNudge(activityName) {
  // ===========================================================================
  // 🔌 SWAP POINT — REAL AI GOES HERE
  // ---------------------------------------------------------------------------
  // Everything between this banner and the closing banner is the placeholder
  // implementation. To switch to real AI nudges, replace this block with an API
  // call (OpenAI, Bedrock, etc.) and keep the same contract:
  //
  //   in:  activityName (string)
  //   out: a single-sentence encouraging string that mentions the activity
  //
  // Note: an API call is async, so at that point this function becomes
  // `async function generateNudge(...)` and callers need to `await` it.
  // Right now there is only one caller (HomeScreen's "Save & Schedule"), which
  // is already inside an async handler.
  // ===========================================================================

  // If we somehow got no name, fall back to something neutral so the message
  // still reads like a sentence instead of "Time for undefined".
  const name =
    typeof activityName === 'string' && activityName.trim().length > 0
      ? activityName.trim()
      : 'your activity';

  // Pick a random template so the user doesn't see the same wording every day.
  const template =
    NUDGE_TEMPLATES[Math.floor(Math.random() * NUDGE_TEMPLATES.length)];

  // Every template contains {activity} exactly once — swap it for the real name.
  return template.replace('{activity}', name);

  // ===========================================================================
  // 🔌 END SWAP POINT
  // ===========================================================================
}
