const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const Anthropic = require('@anthropic-ai/sdk');

const prisma = new PrismaClient();

function getAI() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your-anthropic-api-key-here') return null;
  return new Anthropic({ apiKey: key });
}

// ─── Resolve customerId (handles stale JWTs missing the field) ───────────────

async function resolveCustomerId(user) {
  if (user.customerId) return user.customerId;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { customerId: true } });
  return dbUser?.customerId || null;
}

// ─── My Quotes ───────────────────────────────────────────────────────────────

async function getMyQuotes(req, res) {
  try {
    const customerId = await resolveCustomerId(req.user);
    if (!customerId) return res.status(403).json({ message: 'No customer account linked' });

    const quotes = await prisma.quote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, quoteNumber: true, status: true,
        pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true,
        commodity: true, weight: true, equipment: true,
        pickupDate: true, deliveryDate: true, rate: true,
        specialInstructions: true, source: true, createdAt: true,
        load: { select: { id: true, loadNumber: true, status: true } },
      },
    });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── My Loads ────────────────────────────────────────────────────────────────

async function getMyLoads(req, res) {
  try {
    const customerId = await resolveCustomerId(req.user);
    if (!customerId) return res.status(403).json({ message: 'No customer account linked' });

    const loads = await prisma.load.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true,
        equipment: true, commodity: true, weight: true,
        pickupDate: true, deliveryDate: true, customerRate: true,
        driverName: true, driverPhone: true,
        carrier: { select: { name: true, phone: true } },
        createdAt: true,
      },
    });
    res.json(loads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── Create Quote (manual) ────────────────────────────────────────────────────

async function createQuote(req, res) {
  try {
    const { id: userId } = req.user;
    const customerId = await resolveCustomerId(req.user);
    if (!customerId) return res.status(403).json({ message: 'No customer account linked' });

    const { pickupCity, pickupState, deliveryCity, deliveryState, equipment, commodity, weight, pickupDate, deliveryDate, specialInstructions, rate, source } = req.body;

    if (!pickupCity || !deliveryCity || !equipment) {
      return res.status(400).json({ message: 'Pickup city, delivery city, and equipment are required' });
    }

    const count = await prisma.quote.count();
    const quoteNumber = `QSP-${String(count + 1).padStart(6, '0')}`;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        customerId,
        pickupCity, pickupState: pickupState || '',
        deliveryCity, deliveryState: deliveryState || '',
        equipment,
        commodity: commodity || null,
        weight: weight ? parseFloat(weight) : null,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        specialInstructions: specialInstructions || null,
        rate: rate ? parseFloat(rate) : 0,
        source: source || 'Portal',
        createdById: userId,
        status: 'PENDING',
      },
    });
    res.status(201).json(quote);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── Parse Email (AI extract) ─────────────────────────────────────────────────

