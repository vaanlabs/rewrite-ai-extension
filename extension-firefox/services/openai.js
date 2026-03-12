// openai.js — OpenAI API integration

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Call OpenAI Chat Completions to rewrite text.
 * @param {string} text – the text to rewrite
 * @param {string} apiKey
 * @param {string} model
 * @param {string} style – rewrite style (e.g. "Professional")
 * @returns {Promise<string[]>} array of 5 suggestions
 */
export async function callOpenAI(text, apiKey, model, style) {
  const systemPrompt = buildSystemPrompt(style);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.8,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseSuggestions(content);
}

function buildSystemPrompt(style) {
  return `You are a professional writing assistant.

Rewrite the user's text in 5 different ways.

Style: ${style}

Rules:
- Fix grammar and spelling errors
- Improve clarity and readability
- Keep the original meaning intact
- Keep a similar length unless the style requires otherwise
- Return plain text only — no markdown, no formatting
- Do not add any introductions, explanations, or commentary

Return EXACTLY 5 rewrites, one per line. Nothing else.`;
}

/**
 * Parse the AI response into an array of suggestion strings.
 */
function parseSuggestions(content) {
  const lines = content
    .split('\n')
    .map(line => line.replace(/^(?:\d+[\.)\-]\s*|[\-\*\u2022]\s*)/, '').trim())
    .filter(line => line.length > 0);

  // Return up to 5
  return lines.slice(0, 5);
}
