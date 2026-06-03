const { PrismaClient } = require('@prisma/client');
const cron = require('node-cron');

const prisma = new PrismaClient();

function hasApiKey() {
  return process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here';
}

async function logAgent(agentName) {
  return prisma.agentLog.create({ data: { agentName, status: 'RUNNING' } });
}

async function completeAgent(id, opts = {}) {
  const { summary, findings = 0, actions = 0, error } = opts;
  return prisma.agentLog.update({
    where: { id },
    data: { status: error ? 'ERROR' : 'COMPLETED', summary, findings, actions, error: error || null, completedAt: new Date() },
  });
}

// ─── Agent 1: Compliance Guardian ────────────────────────────────────────────
async function runComplianceGuardian() {
  const log = await logAgent('Compliance Guardian');
  try {
    const carriers = await prisma.carrier.findMany({ where: { status: 'ACTIVE' } });
    const now = Date.now();
    let flagged = 0, blocked = 0;

    for (const carrier of carriers) {
      const insExp = carrier.insuranceExpiry ? Math.ceil((new Date(carrier.insuranceExpiry).getTime() - now) / 86400000) : null;
      const authExp = carrier.authorityExpiry ? Math.ceil((new Date(carrier.authorityExpiry).getTime() - now) / 86400000) : null;
      const isExpired = (insExp !== null && insExp < 0) || (authExp !== null && authExp < 0);
      const isExpiring = (insExp !== null && insExp < 7) || (authExp !== null && authExp < 7);

      if (isExpired) {
        await prisma.carrier.update({ where: { id: carrier.id }, data: { status: 'SUSPENDED' } });
        blocked++;
        console.log(`[Compliance Guardian] BLOCKED: ${carrier.name}`);
      } else if (isExpiring) {
        flagged++;
        console.log(`[Compliance Guardian] FLAGGED: ${carrier.name}`);
      }
    }

    await completeAgent(log.id, {
      summary: `Scanned ${carriers.length} carriers. Blocked ${blocked} (expired docs). Flagged ${flagged} (expiring <7 days).`,
      findings: flagged + blocked,
      actions: blocked,
    });
  } catch (err) {
    await completeAgent(log.id, { error: err.message });
  }
}

// ─── Agent 2: Fraud Sentinel ─────────────────────────────────────────────────
async function runFraudSentinel() {
  const log = await logAgent('Fraud Sentinel');
  try {
    const recentLoads = await prisma.load.findMany({
      where: { status: { in: ['DISPATCHED', 'IN_TRANSIT'] }, carrierId: { not: null } },
      include: { carrier: { include: { tonuRecords: true, performances: { select: { hasClaim: true } } } } },
      take: 50,
    });

    let flagged = 0;
    const flags = [];

    for (const load of recentLoads) {
      const c = load.carrier;
      if (!c) continue;

      const insExp = c.insuranceExpiry ? Math.ceil((new Date(c.insuranceExpiry).getTime() - Date.now()) / 86400000) : null;
      const authExp = c.authorityExpiry ? Math.ceil((new Date(c.authorityExpiry).getTime() - Date.now()) / 86400000) : null;
      const tonu = c.tonuRecords.length;
      const claims = c.performances.filter(p => p.hasClaim).length;
      const isRisky = (insExp !== null && insExp < 14) || (authExp !== null && authExp < 14) || tonu >= 3 || claims >= 3 || c.status === 'SUSPENDED';

      if (isRisky) {
        flagged++;
        const reasons = [
          insExp !== null && insExp < 14 ? 'insurance expiring' : '',
          authExp !== null && authExp < 14 ? 'authority expiring' : '',
          tonu >= 3 ? `${tonu} TONUs` : '',
          claims >= 3 ? `${claims} claims` : '',
        ].filter(Boolean).join(', ');
        flags.push(`${c.name} on ${load.loadNumber}: ${reasons}`);
      }
    }

    await completeAgent(log.id, {
      summary: `Scanned ${recentLoads.length} active loads. Found ${flagged} high-risk carrier assignments.${flags.length ? ' ' + flags.slice(0, 2).join('; ') : ''}`,
      findings: flagged,
      actions: 0,
    });
  } catch (err) {
    await completeAgent(log.id, { error: err.message });
  }
}

