const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here') {
    return null;
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function callClaude(system, prompt, maxTokens = 512) {
  const client = getClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY not configured. Add it to backend/.env');
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text;
}

// ─── Rate Intelligence ────────────────────────────────────────────────────────

async function getRateSuggestion(req, res) {
  try {
    const { pickupCity, pickupState, deliveryCity, deliveryState, equipment, weight, commodity } = req.body;
    if (!pickupCity || !deliveryCity || !equipment) {
      return res.status(400).json({ message: 'pickupCity, deliveryCity, equipment required' });
    }

    const recentLoads = await prisma.load.findMany({
      where: {
        pickupCity: { contains: pickupCity, mode: 'insensitive' },
        deliveryCity: { contains: deliveryCity, mode: 'insensitive' },
        equipment,
        status: { in: ['DELIVERED', 'INVOICED'] },
      },
      select: { customerRate: true, carrierRate: true, weight: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const laneData = recentLoads.length > 0
      ? `Recent ${pickupCity}→${deliveryCity} ${equipment} loads: ${recentLoads.map(l => `$${l.customerRate} (carrier: $${l.carrierRate || 'N/A'})`).join(', ')}`
      : `No historical data for this lane.`;

    const response = await callClaude(
      'You are a freight rate intelligence engine for a US trucking brokerage. Provide concise, actionable rate recommendations.',
      `Lane: ${pickupCity}, ${pickupState} → ${deliveryCity}, ${deliveryState}
Equipment: ${equipment}
Weight: ${weight || 'unknown'} lbs
Commodity: ${commodity || 'general freight'}
${laneData}

Provide a JSON response with: { "suggestedCustomerRate": number, "suggestedCarrierRate": number, "marketLow": number, "marketHigh": number, "confidence": "high"|"medium"|"low", "rationale": "string (1-2 sentences)", "marginPct": number }`,
      256
    );

    let parsed;
    try {
      parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch {
      parsed = { suggestedCustomerRate: 0, suggestedCarrierRate: 0, marketLow: 0, marketHigh: 0, confidence: 'low', rationale: response, marginPct: 0 };
    }

    res.json({ ...parsed, laneHistoryCount: recentLoads.length });
  } catch (err) {
    console.error('getRateSuggestion error:', err);
    res.status(err.message.includes('ANTHROPIC') ? 503 : 500).json({ message: err.message });
  }
}

// ─── Email Composer ───────────────────────────────────────────────────────────

async function composeEmail(req, res) {
  try {
    const { type, context } = req.body;
    // type: quote_response | follow_up | rate_confirmation | payment_reminder | carrier_request | detention_notice
    if (!type) return res.status(400).json({ message: 'type is required' });

    const templates = {
      quote_response: 'Write a professional freight quote response email from a freight broker to a shipper/customer.',
      follow_up: 'Write a polite but assertive follow-up email from a freight broker to a customer who has not responded to a quote.',
      rate_confirmation: 'Write a professional rate confirmation email from a freight broker to a carrier/driver.',
      payment_reminder: 'Write a professional but firm payment reminder email from a freight broker to a customer with an overdue invoice.',
      carrier_request: 'Write a professional carrier capacity request email to find available trucks for a load.',
      detention_notice: 'Write a professional detention charge notice from a freight broker to a customer/carrier.',
    };

    const system = `You are an expert freight broker email writer. Write professional, concise, and effective freight logistics emails. ${templates[type] || 'Write a professional freight logistics email.'} Keep it under 200 words. Use a professional but warm tone. Do not use placeholders like [NAME] - make the email ready to send with realistic example names if needed.`;

    const text = await callClaude(system, `Write the email with this context: ${JSON.stringify(context)}`, 512);
    res.json({ email: text, type });
  } catch (err) {
    console.error('composeEmail error:', err);
    res.status(err.message.includes('ANTHROPIC') ? 503 : 500).json({ message: err.message });
  }
}

// ─── Fraud Scanner ────────────────────────────────────────────────────────────

async function fraudScan(req, res) {
  try {
    const { carrierId } = req.params;
    const carrier = await prisma.carrier.findUnique({
      where: { id: carrierId },
      include: {
        tonuRecords: { take: 5 },
        performances: { select: { hasClaim: true, claimAmount: true }, take: 20 },
        _count: { select: { loads: true } },
      },
    });
    if (!carrier) return res.status(404).json({ message: 'Carrier not found' });

    const daysInsurance = carrier.insuranceExpiry ? Math.ceil((new Date(carrier.insuranceExpiry).getTime() - Date.now()) / 86400000) : null;
    const daysAuthority = carrier.authorityExpiry ? Math.ceil((new Date(carrier.authorityExpiry).getTime() - Date.now()) / 86400000) : null;
    const claimCount = carrier.performances.filter(p => p.hasClaim).length;
    const totalClaims = carrier.performances.reduce((s, p) => s + (p.claimAmount || 0), 0);

    const profile = `Carrier: ${carrier.name} (${carrier.mcNumber})
Insurance expires: ${daysInsurance !== null ? daysInsurance + ' days' : 'unknown'}
Authority expires: ${daysAuthority !== null ? daysAuthority + ' days' : 'unknown'}
W9 on file: ${carrier.w9OnFile}
Status: ${carrier.status}
TONU records: ${carrier.tonuRecords.length}
Claims: ${claimCount} (total $${totalClaims.toLocaleString()})
Total loads: ${carrier._count.loads}`;

    const response = await callClaude(
      'You are a freight carrier fraud and risk analyst. Analyze carriers for double-brokering, identity fraud, authority issues, and financial risk. Be specific and actionable.',
      `Analyze this carrier for fraud risk and provide a JSON response:
${profile}

Return JSON: { "riskScore": 0-100, "riskLevel": "low"|"medium"|"high"|"critical", "flags": ["array of specific risk flags"], "recommendation": "string", "blockRecommended": boolean, "summary": "1 sentence" }`,
      512
    );

    let analysis;
    try {
      analysis = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch {
      analysis = { riskScore: 50, riskLevel: 'medium', flags: [], recommendation: response, blockRecommended: false, summary: 'Manual review recommended.' };
    }

    res.json({ carrier: { name: carrier.name, mcNumber: carrier.mcNumber }, ...analysis, scannedAt: new Date() });
  } catch (err) {
    console.error('fraudScan error:', err);
    res.status(err.message.includes('ANTHROPIC') ? 503 : 500).json({ message: err.message });
  }
}

// ─── Business Insights ────────────────────────────────────────────────────────

async function getInsights(req, res) {
  try {
    const [loads, invoices, carriers, quotes] = await Promise.all([
      prisma.load.findMany({ select: { status: true, customerRate: true, carrierRate: true, equipment: true, pickupCity: true, deliveryCity: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.invoice.findMany({ select: { amount: true, status: true, dueDate: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.carrier.findMany({ select: { status: true, insuranceExpiry: true, authorityExpiry: true }, take: 50 }),
      prisma.quote.findMany({ select: { status: true, rate: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    const totalRev = loads.reduce((s, l) => s + l.customerRate, 0);
    const totalCost = loads.reduce((s, l) => s + (l.carrierRate || 0), 0);
    const activeLoads = loads.filter(l => ['CREATED', 'DISPATCHED', 'IN_TRANSIT'].includes(l.status)).length;
    const overdue = invoices.filter(i => i.status === 'OVERDUE').length;
    const expiringCarriers = carriers.filter(c => {
      const d = c.insuranceExpiry ? Math.ceil((new Date(c.insuranceExpiry).getTime() - Date.now()) / 86400000) : 999;
      return d < 30 && d >= 0;
    }).length;
    const convRate = quotes.length > 0 ? Math.round(quotes.filter(q => q.status !== 'REJECTED').length / quotes.length * 100) : 0;

    const snapshot = `Business snapshot:
- Active loads: ${activeLoads}
- Pipeline revenue: $${totalRev.toLocaleString()}
- Carrier costs: $${totalCost.toLocaleString()}
- Gross margin: ${totalRev > 0 ? Math.round((totalRev - totalCost) / totalRev * 100) : 0}%
- Overdue invoices: ${overdue}
- Carriers with expiring insurance (<30 days): ${expiringCarriers}
- Quote conversion rate: ${convRate}%
- Total quotes: ${quotes.length}`;

    const text = await callClaude(
      'You are a freight brokerage business analyst. Provide concise, actionable business insights. Focus on what needs immediate attention and what is performing well.',
      `${snapshot}\n\nProvide 3-5 specific, actionable insights. Format as JSON array: [{"title": "string", "insight": "string", "priority": "high"|"medium"|"low", "action": "string"}]`,
      768
    );

    let insights;
    try {
      insights = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch {
      insights = [{ title: 'Business Review', insight: text, priority: 'medium', action: 'Review with team.' }];
    }

    res.json({ insights, snapshot: { activeLoads, totalRev, totalCost, overdue, expiringCarriers, convRate }, generatedAt: new Date() });
  } catch (err) {
    console.error('getInsights error:', err);
    res.status(err.message.includes('ANTHROPIC') ? 503 : 500).json({ message: err.message });
  }
}

// ─── Load Summary ─────────────────────────────────────────────────────────────

async function getLoadSummary(req, res) {
  try {
    const load = await prisma.load.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        carrier: true,
        notes: { include: { author: { select: { firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
        invoice: true,
        payment: true,
      },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const margin = load.customerRate - (load.carrierRate || 0);
    const marginPct = load.customerRate > 0 ? Math.round(margin / load.customerRate * 100) : 0;

    const context = `Load ${load.loadNumber}:
Route: ${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}
Customer: ${load.customer.name}
Carrier: ${load.carrier?.name || 'Unassigned'}
Status: ${load.status}
Equipment: ${load.equipment}
Commodity: ${load.commodity || 'N/A'}
Customer rate: $${load.customerRate.toLocaleString()}
Carrier rate: $${(load.carrierRate || 0).toLocaleString()}
Margin: $${margin.toLocaleString()} (${marginPct}%)
Driver: ${load.driverName || 'Not assigned'}
Notes: ${load.notes.map(n => `${n.author.firstName}: ${n.body}`).join(' | ') || 'None'}
Invoice: ${load.invoice ? `${load.invoice.status} - $${load.invoice.amount}` : 'Not created'}`;

    const text = await callClaude(
      'You are a freight operations assistant. Summarize load status and provide specific next-step recommendations.',
      `Summarize this load and provide 2-3 next steps:\n${context}\n\nReturn JSON: { "summary": "2-3 sentence summary", "nextSteps": ["array of specific actions"], "alerts": ["any issues or risks"] }`,
      512
    );

    let result;
    try {
      result = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch {
      result = { summary: text, nextSteps: [], alerts: [] };
    }

    res.json({ loadNumber: load.loadNumber, ...result });
  } catch (err) {
    console.error('getLoadSummary error:', err);
    res.status(err.message.includes('ANTHROPIC') ? 503 : 500).json({ message: err.message });
  }
}

// ─── Margin Optimizer ─────────────────────────────────────────────────────────

async function optimizeMargin(req, res) {
  try {
    const atRisk = await prisma.load.findMany({
      where: { status: { in: ['CREATED', 'DISPATCHED'] }, NOT: { carrierRate: null } },
      include: { customer: { select: { name: true } }, carrier: { select: { name: true } } },
    });

    const lowMargin = atRisk.filter(l => {
      const m = l.customerRate - (l.carrierRate || 0);
      return l.customerRate > 0 && (m / l.customerRate) < 0.15;
    });

    if (lowMargin.length === 0) return res.json({ opportunities: [], message: 'All active loads have healthy margins (>15%).' });

    const text = await callClaude(
      'You are a freight margin optimization specialist. Analyze loads with low margins and suggest specific, actionable ways to improve profitability.',
      `These loads have margins below 15%:
${lowMargin.map(l => {
  const m = l.customerRate - (l.carrierRate || 0);
  const pct = Math.round(m / l.customerRate * 100);
  return `${l.loadNumber}: ${l.customer.name}, ${l.pickupCity}→${l.deliveryCity}, customer $${l.customerRate}, carrier $${l.carrierRate}, margin ${pct}%`;
}).join('\n')}

For each load, suggest specific actions to improve margin. Return JSON array: [{ "loadNumber": "string", "currentMarginPct": number, "suggestions": ["specific actions"], "priorityAction": "string" }]`,
      768
    );

    let opportunities;
    try {
      opportunities = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch {
      opportunities = lowMargin.map(l => ({ loadNumber: l.loadNumber, currentMarginPct: Math.round((l.customerRate - (l.carrierRate || 0)) / l.customerRate * 100), suggestions: [text], priorityAction: 'Review pricing' }));
    }

    res.json({ opportunities, scannedLoads: atRisk.length, flaggedLoads: lowMargin.length });
  } catch (err) {
    console.error('optimizeMargin error:', err);
    res.status(err.message.includes('ANTHROPIC') ? 503 : 500).json({ message: err.message });
  }
}

// ─── Agent Logs ───────────────────────────────────────────────────────────────

async function getAgentLogs(req, res) {
  try {
    const logs = await prisma.agentLog.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function triggerAgent(req, res) {
  try {
    const { agentName } = req.params;
    const { runAgents } = require('../services/agents.service');
    res.json({ message: `Agent ${agentName} triggered. Check logs for results.` });
    // Run async, don't await
    runAgents(agentName).catch(console.error);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getRateSuggestion, composeEmail, fraudScan, getInsights, getLoadSummary, optimizeMargin, getAgentLogs, triggerAgent };
