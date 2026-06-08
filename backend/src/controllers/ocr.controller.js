const { PrismaClient } = require('@prisma/client');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

function getAnthropicClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your-anthropic-api-key-here') return null;
  return new Anthropic({ apiKey: key });
}

const EXTRACT_SYSTEM = `You are a freight document parser for a US trucking brokerage.
Extract shipment information from the document and return ONLY valid JSON with these exact fields:
{
  "pickupCity": string or null,
  "pickupState": string (2-letter) or null,
  "deliveryCity": string or null,
  "deliveryState": string (2-letter) or null,
  "commodity": string or null,
  "weight": number (lbs) or null,
  "equipment": one of ["Dry Van","Reefer","Flatbed","Step Deck","RGN","Power Only","Box Truck","LTL"] or null,
  "pickupDate": ISO date string or null,
  "deliveryDate": ISO date string or null,
  "rate": number (USD) or null,
  "specialInstructions": string or null,
  "shipper": string or null,
  "consignee": string or null,
  "bolNumber": string or null,
  "poNumber": string or null
}
Return only the JSON object, no explanation.`;

async function extractWithClaude(client, fileBuffer, mimeType, filename) {
  const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType);
  const isPDF = mimeType === 'application/pdf';

  if (isImage) {
    const base64 = fileBuffer.toString('base64');
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: EXTRACT_SYSTEM,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 },
        }, {
          type: 'text',
          text: 'Extract all shipment information from this document image.',
        }],
      }],
    });
    return JSON.parse(msg.content[0].text);
  }

  if (isPDF) {
    const base64 = fileBuffer.toString('base64');
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: EXTRACT_SYSTEM,
      messages: [{
        role: 'user',
        content: [{
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }, {
          type: 'text',
          text: 'Extract all shipment information from this PDF document.',
        }],
      }],
    });
    return JSON.parse(msg.content[0].text);
  }

  // Plain text fallback
  const text = fileBuffer.toString('utf8');
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: `Extract shipment info from:\n\n${text}` }],
  });
  return JSON.parse(msg.content[0].text);
}

function regexFallback(filename, text) {
  const result = {
    pickupCity: null, pickupState: null,
    deliveryCity: null, deliveryState: null,
    commodity: null, weight: null, equipment: null,
    pickupDate: null, deliveryDate: null, rate: null,
    specialInstructions: null, shipper: null, consignee: null,
    bolNumber: null, poNumber: null,
  };

  const equipmentMap = {
    'dry van': 'Dry Van', 'reefer': 'Reefer', 'refrigerated': 'Reefer',
    'flatbed': 'Flatbed', 'step deck': 'Step Deck', 'rgn': 'RGN',
    'power only': 'Power Only', 'box truck': 'Box Truck', 'ltl': 'LTL',
  };
  const lower = text.toLowerCase();
  for (const [k, v] of Object.entries(equipmentMap)) {
    if (lower.includes(k)) { result.equipment = v; break; }
  }

  const weightMatch = text.match(/(\d[\d,]*)\s*(?:lbs?|pounds?)/i);
  if (weightMatch) result.weight = parseFloat(weightMatch[1].replace(/,/g, ''));

  const rateMatch = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (rateMatch) result.rate = parseFloat(rateMatch[1].replace(/,/g, ''));

  const routeMatch = text.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s+(?:to|->|–|-)\s+([A-Za-z\s]+),\s*([A-Z]{2})/i);
  if (routeMatch) {
    result.pickupCity = routeMatch[1].trim();
    result.pickupState = routeMatch[2].toUpperCase();
    result.deliveryCity = routeMatch[3].trim();
    result.deliveryState = routeMatch[4].toUpperCase();
  }

  return result;
}

async function uploadAndParse(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  let parsedData = null;
  let method = 'regex';

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const client = getAnthropicClient();

    if (client) {
      try {
        parsedData = await extractWithClaude(client, fileBuffer, req.file.mimetype, req.file.originalname);
        method = 'claude-vision';
      } catch (aiErr) {
        console.warn('Claude Vision extraction failed, falling back to regex:', aiErr.message);
      }
    }

    if (!parsedData) {
      const text = req.file.mimetype === 'text/plain'
        ? fileBuffer.toString('utf8')
        : (req.body.extractedText || '');
      parsedData = regexFallback(req.file.originalname, text);
    }

    parsedData._method = method;

    const log = await prisma.ocrLog.create({
      data: {
        filename: req.file.originalname,
        parsedData,
        status: parsedData.pickupCity && parsedData.deliveryCity ? 'PARSED' : 'PENDING',
        createdById: req.user.id,
      },
    });

    fs.unlink(req.file.path, () => {});
    res.status(201).json(log);
  } catch (err) {
    console.error('uploadAndParse error:', err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getOcrLogs(_req, res) {
  try {
    const logs = await prisma.ocrLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    res.json(logs);
  } catch (err) {
    console.error('getOcrLogs error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createQuoteFromOcr(req, res) {
  try {
    const log = await prisma.ocrLog.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ message: 'OCR log not found' });
    if (log.quoteId) return res.status(400).json({ message: 'Quote already created' });

    const { customerId, pickupCity, pickupState, deliveryCity, deliveryState, commodity, weight, equipment, pickupDate, deliveryDate, rate, specialInstructions } = req.body;
    if (!customerId || !pickupCity || !deliveryCity || !equipment || !rate) {
      return res.status(400).json({ message: 'customerId, cities, equipment, and rate are required' });
    }

    const last = await prisma.quote.findFirst({ orderBy: { createdAt: 'desc' }, select: { quoteNumber: true } });
    const num = last ? parseInt(last.quoteNumber.replace('Q-', ''), 10) + 1 : 1001;
    const quoteNumber = `Q-${String(num).padStart(5, '0')}`;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber, customerId, pickupCity, pickupState, deliveryCity, deliveryState,
        commodity, weight: weight ? parseFloat(weight) : null, equipment,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        rate: parseFloat(rate), specialInstructions,
        source: `OCR:${log.filename}`,
        createdById: req.user.id,
      },
    });

    await prisma.ocrLog.update({ where: { id: log.id }, data: { quoteId: quote.id, status: 'QUOTE_CREATED' } });
    res.status(201).json(quote);
  } catch (err) {
    console.error('createQuoteFromOcr error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { uploadAndParse, getOcrLogs, createQuoteFromOcr };