// ─── Agent 3: Invoice Aging Agent ────────────────────────────────────────────
async function runInvoiceAging() {
  const log = await logAgent('Invoice Aging Agent');
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'OVERDUE'] }, dueDate: { not: null } },
      include: { customer: { select: { name: true } }, load: { select: { loadNumber: true } } },
    });

    let overdue = 0, updated = 0;

    for (const inv of invoices) {
      const daysOverdue = Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
      if (daysOverdue > 0 && inv.status !== 'OVERDUE') {
        await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } });
        updated++;
        overdue++;
      } else if (daysOverdue > 0) {
        overdue++;
      }
    }

    await completeAgent(log.id, {
      summary: `Scanned ${invoices.length} sent invoices. ${overdue} overdue. Marked ${updated} as OVERDUE.`,
      findings: overdue,
      actions: updated,
    });
  } catch (err) {
    await completeAgent(log.id, { error: err.message });
  }
}

// ─── Agent 4: Rate Intelligence Agent ────────────────────────────────────────
async function runRateIntelligence() {
  const log = await logAgent('Rate Intelligence Agent');
  try {
    const loads = await prisma.load.findMany({
      where: { status: { in: ['CREATED', 'DISPATCHED'] }, carrierRate: { not: null } },
      select: { id: true, loadNumber: true, customerRate: true, carrierRate: true },
    });

    let flagged = 0;

    for (const load of loads) {
      if (!load.carrierRate || load.customerRate === 0) continue;
      const margin = (load.customerRate - load.carrierRate) / load.customerRate;
      if (margin < 0.10) {
        await prisma.load.update({ where: { id: load.id }, data: { isDuplicate: true } });
        flagged++;
      }
    }

    await completeAgent(log.id, {
      summary: `Scanned ${loads.length} active loads. Flagged ${flagged} loads with margin below 10%.`,
      findings: flagged,
      actions: flagged,
    });
  } catch (err) {
    await completeAgent(log.id, { error: err.message });
  }
}

// ─── Agent 5: Email Processing Agent ─────────────────────────────────────────
async function runEmailProcessor() {
  const log = await logAgent('Email Processing Agent');
  try {
    const { pollAllMailboxes } = require('./email.service');
    const count = await pollAllMailboxes();
    await completeAgent(log.id, {
      summary: `Polled all active mailboxes. Processed ${count} new email(s).`,
      findings: count,
      actions: count,
    });
  } catch (err) {
    await completeAgent(log.id, { error: err.message });
  }
}

// ─── Agent 6: AI Insights Agent ──────────────────────────────────────────────
async function runAIInsightsAgent() {
  if (!hasApiKey()) {
    const log = await logAgent('AI Insights Agent');
    await completeAgent(log.id, { summary: 'Skipped — ANTHROPIC_API_KEY not configured.', findings: 0, actions: 0 });
    return;
  }

  const log = await logAgent('AI Insights Agent');
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const [loads, invoices, quotes] = await Promise.all([
      prisma.load.findMany({ select: { status: true, customerRate: true, carrierRate: true }, take: 100 }),
      prisma.invoice.findMany({ select: { status: true, amount: true }, take: 50 }),
      prisma.quote.findMany({ select: { status: true }, take: 30 }),
    ]);

    const totalRev = loads.reduce((s, l) => s + l.customerRate, 0);
    const totalCost = loads.reduce((s, l) => s + (l.carrierRate || 0), 0);
    const margin = totalRev > 0 ? Math.round((totalRev - totalCost) / totalRev * 100) : 0;
    const overdue = invoices.filter(i => i.status === 'OVERDUE').length;
    const activeLoads = loads.filter(l => ['CREATED', 'DISPATCHED', 'IN_TRANSIT'].includes(l.status)).length;

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a 2-sentence daily business briefing for a freight brokerage: Active loads: ${activeLoads}, Revenue: $${totalRev.toLocaleString()}, Margin: ${margin}%, Overdue invoices: ${overdue}. Be specific and professional.`,
      }],
    });

    const body = msg.content[0].text;
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (admin) {
      await prisma.announcement.create({
        data: {
          title: `AI Daily Briefing — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          body,
          postedBy: admin.id,
        },
      });
    }

    await completeAgent(log.id, { summary: `Generated AI briefing and posted as announcement.`, findings: 1, actions: 1 });
  } catch (err) {
    await completeAgent(log.id, { error: err.message });
  }
}

