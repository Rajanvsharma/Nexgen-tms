const prisma = require('../services/prisma.service');
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
function getKey() {
  const k = process.env.ENCRYPTION_KEY || 'nexgen-default-encryption-key-32x';
  return Buffer.from(k.slice(0, 32).padEnd(32, '0'));
}
function encryptKey(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}
function decryptKey(stored) {
  try {
    const [ivHex, tagHex, encHex] = stored.split(':');
    if (!ivHex || !tagHex || !encHex) return stored;
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
  } catch { return stored; }
}

async function getOrganization(req, res) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: {
        id: true, name: true, slug: true, plan: true,
        subscriptionStatus: true, trialEndsAt: true,
        maxUsers: true, maxLoadsPerMonth: true,
        createdAt: true,
      },
    });
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const [userCount, loadsThisMonth] = await Promise.all([
      prisma.user.count({ where: { organizationId: org.id, isActive: true } }),
      prisma.load.count({
        where: {
          organizationId: org.id,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    res.json({ ...org, usage: { users: userCount, loadsThisMonth } });
  } catch (err) {
    console.error('getOrganization error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateOrganization(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const org = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: { name },
      select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
    });
    res.json(org);
  } catch (err) {
    console.error('updateOrganization error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getMembers(req, res) {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error('getMembers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getAiConfig(req, res) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { aiProvider: true, aiApiKey: true, aiModel: true },
    });
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json({
      aiProvider: org.aiProvider || 'anthropic',
      aiModel: org.aiModel || '',
      hasApiKey: !!org.aiApiKey,
    });
  } catch (err) {
    console.error('getAiConfig error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function saveAiConfig(req, res) {
  try {
    const { aiProvider, aiApiKey, aiModel } = req.body;
    if (!aiProvider || !['anthropic', 'openai'].includes(aiProvider)) {
      return res.status(400).json({ message: 'aiProvider must be "anthropic" or "openai"' });
    }
    const data = { aiProvider, aiModel: aiModel || null };
    if (aiApiKey && aiApiKey !== '••••••••') {
      data.aiApiKey = encryptKey(aiApiKey);
    }
    await prisma.organization.update({ where: { id: req.user.organizationId }, data });
    res.json({ message: 'AI configuration saved.' });
  } catch (err) {
    console.error('saveAiConfig error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ── Custom Domain Management ──────────────────────────────────────────────────

async function getCustomDomains(req, res) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { customDomain: true, carrierDomain: true },
    });
    res.json(org || { customDomain: null, carrierDomain: null });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function setCustomDomains(req, res) {
  try {
    const { customDomain, carrierDomain } = req.body;

    // Validate they don't belong to another org
    if (customDomain) {
      const taken = await prisma.organization.findFirst({
        where: { customDomain, NOT: { id: req.user.organizationId } },
      });
      if (taken) return res.status(409).json({ message: `${customDomain} is already in use by another account` });
    }
    if (carrierDomain) {
      const taken = await prisma.organization.findFirst({
        where: { carrierDomain, NOT: { id: req.user.organizationId } },
      });
      if (taken) return res.status(409).json({ message: `${carrierDomain} is already in use by another account` });
    }

    const org = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: {
        customDomain:  customDomain  ? customDomain.toLowerCase().trim()  : null,
        carrierDomain: carrierDomain ? carrierDomain.toLowerCase().trim() : null,
      },
      select: { customDomain: true, carrierDomain: true },
    });
    res.json({ message: 'Custom domains saved', ...org });
  } catch (err) {
    console.error('setCustomDomains error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Public: resolve any hostname → org + portal type (no auth required)
async function resolveTenantByDomain(req, res) {
  try {
    const domain = (req.query.domain || '').toLowerCase().trim();
    if (!domain) return res.status(400).json({ message: 'domain is required' });

    const org = await prisma.organization.findFirst({
      where: { OR: [{ customDomain: domain }, { carrierDomain: domain }] },
      select: { id: true, name: true, slug: true, customDomain: true, carrierDomain: true },
    });
    if (!org) return res.status(404).json({ message: 'Domain not registered' });

    res.json({
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      portalType: org.customDomain === domain ? 'tms' : 'carrier',
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getDecryptedAiKey(orgId) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { aiProvider: true, aiApiKey: true, aiModel: true },
  });
  if (!org) return null;
  return {
    provider: org.aiProvider || 'anthropic',
    apiKey: org.aiApiKey ? decryptKey(org.aiApiKey) : null,
    model: org.aiModel || null,
  };
}

module.exports = { getOrganization, updateOrganization, getMembers, getAiConfig, saveAiConfig, getDecryptedAiKey, getCustomDomains, setCustomDomains, resolveTenantByDomain };
