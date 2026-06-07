const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function main() {
  const customers = await p.customer.findMany({ select: { id: true, name: true }, take: 5 });
  console.log('Customers:', JSON.stringify(customers));

  const custUsers = await p.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true, email: true, customerId: true } });
  console.log('CUSTOMER users:', JSON.stringify(custUsers));

  // If no CUSTOMER users or unlinked, create/fix one using first customer
  if (customers.length > 0) {
    const firstCustomer = customers[0];

    // Check if there's already a linked user
    const linked = custUsers.find(u => u.customerId === firstCustomer.id);
    if (linked) {
      console.log('Already linked:', linked.email, '->', firstCustomer.name);
      await p.$disconnect();
      return;
    }

    // Create or update a shipper login
    const email = 'shipper@nexgentms.com';
    const existing = await p.user.findUnique({ where: { email } });
    const hashed = await bcrypt.hash('Shipper@123', 12);

    if (existing) {
      await p.user.update({ where: { id: existing.id }, data: { customerId: firstCustomer.id, role: 'CUSTOMER', password: hashed } });
      console.log('Updated existing user:', email, '-> linked to', firstCustomer.name);
    } else {
      await p.user.create({ data: {
        email, password: hashed, firstName: firstCustomer.name.split(' ')[0] || 'Shipper', lastName: 'Portal',
        role: 'CUSTOMER', customerId: firstCustomer.id, isActive: true,
      }});
      console.log('Created shipper user:', email, '-> linked to', firstCustomer.name);
    }
    console.log('Login: shipper@nexgentms.com / Shipper@123');
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
