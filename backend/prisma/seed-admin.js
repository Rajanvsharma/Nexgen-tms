/**
 * Run once after a fresh deploy to create the default org + first admin user.
 * Usage: node prisma/seed-admin.js
 * Env vars: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST, ADMIN_LAST, COMPANY_NAME
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email       = process.env.ADMIN_EMAIL    || 'admin@nexgentms.com';
  const password    = process.env.ADMIN_PASSWORD || 'Admin2026!';
  const firstName   = process.env.ADMIN_FIRST    || 'Admin';
  const lastName    = process.env.ADMIN_LAST     || 'User';
  const companyName = process.env.COMPANY_NAME   || 'NexGen TMS';

  // Upsert the default org
  let org = await prisma.organization.findUnique({ where: { id: 'org_default_nexgentms' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: 'org_default_nexgentms',
        name: companyName,
        slug: 'nexgentms',
        plan: 'pro',
        subscriptionStatus: 'active',
      },
    });
    console.log(`Organization created: ${org.name}`);
  } else {
    console.log(`Organization already exists: ${org.name}`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Ensure it's linked to the org
    if (!existing.organizationId) {
      await prisma.user.update({ where: { id: existing.id }, data: { organizationId: org.id } });
      console.log(`Admin linked to org: ${email}`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { organizationId: org.id, email, password: hashed, firstName, lastName, role: 'ADMIN', isActive: true },
  });

  console.log(`\nAdmin created successfully!`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Org:      ${org.name}`);
  console.log(`\nChange the password immediately after first login.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
