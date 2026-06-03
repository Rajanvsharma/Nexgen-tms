const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Extract quote fields from plain email body using regex heuristics
function parseEmailBody(subject, bodyText) {
  const text = (subject + '\n' + bodyText).toLowerCase();

  const result = {
    pickupCity: null, pickupState: null,
    deliveryCity: null, deliveryState: null,
    commodity: null, weight: null, equipment: null,
    pickupDate: null, deliveryDate: null, rate: null,
    specialInstructions: null,
  };

  // Equipment
  const equipmentMap = {
    'dry van': 'Dry Van', 'reefer': 'Reefer', 'refrigerated': 'Reefer',
    'flatbed': 'Flatbed', 'step deck': 'Step Deck', 'rgn': 'RGN',
    'power only': 'Power Only', 'box truck': 'Box Truck',
  };
  for (const [key, val] of Object.entries(equipmentMap)) {
    if (text.includes(key)) { result.equipment = val; break; }
  }

  // Weight
  const weightMatch = bodyText.match(/(\d[\d,]*)\s*(?:lbs?|pounds?)/i);
  if (weightMatch) result.weight = parseFloat(weightMatch[1].replace(/,/g, ''));

  // Rate
  const rateMatch = bodyText.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (rateMatch) result.rate = parseFloat(rateMatch[1].replace(/,/g, ''));

  // Route — look for "from X to Y" or "X, ST to Y, ST" patterns
  const routeMatch = bodyText.match(/(?:from\s+)?([A-Za-z\s]+),\s*([A-Z]{2})\s+(?:to|->|–|-)\s+([A-Za-z\s]+),\s*([A-Z]{2})/i);
  if (routeMatch) {
    result.pickupCity = routeMatch[1].trim();
    result.pickupState = routeMatch[2].toUpperCase();
    result.deliveryCity = routeMatch[3].trim();
    result.deliveryState = routeMatch[4].toUpperCase();
  }

  // Commodity
  const commodityMatch = bodyText.match(/(?:commodity|product|freight|cargo)[:\s]+([^\n,]+)/i);
  if (commodityMatch) result.commodity = commodityMatch[1].trim();

  // Dates
  const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
  const dates = [...bodyText.matchAll(dateRegex)].map((m) => m[1]);
  if (dates[0]) result.pickupDate = new Date(dates[0]);
  if (dates[1]) result.deliveryDate = new Date(dates[1]);

  return result;
}

async function checkMailbox(config) {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port === 993,
    auth: { user: config.username, pass: config.password },
    logger: false,
  });

  let newQuotes = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.folder || 'INBOX');

    try {
      const since = config.lastChecked || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const messages = client.fetch({ since }, { source: true });

      for await (const msg of messages) {
        const parsed = await simpleParser(msg.source);
        const messageId = parsed.messageId || `${msg.uid}@${config.host}`;

        const exists = await prisma.emailLog.findUnique({ where: { messageId } });
        if (exists) continue;

        const bodyText = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '';
        const parsedData = parseEmailBody(parsed.subject || '', bodyText);

        const log = await prisma.emailLog.create({
          data: {
            messageId,
            subject: parsed.subject || '(no subject)',
            fromEmail: parsed.from?.value?.[0]?.address || '',
            fromName: parsed.from?.value?.[0]?.name || null,
            receivedAt: parsed.date || new Date(),
            bodyText: bodyText.slice(0, 5000),
            parsedData,
            status: parsedData.pickupCity && parsedData.deliveryCity ? 'PARSED' : 'SKIPPED',
          },
        });

        newQuotes++;
      }
    } finally {
      lock.release();
    }

    await client.logout();

    await prisma.emailConfig.update({
      where: { id: config.id },
      data: { lastChecked: new Date() },
    });
  } catch (err) {
    console.error(`IMAP error for config ${config.id}:`, err.message);
  }

  return newQuotes;
}

async function pollAllMailboxes() {
  const configs = await prisma.emailConfig.findMany({ where: { isActive: true } });
  let total = 0;
  for (const cfg of configs) {
    total += await checkMailbox(cfg);
  }
  return total;
}

module.exports = { pollAllMailboxes, checkMailbox, parseEmailBody };
