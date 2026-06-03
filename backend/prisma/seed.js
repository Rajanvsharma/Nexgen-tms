const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@nexgentms.com' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed.');
    return;
  }

  const hashed = await bcrypt.hash('Admin@1234', 12);

  await prisma.user.create({
    data: {
      email: 'admin@nexgentms.com',
      password: hashed,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Seeded admin user: admin@nexgentms.com / Admin@1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
