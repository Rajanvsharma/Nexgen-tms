require('dotenv').config();
const http         = require('http');
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const logger       = require('./services/logger.service');
const { auditMiddleware } = require('./middleware/audit.middleware');

const authRoutes         = require('./routes/auth.routes');
const userRoutes         = require('./routes/user.routes');
const announcementRoutes = require('./routes/announcement.routes');
const customerRoutes     = require('./routes/customer.routes');
const carrierRoutes      = require('./routes/carrier.routes');
const quoteRoutes        = require('./routes/quote.routes');
const loadRoutes         = require('./routes/load.routes');
const accountingRoutes   = require('./routes/accounting.routes');
const emailRoutes        = require('./routes/email.routes');
const statsRoutes        = require('./routes/stats.routes');
const notesRoutes        = require('./routes/notes.routes');
const reportsRoutes      = require('./routes/reports.routes');
const scorecardRoutes    = require('./routes/scorecard.routes');
const documentsRoutes    = require('./routes/documents.routes');
const loadboardRoutes    = require('./routes/loadboard.routes');
const ocrRoutes          = require('./routes/ocr.routes');
const copilotRoutes      = require('./routes/copilot.routes');
const aiRoutes           = require('./routes/ai.routes');
const consoleRoutes      = require('./routes/console.routes');
const portalRoutes         = require('./routes/portal.routes');
const carrierPortalRoutes  = require('./routes/carrier-portal.routes');
const brandingRoutes     = require('./routes/branding.routes');
const quickbooksRoutes   = require('./routes/quickbooks.routes');
const trackingRoutes     = require('./routes/tracking.routes');
const stripeRoutes       = require('./routes/stripe.routes');
const organizationRoutes = require('./routes/organization.routes');
const podRoutes          = require('./routes/pod.routes');
const accessorialRoutes  = require('./routes/accessorial.routes');
const stopsRoutes        = require('./routes/stops.routes');
const searchRoutes       = require('./routes/search.routes');
const laneRoutes         = require('./routes/lane.routes');
const webhookRoutes      = require('./routes/webhook.routes');
const workflowRoutes     = require('./routes/workflow.routes');
const teamRoutes         = require('./routes/team.routes');
const { startAgentScheduler } = require('./services/agents.service');
const { runDailyScan }   = require('./services/workflow.service');
const { initSocket }     = require('./services/socket.service');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const allowedOrigins = (process.env.FRONTEND_URL || 'https://nexgentms.vercel.app').split(',').map(o => o.trim().replace(/\/$/, ''));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    // Allow any Vercel deployment (production + previews) and explicitly listed origins
    if (/\.vercel\.app$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

// Stripe webhook needs raw body â€” must come before express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000,      max: 300, standardHeaders: true, legacyHeaders: false });

app.use(express.json());
app.use(cookieParser());
app.use(auditMiddleware);

app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip });
  next();
});

app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/announcements',announcementRoutes);
app.use('/api/customers',    customerRoutes);
app.use('/api/carriers',     carrierRoutes);
app.use('/api/quotes',       quoteRoutes);
app.use('/api/loads',        loadRoutes);
app.use('/api/accounting',   accountingRoutes);
app.use('/api/email',        emailRoutes);
app.use('/api/stats',        statsRoutes);
app.use('/api/notes',        notesRoutes);
app.use('/api/reports',      reportsRoutes);
app.use('/api/scorecard',    scorecardRoutes);
app.use('/api/documents',    documentsRoutes);
app.use('/api/loadboard',    loadboardRoutes);
app.use('/api/ocr',          ocrRoutes);
app.use('/api/copilot',      copilotRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/console',      consoleRoutes);
app.use('/api/portal',          portalRoutes);
app.use('/api/carrier-portal',  carrierPortalRoutes);
app.use('/api/branding',     brandingRoutes);
app.use('/api/quickbooks',   quickbooksRoutes);
app.use('/api/tracking',     trackingRoutes);
app.use('/api/stripe',       stripeRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/loads/:loadId/pods',          podRoutes);
app.use('/api/loads/:loadId/accessorials',  accessorialRoutes);
app.use('/api/loads/:loadId/stops',         stopsRoutes);
app.use('/api/search',       apiLimiter, searchRoutes);
app.use('/api/lanes',        laneRoutes);
app.use('/api/webhooks',     webhookRoutes);
app.use('/api/workflows',    workflowRoutes);
app.use('/api/teams',        teamRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now(), version: process.env.npm_package_version || '1.0.0' }));

app.use((err, req, res, _next) => {
  logger.error({ method: req.method, url: req.url, message: err.message, stack: err.stack });
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT       = process.env.PORT || 4000;
const httpServer = http.createServer(app);

initSocket(httpServer, allowedOrigins);

httpServer.listen(PORT, () => {
  logger.info(`Transa backend running on port ${PORT}`);

  if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      const url = `${process.env.RENDER_EXTERNAL_URL}/api/health`;
      require('https').get(url, () => {}).on('error', () => {});
    }, 14 * 60 * 1000);
  }

  startAgentScheduler();

  // Workflow daily scan — runs once at startup, then every 24 hours
  runDailyScan();
  setInterval(runDailyScan, 24 * 60 * 60 * 1000);
});

function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
