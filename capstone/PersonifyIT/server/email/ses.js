/**
 * email/ses.js — Send emails via AWS SES.
 *
 * Self-contained. Uses the DYNAMO_ credentials (same AWS account that has
 * SES enabled). Only this file knows about SES — the rest of the app just
 * calls sendTranscriptEmail() from routes/transcript.js.
 *
 * Environment variables:
 *   DYNAMO_ACCESS_KEY_ID, DYNAMO_SECRET_ACCESS_KEY, DYNAMO_SESSION_TOKEN
 *   DYNAMO_REGION
 *   SES_FROM_EMAIL — verified sender address
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const credentials = {
  accessKeyId: process.env.DYNAMO_ACCESS_KEY_ID,
  secretAccessKey: process.env.DYNAMO_SECRET_ACCESS_KEY,
  ...(process.env.DYNAMO_SESSION_TOKEN && {
    sessionToken: process.env.DYNAMO_SESSION_TOKEN,
  }),
};

const sesClient = new SESClient({
  region: process.env.DYNAMO_REGION || 'us-west-2',
  credentials,
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@personifyit.dev';

/**
 * Format a transcript array into readable plain text.
 *
 * @param {Array} transcript — [{ role, text, ts }]
 * @returns {string}
 */
function formatTranscript(transcript) {
  if (!transcript || transcript.length === 0) return '(No messages recorded)';

  return transcript
    .map((msg) => {
      const speaker = msg.role === 'user' ? '🧑 You' : '🤖 Agent';
      const time = msg.ts ? new Date(msg.ts).toLocaleTimeString() : '';
      return `${speaker}${time ? ` (${time})` : ''}:\n${msg.text}`;
    })
    .join('\n\n');
}

/**
 * Send the session transcript to the user's email.
 *
 * @param {object} opts
 * @param {string} opts.to        — recipient email
 * @param {string} opts.language  — 'en' | 'es'
 * @param {Array}  opts.transcript — [{ role, text, ts }]
 * @param {string} [opts.summary]  — optional Bedrock-generated recap
 * @param {string} [opts.agentId]
 */
export async function sendTranscriptEmail({ to, language, transcript, summary, agentId }) {
  const isSpanish = language === 'es';

  const subject = isSpanish
    ? 'Tu conversación con PersonifyIT — Hartnell College'
    : 'Your PersonifyIT conversation — Hartnell College';

  const greeting = isSpanish
    ? 'Hola,\n\nAquí está la transcripción de tu conversación con el soporte de TI de Hartnell College:\n\n'
    : 'Hi there,\n\nHere\'s the transcript of your conversation with Hartnell College IT Support:\n\n';

  // Optional Bedrock recap section, shown above the full transcript.
  const summaryBlock = summary
    ? (isSpanish ? 'RESUMEN:\n' : 'SUMMARY:\n') + summary + '\n\n' +
      (isSpanish ? 'TRANSCRIPCIÓN COMPLETA:\n' : 'FULL TRANSCRIPT:\n')
    : '';

  const footer = isSpanish
    ? '\n\n---\nSi necesitas más ayuda, visita hartnell.edu o contacta al IT Service Desk.\n\n— PersonifyIT, Hartnell College'
    : '\n\n---\nIf you need further help, visit hartnell.edu or contact the IT Service Desk.\n\n— PersonifyIT, Hartnell College';

  const body = greeting + summaryBlock + formatTranscript(transcript) + footer;

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: body, Charset: 'UTF-8' },
      },
    },
  });

  const result = await sesClient.send(command);
  console.log(`[ses] email sent to ${to} (MessageId: ${result.MessageId})`);
  return result;
}