async function parseEmail(req, res) {
  try {
    const { emailText } = req.body;
    if (!emailText) return res.status(400).json({ message: 'emailText required' });

    const ai = getAI();
    if (ai) {
      const msg = await ai.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'You are a freight quote extraction engine. Extract shipping details from emails or text and return ONLY valid JSON. No explanation.',
        messages: [{
          role: 'user',
          content: `Extract freight shipment details from this text. Return JSON with these fields (use null if not found):
{ "pickupCity": string, "pickupState": string, "deliveryCity": string, "deliveryState": string, "equipment": "Dry Van"|"Reefer"|"Flatbed"|"Step Deck"|"Box Truck"|"Power Only", "commodity": string, "weight": number|null, "pickupDate": "YYYY-MM-DD"|null, "deliveryDate": "YYYY-MM-DD"|null, "specialInstructions": string|null, "confidence": "high"|"medium"|"low" }

Text:
${emailText}`,
        }],
      });
      let parsed;
      try { parsed = JSON.parse(msg.content[0].text.replace(/```json?\n?/g, '').replace(/```/g, '')); }
      catch { parsed = demoEmailExtract(emailText); }
      return res.json({ ...parsed, source: 'AI Email Extraction' });
    }

    // Demo mode
    res.json({ ...demoEmailExtract(emailText), source: 'Demo Extraction' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

function demoEmailExtract(text) {
  const t = text.toLowerCase();

  const cityStateRe = /([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})\s*(?:\d{5})?/g;
  const locations = [...text.matchAll(cityStateRe)].map(m => ({ city: m[1].trim(), state: m[2] }));
  const pickup = locations[0] || null;
  const delivery = locations[1] || null;

  const weightMatch = text.match(/(\d[\d,]+)\s*(?:lbs?|pounds?)/i);
  const weight = weightMatch ? parseFloat(weightMatch[1].replace(',', '')) : null;

  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  const pickupDate = dateMatch ? (() => {
    try {
      const d = new Date(dateMatch[1]);
      return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    } catch { return null; }
  })() : null;

  let equipment = 'Dry Van';
  if (t.includes('reefer') || t.includes('refrigerat') || t.includes('frozen') || t.includes('temp')) equipment = 'Reefer';
  else if (t.includes('flatbed') || t.includes('flat bed')) equipment = 'Flatbed';
  else if (t.includes('step deck')) equipment = 'Step Deck';
  else if (t.includes('box truck')) equipment = 'Box Truck';

  const commodityMatch = text.match(/commodity[:\s]+([^\n,\.]+)/i) || text.match(/(?:carrying|shipping|product)[:\s]+([^\n,\.]+)/i);

  return {
    pickupCity: pickup?.city || null,
    pickupState: pickup?.state || null,
    deliveryCity: delivery?.city || null,
    deliveryState: delivery?.state || null,
    equipment,
    commodity: commodityMatch ? commodityMatch[1].trim() : null,
    weight,
    pickupDate,
    deliveryDate: null,
    specialInstructions: null,
    confidence: locations.length >= 2 ? 'medium' : 'low',
  };
}

// ─── Parse Excel/CSV ──────────────────────────────────────────────────────────

async function parseExcel(req, res) {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'rows array required' });
    }

    const FIELD_MAP = {
      'pickup city': 'pickupCity', 'origin city': 'pickupCity', 'from city': 'pickupCity',
      'pickup state': 'pickupState', 'origin state': 'pickupState', 'from state': 'pickupState',
      'delivery city': 'deliveryCity', 'destination city': 'deliveryCity', 'to city': 'deliveryCity',
      'delivery state': 'deliveryState', 'destination state': 'deliveryState', 'to state': 'deliveryState',
      'equipment': 'equipment', 'equipment type': 'equipment', 'trailer type': 'equipment',
      'commodity': 'commodity', 'freight': 'commodity', 'product': 'commodity',
      'weight': 'weight', 'weight (lbs)': 'weight', 'lbs': 'weight',
      'pickup date': 'pickupDate', 'ship date': 'pickupDate', 'ready date': 'pickupDate',
      'delivery date': 'deliveryDate', 'deliver by': 'deliveryDate',
      'rate': 'rate', 'target rate': 'rate', 'price': 'rate',
      'notes': 'specialInstructions', 'instructions': 'specialInstructions', 'special instructions': 'specialInstructions',
    };

    const mapped = rows.map(row => {
      const out = {};
      for (const [key, val] of Object.entries(row)) {
        const norm = String(key).toLowerCase().trim();
        const field = FIELD_MAP[norm];
        if (field) out[field] = val;
      }
      return out;
    }).filter(r => r.pickupCity || r.deliveryCity);

    res.json({ quotes: mapped, count: mapped.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── Customer Info ────────────────────────────────────────────────────────────

async function getPortalMe(req, res) {
  try {
    const customerId = await resolveCustomerId(req.user);
    if (!customerId) return res.json({ customer: null });
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, email: true, phone: true, city: true, state: true, creditTerms: true },
    });
    res.json({ customer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getMyQuotes, getMyLoads, createQuote, parseEmail, parseExcel, getPortalMe };
