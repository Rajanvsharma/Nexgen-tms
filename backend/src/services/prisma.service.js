const { PrismaClient } = require('../../node_modules/@prisma/client');

const prisma = global._prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') global._prisma = prisma;

module.exports = prisma;