// ─── Agent 7: Duplicate Detector ─────────────────────────────────────────────
async function runDuplicateDetector() {
  const log = await logAgent('Duplicate Detector');
  try {
    const loads = await prisma.load.findMany({
      where: { status: { in: ['CREATED', 'DISPATCHED', 'IN_TRANSIT'] } },
      select: { id: true, loadNumber: true, customerId: true, pickupCity: true, deliveryCity: true, pickupDate: true, isDuplicate: true },
    });

    let flagged = 0;
    const seen = new Map();

    for (const load of loads) {
      const key = `${load.customerId}|${load.pickupCity}|${load.deliveryCity}|${load.pickupDate ? new Date(load.pickupDate).toISOString().slice(0, 10) : ''}`;
      if (seen.has(key)) {
        if (!load.isDuplicate) {
          await prisma.load.update({ where: { id: load.id }, data: { isDuplicate: true } });
          flagged++;
        }
      } else {
        seen.set(key, load.id);
      }
    }

    await completeAgent(log.id, { summary: `Checked ${loads.length} active loads. Flagged ${flagged} potential duplicates.`, findings: flagged, actions: flagged });
  } catch (err) {
    await completeAgent(log.id, { error: err.message });
  }
}

// ─── Master runner ────────────────────────────────────────────────────────────

const AGENTS = {
  'Compliance Guardian': runComplianceGuardian,
  'Fraud Sentinel': runFraudSentinel,
  'Invoice Aging Agent': runInvoiceAging,
  'Rate Intelligence Agent': runRateIntelligence,
  'Email Processing Agent': runEmailProcessor,
  'AI Insights Agent': runAIInsightsAgent,
  'Duplicate Detector': runDuplicateDetector,
};

async function runAgents(agentName) {
  if (agentName && AGENTS[agentName]) {
    await AGENTS[agentName]();
    return;
  }
  for (const fn of Object.values(AGENTS)) {
    try { await fn(); } catch (err) { console.error('[Agent error]', err); }
  }
}

function startAgentScheduler() {
  cron.schedule('*/30 * * * *', () => runEmailProcessor().catch(console.error));
  cron.schedule('0 * * * *', () => runDuplicateDetector().catch(console.error));
  cron.schedule('0 */12 * * *', () => runRateIntelligence().catch(console.error));
  cron.schedule('0 7 * * *', () => runInvoiceAging().catch(console.error));
  cron.schedule('0 6 * * *', () => runComplianceGuardian().catch(console.error));
  cron.schedule('0 */6 * * *', () => runFraudSentinel().catch(console.error));
  cron.schedule('0 8 * * *', () => runAIInsightsAgent().catch(console.error));

  console.log('[Agents] 7 autonomous agents scheduled');

  // Startup checks
  setTimeout(() => {
    runDuplicateDetector().catch(console.error);
    runRateIntelligence().catch(console.error);
    runInvoiceAging().catch(console.error);
  }, 3000);
}

module.exports = { startAgentScheduler, runAgents, AGENTS };
