const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SYSTEM_PROMPT = `You are NexGen Copilot, an expert AI assistant built into the NexGen TMS (Transportation Management System). You help freight brokers, dispatchers, and operations staff with their daily tasks.

You have real-time access to the company's data which is provided in each message as context.

Your capabilities:
- Answer questions about loads, carriers, customers, quotes, and accounting
- Suggest carrier rates based on historical lane data
- Draft professional emails for rate confirmations, follow-ups, and quote responses
- Explain compliance issues and alert on carrier document expiry
- Help identify duplicate loads or suspicious patterns
- Provide KPI summaries and business insights
- Guide users through TMS workflows step-by-step

Tone: Professional, concise, and helpful. Use bullet points and formatting when appropriate.
Always reference specific load numbers, carrier names, or customer names from the context when answering.
If you don't have enough context to answer accurately, say so and suggest where to find the information.`;

async function getContext(userId, userRole) {
  try {
    const [
      activeLoads,
      recentQuotes,
      expiringCarriers,
      pendingInvoices,
      recentAnnouncements,
    ] = await Promise.all([
      prisma.load.findMany({
        where: { status: { in: ['CREATED', 'DISPATCHED', 'IN_TRANSIT'] } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
          carrier: { select: { name: true, mcNumber: true } },
        },
        ...(userRole !== 'ADMIN' ? { where: { createdById: userId, status: { in: ['CREATED', 'DISPATCHED', 'IN_TRANSIT'] } } } : {}),
      }),
      prisma.quote.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
      }),
      prisma.carrier.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { insuranceExpiry: { lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
            { authorityExpiry: { lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
          ],
        },
        take: 10,
        select: { name: true, mcNumber: true, insuranceExpiry: true, authorityExpiry: true, w9OnFile: true },
      }),
      prisma.invoice.findMany({
        where: { status: { in: ['SENT', 'OVERDUE'] } },
        take: 5,
        include: { customer: { select: { name: true } }, load: { select: { loadNumber: true } } },
      }),
      prisma.announcement.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { title: true, body: true, createdAt: true },
      }),
    ]);

    const stats = {
      totalActiveLoads: activeLoads.length,
      pendingQuotes: recentQuotes.length,
      expiringCarriers: expiringCarriers.length,
      unpaidInvoices: pendingInvoices.length,
    };

    return `
=== LIVE TMS CONTEXT (as of ${new Date().toLocaleString()}) ===

STATS SUMMARY:
- Active Loads: ${stats.totalActiveLoads}
- Pending Quotes: ${stats.pendingQuotes}
- Carriers with expiring documents (next 30 days): ${stats.expiringCarriers}
- Unpaid Invoices: ${stats.unpaidInvoices}

ACTIVE LOADS (${activeLoads.length}):
${activeLoads.length === 0 ? 'None' : activeLoads.map(l =>
  `• ${l.loadNumber} | ${l.status} | ${l.customer?.name} | ${l.pickupCity}, ${l.pickupState} → ${l.deliveryCity}, ${l.deliveryState} | ${l.equipment} | $${l.customerRate?.toLocaleString()} | Carrier: ${l.carrier?.name || 'Unassigned'}`
).join('\n')}

PENDING QUOTES (${recentQuotes.length}):
${recentQuotes.length === 0 ? 'None' : recentQuotes.map(q =>
  `• ${q.quoteNumber} | ${q.customer?.name} | ${q.pickupCity}, ${q.pickupState} → ${q.deliveryCity}, ${q.deliveryState} | ${q.equipment} | $${q.rate?.toLocaleString()}`
).join('\n')}

COMPLIANCE ALERTS — EXPIRING DOCUMENTS (${expiringCarriers.length}):
${expiringCarriers.length === 0 ? 'None' : expiringCarriers.map(c => {
  const insExp = c.insuranceExpiry ? Math.ceil((new Date(c.insuranceExpiry) - Date.now()) / 86400000) : null;
  const authExp = c.authorityExpiry ? Math.ceil((new Date(c.authorityExpiry) - Date.now()) / 86400000) : null;
  return `• ${c.name} (MC: ${c.mcNumber}) | Insurance: ${insExp !== null ? `${insExp}d` : 'N/A'} | Authority: ${authExp !== null ? `${authExp}d` : 'N/A'} | W9: ${c.w9OnFile ? 'Yes' : 'NO'}`;
}).join('\n')}

UNPAID INVOICES (${pendingInvoices.length}):
${pendingInvoices.length === 0 ? 'None' : pendingInvoices.map(i =>
  `• ${i.invoiceNumber} | ${i.customer?.name} | Load: ${i.load?.loadNumber} | $${i.amount?.toLocaleString()} | ${i.status}`
).join('\n')}

RECENT ANNOUNCEMENTS:
${recentAnnouncements.length === 0 ? 'None' : recentAnnouncements.map(a =>
  `• ${a.title}: ${a.body}`
).join('\n')}
`;
  } catch (err) {
    console.error('getContext error:', err);
    return '(Context unavailable)';
  }
}

async function chat(req, res) {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'messages array is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here') {
      return res.status(503).json({ message: 'AI Copilot is not configured. Add your ANTHROPIC_API_KEY to backend/.env and restart the server.' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const context = await getContext(req.user.id, req.user.role);

    const systemWithContext = `${SYSTEM_PROMPT}\n\n${context}`;

    // Stream the response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemWithContext,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('copilot chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'AI service error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}

module.exports = { chat };
