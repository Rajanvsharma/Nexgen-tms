const prisma = require('../services/prisma.service');

const AUDIT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function auditMiddleware(req, res, next) {
  if (!AUDIT_METHODS.includes(req.method)) return next();

  const originalJson = res.json.bind(res);
  const startTime = Date.now();

  res.json = function (body) {
    if (req.user) {
      const action = `${req.method} ${req.path}`;
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action,
          entity: req.path.split('/')[1] || 'unknown',
          entityId: req.params.id || null,
          after: body && typeof body === 'object' ? body : undefined,
          userAgent: req.headers['user-agent'] || null,
          ip: req.ip || null,
        },
      }).catch(() => {});
    }
    return originalJson(body);
  };

  next();
}

module.exports = { auditMiddleware };
