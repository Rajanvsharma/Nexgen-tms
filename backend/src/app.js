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
const { startAgentScheduler } = require('./services/agents.service');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NexGen TMS backend running on port ${PORT}`);
  startAgentScheduler();
});
