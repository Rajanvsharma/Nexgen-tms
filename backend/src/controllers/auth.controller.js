const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticator } = require('otplib');
const { generateAccessToken, generateRefreshToken, rotateRefreshToken, deleteRefreshToken } = require('../services/token.service');
const { sendPasswordResetEmail } = require('../services/outbound.service');

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

    // 2FA check
    if (user.totpEnabled) {
      const { totpCode } = req.body;
      if (!totpCode) return res.status(200).json({ requires2FA: true, message: 'Enter your 2FA code to continue' });
      const totpValid = authenticator.verify({ token: totpCode, secret: user.totpSecret });
      if (!totpValid) return res.status(401).json({ message: 'Invalid 2FA code' });
    }

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role, customerId: user.customerId || null });
    const refreshToken = await generateRefreshToken(user.id);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.json({
      accessToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, customerId: user.customerId || null },
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

async function updateMe(req, res) {
  try {
    const { firstName, lastName, currentPassword, newPassword } = req.body;
    const data = {};

    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password required to set a new password' });
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
      data.password = await bcrypt.hash(newPassword, 12);
    }

    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to update' });

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    });
    res.json(updated);
  } catch (err) {
    console.error('updateMe error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return 200 to prevent email enumeration
    if (!user || !user.isActive) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    await sendPasswordResetEmail({ toEmail: user.email, firstName: user.firstName, resetUrl });
    if (!process.env.SMTP_HOST) {
      console.log(`[Password Reset] No SMTP configured — reset URL: ${resetUrl}`);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired' });

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { login, refresh, logout, me, updateMe, forgotPassword, resetPassword };
