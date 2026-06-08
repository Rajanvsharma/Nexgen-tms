const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

authenticator.options = { window: 1 }; // allow 1 step clock drift

async function setupTOTP(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.totpEnabled) return res.status(400).json({ message: '2FA is already enabled. Disable it first to re-setup.' });

    const secret = authenticator.generateSecret();
    const appName = encodeURIComponent('NexGen TMS');
    const email = encodeURIComponent(user.email);
    const otpauthUrl = `otpauth://totp/${appName}:${email}?secret=${secret}&issuer=${appName}`;
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not enabled until verified)
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });

    res.json({
      secret,
      qrCode: qrDataUrl,
      instructions: 'Scan the QR code with Google Authenticator or Authy, then call POST /api/auth/2fa/verify with the 6-digit code to enable 2FA.',
    });
  } catch (err) {
    console.error('setupTOTP error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function verifyAndEnableTOTP(req, res) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'code is required' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.totpSecret) return res.status(400).json({ message: 'Run 2FA setup first' });
    if (user.totpEnabled) return res.status(400).json({ message: '2FA is already enabled' });

    const valid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!valid) return res.status(400).json({ message: 'Invalid code. Make sure your authenticator app time is synced.' });

    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    res.json({ message: '2FA enabled successfully. You will need your authenticator app at every login.' });
  } catch (err) {
    console.error('verifyAndEnableTOTP error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function disableTOTP(req, res) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Your current 2FA code is required to disable 2FA' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.totpEnabled) return res.status(400).json({ message: '2FA is not enabled' });

    const valid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!valid) return res.status(400).json({ message: 'Invalid 2FA code' });

    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
    res.json({ message: '2FA disabled successfully.' });
  } catch (err) {
    console.error('disableTOTP error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getTOTPStatus(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { totpEnabled: true },
    });
    res.json({ enabled: user?.totpEnabled || false });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { setupTOTP, verifyAndEnableTOTP, disableTOTP, getTOTPStatus };
