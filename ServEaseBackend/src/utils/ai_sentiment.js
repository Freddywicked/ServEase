// src/utils/ai_sentiment.js
// AI sentiment analysis for customer reviews — fills the ratings table's
// `sentiment` column (migration 006). Mirrors utils/ai_diagnosis.js:
//
//   analyzeSentiment({ rating, review }) -> 'positive' | 'neutral' | 'negative'
//
// - If AI_API_KEY is set in the backend .env, Gemini classifies the review
//   (AI_API_URL holds the full generateContent URL, model included).
// - Otherwise, or if the AI call fails, a keyword + star-rating fallback is
//   used, so saving a rating never depends on the AI service being up.

const config = require('../config');

// Shorter than the diagnosis timeout: this runs inside POST .../rating, which
// the mobile app gives up on after 15s — leave margin for the insert + notify.
const TIMEOUT_MS = 10000;

const LABELS = ['positive', 'neutral', 'negative'];

// ---------- fallback (no AI key / AI error) ----------
const POSITIVE_WORDS =
  /excellent|great|good|amazing|awesome|satisf|profession|on time|punctual|fast|quick|clean|neat|tidy|friendly|approachable|accommodat|recommend|helpful|afford|fair|smooth|thank/i;
const NEGATIVE_WORDS =
  /bad|poor|terrible|awful|worst|disappoint|late|rude|messy|dirty|overcharg|expensive|slow|unprofession|scam|never again|not recommend|horrible/i;

function fallbackSentiment({ rating, review }) {
  const text = String(review || '');
  const positiveText = POSITIVE_WORDS.test(text);
  const negativeText = NEGATIVE_WORDS.test(text);
  if (positiveText && !negativeText) return 'positive';
  if (negativeText && !positiveText) return 'negative';
  // Mixed signals or no comment at all: trust the stars.
  const stars = Number(rating);
  if (Number.isFinite(stars)) {
    if (stars >= 4) return 'positive';
    if (stars <= 2) return 'negative';
  }
  return 'neutral';
}

// ---------- Gemini ----------
async function geminiSentiment({ rating, review }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.ai.apiUrl}?key=${config.ai.apiKey}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                'You read customer reviews on ServEase, a service marketplace in the Philippines, and decide if the customer ' +
                'was happy with the service. Reviews may be in English, Filipino, or Taglish. ' +
                'Answer with a JSON object only, no explanation: {"sentiment": "positive" | "neutral" | "negative"}. ' +
                'Rules: judge how the customer feels overall, not just the star rating - some customers give 5 stars but still complain. ' +
                'If the review only says "(no comment)" or has no real opinion, just base it on the stars. ' +
                'Use "neutral" when the review is too short or mixed to tell.',
            },
          ],
        },
        contents: [
          { role: 'user', parts: [{ text: `Rating: ${rating}/5\nReview: ${review || '(no comment)'}` }] },
        ],
        generationConfig: {
          // JSON-only reply: no markdown fences to strip, just parse the text.
          responseMimeType: 'application/json',
          temperature: 0,
          maxOutputTokens: 256,
        },
      }),
    });
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const label = String(JSON.parse(json)?.sentiment || '').toLowerCase();
    return LABELS.includes(label) ? label : null;
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeSentiment({ rating, review }) {
  if (config.ai.apiKey) {
    try {
      const label = await geminiSentiment({ rating, review });
      if (label) return label;
    } catch (err) {
      console.error('AI sentiment analysis failed, using the fallback instead:', err.message);
    }
  }
  return fallbackSentiment({ rating, review });
}

module.exports = { analyzeSentiment };
