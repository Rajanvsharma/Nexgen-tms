require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const announcementRoutes = require('./routes/announcement.routes');
const customerRoutes = require('./routes/customer.routes');
const carrierRoutes = require('./routes/carrier.routes');
const quoteRoutes = require('./routes/quote.routes');
const loadRoutes = require('./routes/load.routes');
const accountingRoutes = require('./routes/accounting.routes');
const emailRoutes = require('./routes/email.routes');
const statsRoutes = require('./routes/stats.routes');
const notesRoutes = require('./routes/notes.routes');
const reportsRoutes = require('./routes/reports.routes');
const scorecardRoutes = require('./routes/scorecard.routes');
const documentsRoutes = require('./routes/documents.routes');
const loadboardRoutes = require('./routes/loadboard.routes');
const ocrRoutes = require('./routes/ocr.routes');
const copilotRoutes = require('./routes/copilot.routes');
const aiRoutes = require('./routes/ai.routes');
const consoleRoutes = require('./routes/console.routes');
const portalRoutes = require('./routes/portal.routes');
const brandingRoutes = require('./routes/branding.routes');
const quickbooksRoutes = require('./routes/quickbooks.routes');
const trackingRoutes = require('./routes/tracking.routes');
const stripeRoutes = require('./routes/stripe.routes');
const organizationRoutes = require('./routes/organization.routes');
const { startAgentScheduler } = require('./services/agents.service');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(o => o.trim().replace(/\/$/, ''));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

// Stripe webhook needs raw body — must come before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/carriers', carrierRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/loads', loadRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/scorecard', scorecardRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/loadboard', loadboardRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/console', consoleRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/quickbooks', quickbooksRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/organization', organizationRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Self-ping every 14 min to prevent Render free tier sleep
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    const url = `${process.env.RENDER_EXTERNAL_URL}/api/health`;
    require('https').get(url, () => {}).on('error', () => {});
  }, 14 * 60 * 1000);
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NexGen TMS backend running on port ${PORT}`);
  startAgentScheduler();
});
