/**
 * rewrite.js — Conversational rewrite pass
 *
 * Exported function:
 *   conversationalRewrite(rawText, language) → Promise<string>
 *
 * Takes the plain-text answer from the chatbot (which is often structured
 * as numbered lists / bullet points — fine for reading, robotic when spoken)
 * and rewrites it into natural spoken-language prose using Gemini.
 *
 * STRICT CONTRACT enforced in the prompt:
 *   - Every URL, phone number, email, building name, and step must be preserved
 *   - Only structure/formatting changes — no facts added, removed, or altered
 *   - Output must sound like a person talking, not a document being read aloud
 *   - No markdown, no bullet symbols, no numbered lists in the output
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

const SYSTEM_PROMPTS = {
  en: `You are a conversational rewriter for a college IT support voice assistant.
Your job is to convert structured text (numbered lists, bullet points, headers) into natural spoken English — the kind a helpful person would say out loud.

STRICT RULES — follow every one, no exceptions:
1. Preserve EVERY fact exactly: all URLs, phone numbers, emails, building names, hours, and steps.
2. Do NOT add any information that is not in the input.
3. Do NOT remove any information from the input.
4. Output plain prose only — no bullet points, no numbered lists, no markdown, no symbols like - or *.
5. Write in second person ("you can…", "you'll need to…").
6. Keep it concise — do not pad or repeat.
7. When the input contains URLs or links, do NOT read them aloud. Instead say "I'll send the link in the chat" or "check the chat for the link."
8. Output ONLY the rewritten spoken text. No preamble, no explanation.`,

  es: `Eres un reescritor conversacional para un asistente de voz de soporte de TI universitario.
Tu trabajo es convertir texto estructurado (listas numeradas, viñetas, encabezados) en español hablado natural — el tipo que diría una persona útil en voz alta.

REGLAS ESTRICTAS — sigue cada una sin excepción:
1. Conserva CADA dato exactamente: todas las URLs, números de teléfono, correos electrónicos, nombres de edificios, horarios y pasos.
2. NO agregues ninguna información que no esté en el texto original.
3. NO elimines ninguna información del texto original.
4. Escribe solo prosa simple — sin viñetas, sin listas numeradas, sin markdown, sin símbolos como - o *.
5. Escribe en segunda persona ("puedes…", "necesitarás…").
6. Sé conciso — no rellenes ni repitas.
7. Cuando el texto contenga URLs o enlaces, NO los leas en voz alta. En su lugar di "te envío el enlace en el chat" o "revisa el chat para ver el enlace."
8. Escribe ÚNICAMENTE el texto hablado reescrito. Sin preámbulos ni explicaciones.`,
};

/**
 * @param {string} rawText   — plain text from getChatbotResponse()
 * @param {string} language  — 'en' | 'es'
 * @returns {Promise<string>} — spoken-style prose, same facts
 */
export async function conversationalRewrite(rawText, language) {
  if (!rawText || rawText.trim().length === 0) return rawText;

  const systemPrompt = SYSTEM_PROMPTS[language] ?? SYSTEM_PROMPTS.en;

  const prompt = `${systemPrompt}

--- TEXT TO REWRITE ---
${rawText}
--- END TEXT ---

Rewritten spoken version:`;

  try {
    const result = await model.generateContent(prompt);
    const rewritten = result.response.text().trim();

    if (!rewritten || rewritten.length < 10) {
      // Safety fallback: if Gemini returns nothing useful, pass through original
      console.warn('[rewrite] Gemini returned empty response, using original text');
      return rawText;
    }

    return rewritten;
  } catch (err) {
    // Never let a rewrite failure crash the whole request — fall back to raw text
    console.error('[rewrite] Gemini error, falling back to raw text:', err.message);
    // For Spanish, prefix a note so the TTS layer at least signals the language issue
    if (language === 'es') {
      return `Lo siento, no pude traducir la respuesta al español. Aquí está en inglés: ${rawText}`;
    }
    return rawText;
  }
}
