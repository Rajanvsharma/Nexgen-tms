/**
 * Run once after a fresh deploy to create the first admin user.
 * Usage: node prisma/seed-admin.js
 * Or set env vars: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST, ADMIN_LAST
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email     = process.env.ADMIN_EMAIL     || 'admin@nexgentms.com';
  const password  = process.env.ADMIN_PASSWORD  || 'Admin2026!';
  const firstName = process.env.ADMIN_FIRST     || 'Admin';
  const lastName  = process.env.ADMIN_LAST      || 'User';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashed, firstName, lastName, role: 'ADMIN', isActive: true },
  });

  console.log(`Admin created successfully!`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     ${user.role}`);
  console.log(`\nChange the password immediately after first login.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
