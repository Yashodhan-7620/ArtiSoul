const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');

// AI-assisted listing: an artisan uploads a photo, Claude suggests a title,
// description, category and price. Needs ANTHROPIC_API_KEY in backend/.env;
// without it the endpoint answers 503 and the app hides nothing else.

const MODEL = 'claude-opus-5-5';
const DAILY_LIMIT = 20; // per artisan, keeps API spend predictable
const CATEGORIES = ['Textiles', 'Pottery', 'Jewellery', 'Woodwork', 'Painting', 'Leather', 'Metalwork', 'Home Decor', 'Other'];
const LANGUAGES = { en: 'English', hi: 'Hindi (Devanagari script)', mr: 'Marathi (Devanagari script)' };

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Product title, at most 60 characters' },
    description: { type: 'string', description: '2-4 sentences for buyers' },
    category: { type: 'string', enum: CATEGORIES },
    price_inr: { type: 'integer', description: 'Suggested price in Indian rupees' },
    price_note: { type: 'string', description: 'One short sentence explaining the price' },
  },
  required: ['name', 'description', 'category', 'price_inr', 'price_note'],
  additionalProperties: false,
};

const SYSTEM = `You help independent Indian artisans list handmade pieces on ArtiSoul, a local marketplace.
From the photo, write an honest listing: a short, specific title; a warm 2-4 sentence description covering
what it is, visible materials, technique and how it might be used; the best-fitting category; and a fair
price in INR for a handmade piece sold directly by the maker in India. Describe only what is visible: do
not invent dimensions, origin, certifications or materials you cannot see. If the photo does not show a
product, say so in the description and suggest a price of 0.`;

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = client || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// POST /api/ai/listing   (artisan, multipart: field "image"; optional "lang": en|hi|mr)
const suggestListing = asyncHandler(async (req, res) => {
  const claude = getClient();
  if (!claude) {
    return res.status(503).json({ success: false, message: 'AI suggestions are not set up on this server' });
  }
  if (!req.file) return res.status(400).json({ success: false, message: 'Add a photo first' });

  const [[{ used }]] = await pool.query(
    `SELECT COUNT(*) AS used FROM AuditLog
     WHERE actor_id = ? AND action = 'ai.listing' AND created_at > (UTC_TIMESTAMP() - INTERVAL 1 DAY)`,
    [req.user.user_id]
  );
  if (used >= DAILY_LIMIT) {
    return res.status(429).json({ success: false, message: `Daily limit of ${DAILY_LIMIT} AI suggestions reached` });
  }

  const lang = LANGUAGES[req.body.lang] ? req.body.lang : 'en';
  let response;
  try {
    response = await claude.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, retry server-side on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low', // a short extraction task; low effort keeps it fast and cheap
        format: { type: 'json_schema', schema: LISTING_SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: req.file.mimetype, data: req.file.buffer.toString('base64') },
            },
            {
              type: 'text',
              text: `Write the name, description and price_note in ${LANGUAGES[lang]}. Keep the category exactly as one of the allowed values.`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error('AI listing failed:', err.status, err.message);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ success: false, message: 'The AI key on this server is invalid' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ success: false, message: 'The AI service is busy. Try again in a minute.' });
    }
    return res.status(502).json({ success: false, message: 'Could not get AI suggestions right now' });
  }

  if (response.stop_reason === 'refusal') {
    return res.status(422).json({ success: false, message: "The AI couldn't describe this photo. Try another picture." });
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  let listing;
  try {
    listing = JSON.parse(text);
  } catch {
    return res.status(502).json({ success: false, message: 'The AI reply was incomplete. Please try again.' });
  }

  await audit(req, 'ai.listing', { details: { lang, model: response.model } });
  res.json({
    success: true,
    data: {
      name: String(listing.name || '').slice(0, 150),
      description: String(listing.description || '').slice(0, 2000),
      category: CATEGORIES.includes(listing.category) && listing.category !== 'Other' ? listing.category : '',
      price: Math.max(0, Math.min(Math.round(Number(listing.price_inr) || 0), 1_000_000)),
      price_note: String(listing.price_note || '').slice(0, 300),
      remaining_today: DAILY_LIMIT - used - 1,
    },
  });
});

// GET /api/ai/status  - lets the app show or hide the AI button.
const aiStatus = (req, res) => res.json({ success: true, data: { enabled: Boolean(process.env.ANTHROPIC_API_KEY) } });

module.exports = { suggestListing, aiStatus };
