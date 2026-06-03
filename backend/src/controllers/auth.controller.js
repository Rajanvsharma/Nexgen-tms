const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { generateAccessToken, generateRefreshToken, rotateRefreshToken, deleteRefreshToken } = require('../services/token.service');

const prisma = new PrismaClient();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = await generateRefreshToken(user.id);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.json({
      accessToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function refresh(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token' });

    const result = await rotateRefreshToken(token);
    if (!result) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: result.userId } });
    if (!user || !user.isActive) return res.status(401).json({ message: 'User not found or deactivated' });

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    res.cookie('refreshToken', result.newToken, COOKIE_OPTS);
    res.json({ accessToken });
  } catch (err) {
    console.error('refresh error:', err);
    res.clearCookie('refreshToken');
    res.status(401).json({ message: 'Session expired, please login again' });
  }
}

async function logout(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await deleteRefreshToken(token);
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('logout error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { login, refresh, logout, me };
