const ORG_WIDE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPS_MANAGER']);
const REP_ROLES      = new Set(['DISPATCHER', 'ACCOUNT_EXEC', 'CARRIER_RELATIONS']);

// Returns a Prisma `where` fragment scoping a query to what `user` is allowed to see.
// Pass model='load' (default) for Load queries which have assignedTo.
// Pass model='other' for Customer/Quote/etc. which only have teamId + createdById.
function getVisibilityFilter(user, model = 'load') {
  const { role, organizationId, teamId, repVisibility } = user;

  if (ORG_WIDE_ROLES.has(role)) return { organizationId };
  if (role === 'CUSTOMER') return { organizationId, customerId: user.customerId };
  if (role === 'CARRIER')  return { organizationId, carrierId: user.carrierId };

  // Team managers always see their full team scope
  if (role === 'TEAM_MANAGER') return { organizationId, ...(teamId ? { teamId } : {}) };

  // Rep-level roles
  if (REP_ROLES.has(role)) {
    if (repVisibility === 'team' && teamId) return { organizationId, teamId };
    // For Load model: filter by assignedTo OR createdById (Load has assignedTo column)
    if (model === 'load') {
      return {
        organizationId,
        OR: [
          { assignedTo: user.id },
          { assignedTo: null, createdById: user.id },
        ],
      };
    }
    // For Customer/Quote/etc.: no assignedTo column — scope to team or own records
    return { organizationId, ...(teamId ? { teamId } : { createdById: user.id }) };
  }

  // SUPPORT, COMPLIANCE, ACCOUNTING, AUDITOR — team-scoped
  return { organizationId, ...(teamId ? { teamId } : {}) };
}

module.exports = { getVisibilityFilter, ORG_WIDE_ROLES, REP_ROLES };
