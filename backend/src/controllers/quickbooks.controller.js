const { PrismaClient } = require('@prisma/client');
const https = require('https');
const prisma = new PrismaClient();

// QuickBooks Online OAuth2 + Accounting API
// Set these env vars in Render: QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REALM_ID, QB_ACCESS_TOKEN, QB_REFRESH_TOKEN

const QB_BASE = 'https://quickbooks.api.intuit.com';
const QB_AUTH = 'https://oauth.platform.intuit.com/oauth2/v1';

function qbHeaders() {
  return {
    'Authorization': `Bearer ${process.env.QB_ACCESS_TOKEN}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

async function qbRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const realmId = process.env.QB_REALM_ID;
    const url = `${QB_BASE}/v3/company/${realmId}${path}`;
    const payload = body ? JSON.stringify(body) : null;
    const parsed = new URL(url);

    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      method,
      headers: { ...qbHeaders(), ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function isConfigured() {
  return !!(process.env.QB_CLIENT_ID && process.env.QB_ACCESS_TOKEN && process.env.QB_REALM_ID);
}

async function getStatus(_req, res) {
  res.json({
    configured: isConfigured(),
    realmId: process.env.QB_REALM_ID || null,
    instructions: isConfigured() ? null : [
      '1. Create a QuickBooks app at developer.intuit.com',
      '2. Set QB_CLIENT_ID and QB_CLIENT_SECRET in Render env vars',
      '3. Visit /api/quickbooks/auth to start OAuth2 flow',
      '4. After auth, QB_ACCESS_TOKEN and QB_REALM_ID are set automatically',
    ],
  });
}

function getOAuthUrl(_req, res) {
  if (!process.env.QB_CLIENT_ID) return res.status(400).json({ message: 'QB_CLIENT_ID not configured' });
  const redirectUri = encodeURIComponent(`${process.env.BACKEND_URL || 'http://localhost:4000'}/api/quickbooks/callback`);
  const url = `${QB_AUTH}/authorize?client_id=${process.env.QB_CLIENT_ID}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${redirectUri}&state=nexgen`;
  res.json({ url });
}

async function handleCallback(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ message: 'Missing authorization code' });

  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/quickbooks/callback`;
  const credentials = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');

  const payload = `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return new Promise((resolve) => {
    const req2 = https.request({
      hostname: 'oauth.platform.intuit.com',
      path: '/oauth2/v1/tokens/bearer',
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) },
    }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        const body = JSON.parse(data);
        if (body.access_token) {
          // In production, store these securely (env vars or DB encrypted)
          console.log('[QuickBooks] Access token obtained. Set these env vars:');
          console.log(`QB_ACCESS_TOKEN=${body.access_token}`);
          console.log(`QB_REFRESH_TOKEN=${body.refresh_token}`);
          res.send('<h2>QuickBooks connected! Copy the tokens from Render logs and set as env vars. You can close this window.</h2>');
        } else {
          res.status(400).json({ message: 'OAuth failed', body });
        }
        resolve();
      });
    });
    req2.on('error', () => { res.status(500).json({ message: 'OAuth request failed' }); resolve(); });
    req2.write(payload);
    req2.end();
  });
}

async function exportInvoice(req, res) {
  if (!isConfigured()) return res.status(400).json({ message: 'QuickBooks not configured. Visit /api/quickbooks/status for setup instructions.' });

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { load: true, customer: true },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Find or create QB customer
    const searchResult = await qbRequest('GET', `/query?query=SELECT * FROM Customer WHERE DisplayName = '${invoice.customer.name.replace(/'/g, "\\'")}'`);
    let qbCustomerId = searchResult.body?.QueryResponse?.Customer?.[0]?.Id;

    if (!qbCustomerId) {
      const createResult = await qbRequest('POST', '/customer', {
        DisplayName: invoice.customer.name,
        PrimaryEmailAddr: invoice.customer.email ? { Address: invoice.customer.email } : undefined,
        PrimaryPhone: invoice.customer.phone ? { FreeFormNumber: invoice.customer.phone } : undefined,
      });
      qbCustomerId = createResult.body?.Customer?.Id;
      if (!qbCustomerId) return res.status(500).json({ message: 'Failed to create QuickBooks customer', detail: createResult.body });
    }

    // Create QB invoice
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : null;
    const qbInvoice = {
      CustomerRef: { value: qbCustomerId },
      DueDate: dueDate,
      DocNumber: invoice.invoiceNumber,
      PrivateNote: `Load ${invoice.load.loadNumber} · ${invoice.load.pickupCity}, ${invoice.load.pickupState} → ${invoice.load.deliveryCity}, ${invoice.load.deliveryState}`,
      Line: [{
        DetailType: 'SalesItemLineDetail',
        Amount: invoice.amount,
        Description: `Freight services — Load ${invoice.load.loadNumber}`,
        SalesItemLineDetail: { UnitPrice: invoice.amount, Qty: 1 },
      }],
    };

    const result = await qbRequest('POST', '/invoice', qbInvoice);
    if (result.status >= 200 && result.status < 300) {
      const qbId = result.body?.Invoice?.Id;
      res.json({ message: `Invoice exported to QuickBooks`, quickbooksId: qbId, invoiceNumber: invoice.invoiceNumber });
    } else {
      res.status(500).json({ message: 'QuickBooks export failed', detail: result.body });
    }
  } catch (err) {
    console.error('exportInvoice error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getStatus, getOAuthUrl, handleCallback, exportInvoice };
