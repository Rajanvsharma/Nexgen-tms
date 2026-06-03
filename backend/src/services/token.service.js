const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  });
}

async function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

async function rotateRefreshToken(oldToken) {
  const existing = await prisma.refreshToken.findUnique({ where: { token: oldToken } });

  if (!existing || existing.expiresAt < new Date()) {
    await prisma.refreshToken.deleteMany({ where: { token: oldToken } });
    return null;
  }

  await prisma.refreshToken.deleteMany({ where: { token: oldToken } });

  const newToken = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token: newToken, userId: existing.userId, expiresAt } });

  return { newToken, userId: existing.userId };
}

async function deleteRefreshToken(token) {
  if (token) await prisma.refreshToken.deleteMany({ where: { token } });
}

module.exports = { generateAccessToken, generateRefreshToken, rotateRefreshToken, deleteRefreshToken };
