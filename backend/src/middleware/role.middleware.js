function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && !roles.includes(req.user.role))) {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireRole };
