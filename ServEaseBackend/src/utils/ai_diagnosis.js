// src/utils/ai_diagnosis.js
// Produces the AI diagnosis shown on AIResult.js and to the provider.
//
//   diagnose({ category, description }) -> {
//     probableCause: string,
//     confidencePercent: number (0-100),
//     relatedChecks: string[],
//     troubleshootingSuggestions: [{ title, description }],
//   }
//
// - If AI_API_KEY is set in the backend .env, the diagnosis comes from Gemini
//   (AI_API_URL holds the full generateContent URL, model included).
// - Otherwise, or if the AI call fails, a simple keyword-based fallback is used so the
//   flow always works. Swap this file for another AI service whenever you like; the
//   controller only depends on the return shape above.

const config = require('../config');

// The mobile app allows 30s for POST /service-requests/diagnose; keep some margin.
const TIMEOUT_MS = 25000;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const cleanList = (value, max) =>
  (Array.isArray(value) ? value : [])
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim())
    .slice(0, max);

function normalize(raw) {
  const probableCause = typeof raw?.probableCause === 'string' ? raw.probableCause.trim() : '';
  if (!probableCause) return null;

  const confidence = Number(raw.confidencePercent);
  return {
    probableCause,
    confidencePercent: Number.isFinite(confidence) ? clamp(Math.round(confidence), 0, 100) : 50,
    relatedChecks: cleanList(raw.relatedChecks, 6),
    troubleshootingSuggestions: (Array.isArray(raw.troubleshootingSuggestions) ? raw.troubleshootingSuggestions : [])
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t) => ({ title: t.title.trim(), description: String(t.description || '').trim() }))
      .slice(0, 4),
  };
}

// ---------- fallback (no AI key / AI error) ----------
const RULES = [
  { test: /liquid|water|spill|wet|moist/i, cause: 'Liquid damage', confidence: 78, checks: ['Moisture Check', 'Motherboard Check', 'Power Jack'] },
  { test: /screen|display|crack|lcd|touch/i, cause: 'Damaged display', confidence: 80, checks: ['Display Connector', 'Touch Digitizer', 'Backlight'] },
  { test: /battery|charg|power|turn on|won'?t on|dead/i, cause: 'Battery or charging circuit fault', confidence: 72, checks: ['Power Jack', 'Battery Health', 'Charger Test'] },
  { test: /leak|pipe|faucet|drain|clog/i, cause: 'Plumbing leak or clog', confidence: 74, checks: ['Pipe Fittings', 'Drain Line', 'Water Pressure'] },
  { test: /outlet|wiring|breaker|short|spark|light/i, cause: 'Electrical wiring fault', confidence: 70, checks: ['Circuit Breaker', 'Wiring Continuity', 'Safety Test'] },
  { test: /engine|brake|tire|oil|overheat|car|motor/i, cause: 'Mechanical wear in the vehicle', confidence: 66, checks: ['Brake Pads', 'Fluid Levels', 'Engine Diagnostics'] },
  { test: /ref|aircon|air con|cooling|freez|compressor/i, cause: 'Cooling system issue', confidence: 68, checks: ['Refrigerant Level', 'Air Filter', 'Compressor'] },
];

function fallbackDiagnosis({ category, description }) {
  const text = `${category} ${description}`;
  const rule = RULES.find((r) => r.test.test(text));
  return {
    probableCause: rule ? rule.cause : 'Needs a technician inspection',
    confidencePercent: rule ? rule.confidence : 40,
    relatedChecks: rule ? rule.checks : ['Visual Inspection', 'Safety Test'],
    troubleshootingSuggestions: [
      { title: 'Power off and unplug', description: 'Switch the device or appliance off before anything else.' },
      { title: 'Take clear photos', description: 'Photos of the damage help the technician prepare the right parts.' },
    ],
  };
}

// ---------- Gemini ----------
async function geminiDiagnosis({ category, description }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.ai.apiUrl}?key=${config.ai.apiKey}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
          'You are a repair triage assistant for ServEase, a service marketplace in the Philippines. ' +
          'Given a customer\'s category and problem description, reply with ONLY a JSON object, no other text: ' +
          '{"probableCause": string (short), "confidencePercent": integer 0-100, ' +
          '"relatedChecks": string[] (3 short labels), ' +
          '"troubleshootingSuggestions": [{"title": string, "description": string}] (2 safe things the customer can try)}. ' +
              'Only suggest safe, non-technical steps. Be honest about low confidence when details are missing.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: `Category: ${category}\nProblem: ${description}` }] }],
        generationConfig: {
          // JSON-only reply: no markdown fences to strip, just parse the text.
          responseMimeType: 'application/json',
          temperature: 0.3,
          // gemini-flash-latest spends tokens on "thinking" before answering, so a
          // low cap here would truncate the JSON. 2048 leaves comfortable headroom.
          maxOutputTokens: 2048,
        },
      }),
    });
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return normalize(JSON.parse(json));
  } finally {
    clearTimeout(timer);
  }
}

async function diagnose({ category, description }) {
  if (config.ai.apiKey) {
    try {
      const result = await geminiDiagnosis({ category, description });
      if (result) return result;
    } catch (err) {
      console.error('AI diagnosis failed, using the fallback instead:', err.message);
    }
  }
  return fallbackDiagnosis({ category, description });
}

module.exports = { diagnose };