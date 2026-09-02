import { NUDGE_TEMPLATES } from '../constants';

/**
 * Returns a random encouraging nudge message for the given activity name.
 * Replace this function body with an AI API call when ready.
 *
 * @param {string} activityName
 * @returns {string}
 */
export function generateNudge(activityName) {
  const name =
    typeof activityName === 'string' && activityName.trim().length > 0
      ? activityName.trim()
      : 'your activity';

  const template = NUDGE_TEMPLATES[Math.floor(Math.random() * NUDGE_TEMPLATES.length)];
  return template.replace('{activity}', name);
}
