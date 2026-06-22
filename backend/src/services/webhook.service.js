const crypto = require('crypto');
const https  = require('https');
const http   = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function signPayload(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function deliverWebhook(endpoint, event, payload) {
  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
  const sig  = signPayload(endpoint.secret, body);

  return new Promise((resolve) => {
    const url  = new URL(endpoint.url);
    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'POST',
      headers: {
        'Content-Type':    'application/json',
        'Content-Length':  Buffer.byteLength(body),
        'X-Transa-Event':     event,
        'X-Transa-Signature': sig,
      },
      timeout: 10000,
    };

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data.slice(0, 500) }));
    });

    req.on('error',   () => resolve({ statusCode: 0, body: 'Request failed' }));
    req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, body: 'Timeout' }); });
    req.write(body);
    req.end();
  });
}

async function emitWebhookEvent(organizationId, event, payload) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId, isActive: true, events: { has: event } },
  });

  for (const ep of endpoints) {
    const result  = await deliverWebhook(ep, event, payload);
    const success = result.statusCode >= 200 && result.statusCode < 300;

    await prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: ep.id,
        event,
        payload,
        statusCode:   result.statusCode,
        responseBody: result.body,
        success,
        attemptCount: 1,
        deliveredAt:  success ? new Date() : null,
        nextRetryAt:  !success ? new Date(Date.now() + 5 * 60 * 1000) : null,
      },
    });
  }
}

module.exports = { emitWebhookEvent };
