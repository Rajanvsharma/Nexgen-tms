/**
 * Idempotent admin seed — safe to run on every startup.
 * Always ensures the default org and admin user exist with the correct password.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email       = process.env.ADMIN_EMAIL    || 'admin@nexgentms.com';
  const password    = process.env.ADMIN_PASSWORD || 'Admin2026!';
  const firstName   = process.env.ADMIN_FIRST    || 'System';
  const lastName    = process.env.ADMIN_LAST     || 'Admin';
  const companyName = process.env.COMPANY_NAME   || 'NexGen TMS';

  // Upsert org
  const org = await prisma.organization.upsert({
    where:  { id: 'org_default_nexgentms' },
    update: {},
    create: {
      id:                 'org_default_nexgentms',
      name:               companyName,
      slug:               'nexgentms',
      plan:               'pro',
      subscriptionStatus: 'active',
    },
  });

  // Always upsert admin with a fresh password hash so credentials never drift
  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where:  { email },
    update: { password: hashed, isActive: true, organizationId: org.id },
    create: {
      organizationId: org.id,
      email,
      password:       hashed,
      firstName,
      lastName,
      role:           'ADMIN',
      isActive:       true,
    },
  });

  console.log(`[seed-admin] Admin ready — email: ${email}`);
}

main()
  .catch(e => { console.error('[seed-admin] Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
