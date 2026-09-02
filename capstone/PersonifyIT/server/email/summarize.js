/**
 * email/summarize.js — Summarize a session transcript with Amazon Bedrock.
 *
 * Self-contained. Uses Amazon Nova Pro via the Bedrock Converse API to produce
 * a short, friendly recap of the conversation for the transcript email.
 *
 * Uses the AWS_ credentials (Hartnell's Bedrock account, same as the chatbot) —
 * these are permanent keys, so this works even when the temporary DYNAMO_
 * session token has expired.
 *
 * Environment variables:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *   BEDROCK_MODEL_ARN (defaults to us.amazon.nova-pro-v1:0)
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const MODEL_ID = process.env.BEDROCK_MODEL_ARN || 'us.amazon.nova-pro-v1:0';

function transcriptToText(transcript) {
  return transcript
    .map((m) => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.text}`)
    .join('\n');
}

/**
 * Produce a short recap of the conversation.
 *
 * @param {Array} transcript — [{ role, text, ts }]
 * @param {string} language  — 'en' | 'es'
 * @returns {Promise<string|null>} summary text, or null if it couldn't be produced
 */
export async function summarizeTranscript(transcript, language = 'en') {
  if (!transcript || transcript.length === 0) return null;

  const instruction =
    language === 'es'
      ? 'Resume esta conversación de soporte de TI en 2-3 oraciones en español. Menciona la pregunta principal del estudiante y la solución dada. Escribe en segundo persona ("preguntaste sobre...").'
      : 'Summarize this IT support conversation in 2-3 sentences. Mention the student\'s main question and the solution given. Write in second person ("you asked about...").';

  const prompt = `${instruction}\n\n--- CONVERSATION ---\n${transcriptToText(transcript)}\n--- END ---`;

  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0.3 },
    });

    const response = await client.send(command);
    const summary = response.output?.message?.content?.[0]?.text?.trim();
    return summary || null;
  } catch (err) {
    // Non-fatal: if summarization fails, the email just goes without a recap.
    console.error('[summarize] Bedrock error:', err.message);
    return null;
  }
}
