const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── GET branding by domain (public — no auth needed) ────────────────────────
async function getBranding(req, res) {
  try {
    const { domain } = req.query;
    let config = null;

    if (domain) {
      config = await prisma.brandingConfig.findUnique({ where: { domain } });
    }
    if (!config) {
      config = await prisma.brandingConfig.findFirst({ where: { isDefault: true } });
    }
    if (!config) {
      config = await prisma.brandingConfig.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    if (!config) {
      return res.json(defaultBranding());
    }
    res.json(config);
  } catch (err) {
    res.json(defaultBranding());
  }
}

// ─── GET all branding configs (admin) ────────────────────────────────────────
async function getAllBranding(req, res) {
  try {
    const configs = await prisma.brandingConfig.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(configs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── CREATE branding config (new tenant) ─────────────────────────────────────
async function createBranding(req, res) {
  try {
    const { companyName, tagline, primaryColor, darkColor, sidebarBg, accentColor, domain, plan, planExpiresAt, contactName, contactEmail, isDefault } = req.body;
    if (!companyName) return res.status(400).json({ message: 'companyName required' });

    if (isDefault) {
      await prisma.brandingConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const config = await prisma.brandingConfig.create({
      data: {
        companyName, tagline: tagline || 'Transportation Management System',
        primaryColor: primaryColor || '#3b82f6', darkColor: darkColor || '#1d4ed8',
        sidebarBg: sidebarBg || '#0d1b2a', accentColor: accentColor || '#22c55e',
        domain: domain || null, plan: plan || 'professional',
        planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null,
        contactName: contactName || null, contactEmail: contactEmail || null,
        isDefault: !!isDefault, isActive: true,
      },
    });
    res.status(201).json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── UPDATE branding config ───────────────────────────────────────────────────
async function updateBranding(req, res) {
  try {
    const { id } = req.params;
    const { companyName, tagline, logoData, primaryColor, darkColor, sidebarBg, accentColor, domain, plan, planExpiresAt, contactName, contactEmail, isDefault, isActive } = req.body;

    if (isDefault) {
      await prisma.brandingConfig.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }

    const data = {};
    if (companyName !== undefined) data.companyName = companyName;
    if (tagline !== undefined) data.tagline = tagline;
    if (logoData !== undefined) data.logoData = logoData;
    if (primaryColor !== undefined) data.primaryColor = primaryColor;
    if (darkColor !== undefined) data.darkColor = darkColor;
    if (sidebarBg !== undefined) data.sidebarBg = sidebarBg;
    if (accentColor !== undefined) data.accentColor = accentColor;
    if (domain !== undefined) data.domain = domain || null;
    if (plan !== undefined) data.plan = plan;
    if (planExpiresAt !== undefined) data.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
    if (contactName !== undefined) data.contactName = contactName;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (isDefault !== undefined) data.isDefault = isDefault;
    if (isActive !== undefined) data.isActive = isActive;

    const config = await prisma.brandingConfig.update({ where: { id }, data });
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ─── DELETE branding config ───────────────────────────────────────────────────
async function deleteBranding(req, res) {
  try {
    const { id } = req.params;
    const config = await prisma.brandingConfig.findUnique({ where: { id } });
    if (config?.isDefault) return res.status(400).json({ message: 'Cannot delete the default branding config' });
    await prisma.brandingConfig.delete({ where: { id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

function defaultBranding() {
  return {
    id: null, companyName: 'NexGen TMS', tagline: 'Transportation Management System',
    logoData: null, primaryColor: '#3b82f6', darkColor: '#1d4ed8',
    sidebarBg: '#0d1b2a', accentColor: '#22c55e', plan: 'enterprise',
    isDefault: true, isActive: true,
  };
}

module.exports = { getBranding, getAllBranding, createBranding, updateBranding, deleteBranding };
