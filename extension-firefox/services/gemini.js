// gemini.js — Google Gemini API integration

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Call Google Gemini to rewrite text.
 * @param {string} text – the text to rewrite
 * @param {string} apiKey
 * @param {string} model
 * @param {string} style – rewrite style
 * @returns {Promise<string[]>} array of 5 suggestions
 */
const MAX_RETRIES = 1;

export async function callGemini(text, apiKey, model, style) {
  const prompt = buildPrompt(text, style);
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 1024 }
  });

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return parseSuggestions(content);
    }

    const err = await response.json().catch(() => ({}));

    // Handle rate limit (429)
    if (response.status === 429) {
      const retrySeconds = parseRetryDelay(err);

      // If this is the last attempt, throw a user-friendly message
      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `Gemini free-tier rate limit reached. ` +
          (retrySeconds
            ? `Please wait ~${retrySeconds}s and try again.`
            : `Please wait a minute and try again.`) +
          ` You can also try a different model in Settings (e.g. gemini-1.5-flash).`
        );
      }

      // Auto-retry after the suggested delay (capped at 60s)
      const waitMs = Math.min((retrySeconds || 10) * 1000, 60000);
      await sleep(waitMs);
      continue;
    }

    // Non-rate-limit error — throw immediately
    lastError = new Error(err.error?.message || `Gemini API error: ${response.status}`);
    throw lastError;
  }

  throw lastError || new Error('Gemini API request failed after retries.');
}

/**
 * Parse the retry delay (in seconds) from a Gemini 429 error body.
 */
function parseRetryDelay(err) {
  const message = err?.error?.message || '';
  const match = message.match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(text, style) {
  return `You are a professional writing assistant.

Rewrite the following text in 5 different ways.

Style: ${style}

Rules:
- Fix grammar and spelling errors
- Improve clarity and readability
- Keep the original meaning intact
- Keep a similar length unless the style requires otherwise
- Return plain text only — no markdown, no formatting
- Do not add any introductions, explanations, or commentary

Return EXACTLY 5 rewrites, one per line. Nothing else.

---
${text}
---`;
}

/**
 * Parse the AI response into an array of suggestion strings.
 */
function parseSuggestions(content) {
  const lines = content
    .split('\n')
    .map(line => line.replace(/^(?:\d+[\.)\-]\s*|[\-\*\u2022]\s*)/, '').trim())
    .filter(line => line.length > 0);

  return lines.slice(0, 5);
}
