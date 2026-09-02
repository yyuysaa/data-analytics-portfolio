/**
 * tavus.js — Tavus CVI (Conversational Video Interface) integration
 *
 * Exported functions:
 *   createConversation(language) → Promise<{ conversationId, conversationUrl }>
 *   endConversation(conversationId) → Promise<void>
 *
 * When TAVUS_PUBLIC_URL is set in .env, we create a PAL that points its LLM
 * at our own /v2/chat/completions proxy endpoint — so the avatar speaks
 * exactly what the Hartnell chatbot says.
 *
 * Without TAVUS_PUBLIC_URL the avatar falls back to Tavus's built-in LLM
 * with our IT-support context injected via conversational_context.
 */

import https from 'https';

const TAVUS_HOST = 'tavusapi.com';

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function tavusRequest(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: TAVUS_HOST,
      path,
      method,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Tavus ${method} ${path} → HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Tavus non-JSON response: ${data}`)); }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Tavus request timed out')));
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Per-language prompts ─────────────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  en: `You are Alex, an IT support assistant for Hartnell College.
You help students, faculty, and staff with technology questions: password resets, Wi-Fi, printing, software, email, and general IT troubleshooting.
Speak in a calm, patient, and informative tone. Be clear and direct — like a knowledgeable coworker helping out.
Do not be overly enthusiastic or energetic. No bullet points, no numbered lists, no markdown in your speech.
Keep answers concise and factual. If you cannot help, offer to connect them with the Hartnell IT Help Desk.
Always respond in English only.`,

  es: `Eres Alex, un asistente de soporte de TI para Hartnell College.
Ayudas a estudiantes, profesores y personal con preguntas de tecnología: restablecimiento de contraseñas, Wi-Fi, impresión, software, correo electrónico y solución de problemas de TI.
Habla en un tono calmado, paciente e informativo. Sé claro y directo — como un compañero de trabajo experto que ayuda.
No seas demasiado entusiasta o enérgico. Sin viñetas, sin listas numeradas, sin markdown.
Sé conciso y factual. Si no puedes ayudar, ofrécete a conectarlos con el Servicio de Ayuda de TI de Hartnell.
Siempre responde en español.`,
};

const CUSTOM_GREETINGS = {
  en: "Hey there. I'm Alex, your IT assistant at Hartnell College. What can I help you with?",
  es: "Hola. Soy Alex, tu asistente de TI en Hartnell College. ¿En qué puedo ayudarte?",
};

// ─── PAL management (used when TAVUS_PUBLIC_URL is set) ──────────────────────

/**
 * Create a short-lived PAL that routes LLM calls to our proxy endpoint.
 * Returns the pal_id, or null if creation fails.
 */
async function createPal(apiKey, replicaId, language, publicUrl, proxyKey) {
  const lang = ['en', 'es'].includes(language) ? language : 'en';

  const body = {
    persona_name: `personifyit-${lang}-${Date.now()}`,
    system_prompt: SYSTEM_PROMPTS[lang],
    default_replica_id: replicaId,
    layers: {
      llm: {
        model: `hartnell-chatbot-${lang}`,
        // Tavus appends "/chat/completions" to base_url; our proxy lives at
        // /v2/chat/completions, so base_url must end in "/v2".
        base_url: `${publicUrl}/v2`,
        api_key: proxyKey || 'no-key',
        speculative_inference: false,
      },
    },
  };

  console.log(`[tavus] creating persona with custom LLM → ${publicUrl}/v2`);
  const result = await tavusRequest('POST', '/v2/personas', apiKey, body);

  if (!result.persona_id) {
    throw new Error(`Tavus persona creation failed: ${JSON.stringify(result)}`);
  }

  console.log(`[tavus] persona created: ${result.persona_id}`);
  return result.persona_id;
}

/**
 * Delete a PAL (cleanup after conversation ends).
 */
async function deletePal(apiKey, palId) {
  if (!apiKey || !palId) return;
  try {
    await tavusRequest('DELETE', `/v2/personas/${palId}`, apiKey);
    console.log(`[tavus] persona deleted: ${palId}`);
  } catch (err) {
    console.warn(`[tavus] could not delete PAL ${palId}: ${err.message}`);
  }
}

// ─── Exported interface ───────────────────────────────────────────────────────

/**
 * Create a new CVI conversation session.
 *
 * If TAVUS_PUBLIC_URL is set, creates a PAL with our custom LLM proxy so the
 * avatar speaks exactly what the Hartnell chatbot says.
 * Otherwise falls back to Tavus's built-in LLM with our context injected.
 *
 * @param {string} language — 'en' | 'es'
 * @returns {Promise<{ conversationId: string, conversationUrl: string, palId: string|null }>}
 */
export async function createConversation(language) {
  const apiKey    = process.env.TAVUS_API_KEY;
  const replicaId = process.env.TAVUS_REPLICA_ID;
  const publicUrl = process.env.TAVUS_PUBLIC_URL?.replace(/\/$/, ''); // strip trailing slash
  const proxyKey  = process.env.TAVUS_LLM_PROXY_KEY;
  const testMode  = process.env.TAVUS_TEST_MODE === 'true';

  if (!apiKey || !replicaId) {
    throw new Error('TAVUS_API_KEY and TAVUS_REPLICA_ID must be set in .env');
  }

  const lang = ['en', 'es'].includes(language) ? language : 'en';
  let palId = null;

  // Build conversation body
  const body = {
    conversation_name: `personifyit-${Date.now()}`,
    custom_greeting: CUSTOM_GREETINGS[lang],
    properties: {
      max_call_duration: 1800,
      participant_left_timeout: 15,
      enable_recording: false,
    },
  };

  if (testMode) {
    body.test_mode = true;
    console.log('[tavus] TEST MODE — PAL will not join, no billing');
  }

  if (publicUrl) {
    // Custom LLM mode — create a PAL pointing at our proxy
    try {
      palId = await createPal(apiKey, replicaId, lang, publicUrl, proxyKey);
      body.persona_id = palId;
      body.replica_id = replicaId; // persona's default_replica_id also set; explicit is safe
    } catch (err) {
      console.warn(`[tavus] PAL creation failed, falling back to built-in LLM: ${err.message}`);
      palId = null;
    }
  }

  // If no PAL (no public URL or PAL creation failed), use replica_id + context
  if (!palId) {
    body.replica_id = replicaId;
    body.conversational_context = SYSTEM_PROMPTS[lang];
  }

  console.log(`[tavus] creating CVI conversation (lang=${lang}, mode=${palId ? 'custom-llm' : 'built-in'})`);
  const result = await tavusRequest('POST', '/v2/conversations', apiKey, body);

  if (!result.conversation_id || !result.conversation_url) {
    throw new Error(`Tavus did not return conversation_id/url: ${JSON.stringify(result)}`);
  }

  console.log(`[tavus] conversation created: ${result.conversation_id} → ${result.conversation_url}`);
  return {
    conversationId: result.conversation_id,
    conversationUrl: result.conversation_url,
    palId,
  };
}

/**
 * End an active CVI conversation and clean up its PAL if one was created.
 *
 * @param {string} conversationId
 * @param {string|null} palId
 */
export async function endConversation(conversationId, palId = null) {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey || !conversationId) return;

  try {
    await tavusRequest('POST', `/v2/conversations/${conversationId}/end`, apiKey);
    console.log(`[tavus] conversation ended: ${conversationId}`);
  } catch (err) {
    console.warn(`[tavus] could not end conversation ${conversationId}: ${err.message}`);
  }

  // Clean up the per-session PAL
  if (palId) {
    await deletePal(apiKey, palId);
  }
}
