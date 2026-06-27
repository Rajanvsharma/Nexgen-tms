const prisma = require('./prisma.service');

async function logLoadAction({ loadId, action, fromValue, toValue, changedById }) {
  return prisma.loadAuditLog.create({
    data: {
      loadId,
      action,
      fromValue: fromValue ?? null,
      toValue: toValue ?? null,
      changedById,
    },
  });
}

module.exports = { logLoadAction };
