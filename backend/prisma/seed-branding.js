const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Check if a default already exists
  const existing = await prisma.brandingConfig.findFirst({ where: { isDefault: true } });
  if (existing) {
    console.log('Default branding already exists:', existing.companyName);
    console.log('Updating with NexGen Global Logistics LLC branding...');
    await prisma.brandingConfig.update({
      where: { id: existing.id },
      data: {
        companyName: 'NexGen Global Logistics LLC',
        tagline: 'Smart Freight. Smarter Future.',
        primaryColor: '#1e40af',
        darkColor: '#1e3a8a',
        sidebarBg: '#0a1628',
        accentColor: '#f59e0b',
        isDefault: true,
        isActive: true,
      },
    });
    console.log('Updated default branding.');
    return;
  }

  const config = await prisma.brandingConfig.create({
    data: {
      companyName: 'NexGen Global Logistics LLC',
      tagline: 'Smart Freight. Smarter Future.',
      primaryColor: '#1e40af',
      darkColor: '#1e3a8a',
      sidebarBg: '#0a1628',
      accentColor: '#f59e0b',
      isDefault: true,
      isActive: true,
      plan: 'enterprise',
    },
  });

  console.log('Created default branding config:', config.id);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
