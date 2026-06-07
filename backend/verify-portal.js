const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const user = await p.user.findUnique({
    where: { email: 'rajansharma74@gmail.com' },
    select: { id: true, email: true, role: true, customerId: true },
  });
  console.log('User:', JSON.stringify(user));

  if (user && user.customerId) {
    const cust = await p.customer.findUnique({ where: { id: user.customerId }, select: { id: true, name: true } });
    console.log('Linked customer:', JSON.stringify(cust));
  } else {
    console.log('No customerId set on this user');
  }
  await p.$disconnect();
}
main().catch(console.error);
