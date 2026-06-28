const prisma = require('../services/prisma.service');

const TEAM_SELECT = {
  id: true, name: true, isActive: true, repVisibility: true, createdAt: true,
  manager: { select: { id: true, firstName: true, lastName: true, role: true } },
  _count: { select: { members: true } },
};

async function getTeams(req, res) {
  try {
    const teams = await prisma.team.findMany({
      where: { organizationId: req.user.organizationId },
      select: TEAM_SELECT,
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (err) {
    console.error('getTeams error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getTeam(req, res) {
  try {
    const team = await prisma.team.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, role: true } },
        members: { select: { id: true, firstName: true, lastName: true, role: true, isActive: true } },
      },
    });
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
  } catch (err) {
    console.error('getTeam error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createTeam(req, res) {
  try {
    const { name, managerId } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const exists = await prisma.team.findFirst({
      where: { organizationId: req.user.organizationId, name },
    });
    if (exists) return res.status(409).json({ message: 'A team with this name already exists' });

    if (managerId) {
      const manager = await prisma.user.findFirst({
        where: { id: managerId, organizationId: req.user.organizationId },
      });
      if (!manager) return res.status(404).json({ message: 'Manager user not found' });
    }

    const team = await prisma.team.create({
      data: { organizationId: req.user.organizationId, name, managerId: managerId || null },
      select: TEAM_SELECT,
    });

    if (managerId) {
      await prisma.user.update({
        where: { id: managerId },
        data: { teamId: team.id, role: 'TEAM_MANAGER' },
      });
    }

    res.status(201).json(team);
  } catch (err) {
    console.error('createTeam error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateTeam(req, res) {
  try {
    const { id } = req.params;
    const team = await prisma.team.findFirst({
      where: { id, organizationId: req.user.organizationId },
    });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const { name, managerId, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (isActive !== undefined) data.isActive = isActive;

    const managerChanging = managerId !== undefined && managerId !== team.managerId;

    if (managerId !== undefined) data.managerId = managerId || null;

    // Run team update + manager role/team changes atomically
    const [updated] = await prisma.$transaction(async (tx) => {
      const result = await tx.team.update({ where: { id }, data, select: TEAM_SELECT });

      if (managerChanging) {
        // Reset old manager's role and teamId
        if (team.managerId) {
          await tx.user.update({
            where: { id: team.managerId },
            data: { role: 'DISPATCHER', teamId: null },
          });
        }
        // Promote new manager
        if (managerId) {
          await tx.user.update({
            where: { id: managerId },
            data: { role: 'TEAM_MANAGER', teamId: id },
          });
        }
      }

      return [result];
    });

    res.json(updated);
  } catch (err) {
    console.error('updateTeam error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function setRepVisibility(req, res) {
  try {
    const { id } = req.params;
    const { repVisibility } = req.body;
    if (!['own', 'team'].includes(repVisibility)) {
      return res.status(400).json({ message: 'repVisibility must be "own" or "team"' });
    }
    const team = await prisma.team.findFirst({
      where: { id, organizationId: req.user.organizationId },
    });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const updated = await prisma.team.update({
      where: { id },
      data: { repVisibility },
      select: TEAM_SELECT,
    });
    res.json(updated);
  } catch (err) {
    console.error('setRepVisibility error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function assignMember(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const [team, user] = await Promise.all([
      prisma.team.findFirst({ where: { id, organizationId: req.user.organizationId } }),
      prisma.user.findFirst({ where: { id: userId, organizationId: req.user.organizationId } }),
    ]);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await prisma.user.update({ where: { id: userId }, data: { teamId: id } });
    res.json({ message: 'User assigned to team' });
  } catch (err) {
    console.error('assignMember error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: req.user.organizationId, teamId: id },
    });
    if (!user) return res.status(404).json({ message: 'User not found in this team' });

    await prisma.user.update({ where: { id: userId }, data: { teamId: null } });
    res.json({ message: 'User removed from team' });
  } catch (err) {
    console.error('removeMember error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getTeams, getTeam, createTeam, updateTeam, setRepVisibility, assignMember, removeMember };
