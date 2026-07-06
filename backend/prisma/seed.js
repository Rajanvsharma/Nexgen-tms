const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const existing = await prisma.user.findUnique({ where: { email: 'admin@nexgentms.com' } });
  if (existing) {
    console.log('Admin user already exists:', existing.email);
    return;
  }

  // Create or reuse organization
  let org = await prisma.organization.findFirst({ where: { slug: 'nexgentms' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'NexGen TMS',
        slug: 'nexgentms',
        plan: 'enterprise',
        subscriptionStatus: 'active',
      },
    });
    console.log('Created organization:', org.name);
  }

  const hashed = await bcrypt.hash('Admin@1234', 12);

  const user = await prisma.user.create({
    data: {
      email: 'admin@nexgentms.com',
      password: hashed,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      isActive: true,
      organizationId: org.id,
    },
  });

  console.log('✅ Seeded admin user:');
  console.log('   Email:    admin@nexgentms.com');
  console.log('   Password: Admin@1234');
  console.log('   Org:     ', org.name, '(' + org.id + ')');
  console.log('   User ID: ', user.id);
}

main()
  .catch((e) => { console.error('Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
