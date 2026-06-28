const { Resend } = require('resend');

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = () => process.env.EMAIL_FROM || 'NexGen TMS <noreply@transatms.com>';
const BASE = () => (process.env.FRONTEND_URL || 'https://nexgentms.vercel.app').replace(/\/$/, '');

async function sendMail({ to, subject, html, attachments }) {
  const client = getClient();
  if (!client) {
    console.log('[Outbound Email - Resend not configured]', subject, '→', to);
    return { simulated: true };
  }

  const payload = { from: FROM(), to, subject, html };
  if (attachments?.length) {
    payload.attachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
    }));
  }

  const { data, error } = await client.emails.send(payload);
  if (error) throw new Error(error.message);
  return data;
}

async function sendInvoiceEmail({ invoice, load, customer, pdfBuffer }) {
  const amount = `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const due = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Net 30';
  return sendMail({
    to: customer.email,
    subject: `Invoice ${invoice.invoiceNumber} from NexGen TMS`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Invoice ${invoice.invoiceNumber}</h2>
        <p>Dear ${customer.name},</p>
        <p>Please find attached your invoice for load <strong>${load.loadNumber}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Amount Due</td><td style="padding:8px">${amount}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Due Date</td><td style="padding:8px">${due}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Route</td><td style="padding:8px">${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}</td></tr>
        </table>
        <p>Questions? Reply to this email.</p>
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Move Smarter. Deliver Better.</p>
      </div>`,
    attachments: pdfBuffer ? [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }] : [],
  });
}

async function sendRateConfirmationEmail({ load, carrier, signUrl, pdfBuffer }) {
  const rate = `$${Number(load.carrierRate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return sendMail({
    to: carrier.email,
    subject: `Rate Confirmation – Load ${load.loadNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Rate Confirmation – ${load.loadNumber}</h2>
        <p>Dear ${carrier.name},</p>
        <p>Please review and sign the rate confirmation for the following load.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Load #</td><td style="padding:8px">${load.loadNumber}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Origin</td><td style="padding:8px">${load.pickupCity}, ${load.pickupState}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Destination</td><td style="padding:8px">${load.deliveryCity}, ${load.deliveryState}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Pickup Date</td><td style="padding:8px">${load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : 'TBD'}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Carrier Rate</td><td style="padding:8px"><strong>${rate}</strong></td></tr>
        </table>
        ${signUrl ? `<p><a href="${signUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Sign Rate Confirmation</a></p>` : ''}
        <p>The rate confirmation PDF is attached for your records.</p>
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Move Smarter. Deliver Better.</p>
      </div>`,
    attachments: pdfBuffer ? [{ filename: `rate-confirmation-${load.loadNumber}.pdf`, content: pdfBuffer }] : [],
  });
}

async function sendLoadStatusUpdate({ load, toEmail, toName, status, message }) {
  return sendMail({
    to: toEmail,
    subject: `Load ${load.loadNumber} – Status: ${status}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Load Update – ${load.loadNumber}</h2>
        <p>Dear ${toName},</p>
        <p>Load <strong>${load.loadNumber}</strong> status has been updated to <strong>${status}</strong>.</p>
        ${message ? `<p>${message}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Route</td><td style="padding:8px">${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}</td></tr>
          ${load.driverName ? `<tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Driver</td><td style="padding:8px">${load.driverName}${load.driverPhone ? ` · ${load.driverPhone}` : ''}</td></tr>` : ''}
        </table>
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Move Smarter. Deliver Better.</p>
      </div>`,
  });
}

async function sendPasswordResetEmail({ toEmail, firstName, resetUrl }) {
  return sendMail({
    to: toEmail,
    subject: 'NexGen TMS – Password Reset',
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Password Reset</h2>
        <p>Hi ${firstName},</p>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Reset Password</a></p>
        <p style="color:#6b7280;font-size:12px">If you didn't request this, ignore this email.</p>
      </div>`,
  });
}

async function sendUserInviteEmail({ toEmail, firstName, inviteUrl, invitedBy, role }) {
  return sendMail({
    to: toEmail,
    subject: "You've been invited to NexGen TMS",
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">You're Invited!</h2>
        <p>Hi ${firstName},</p>
        <p><strong>${invitedBy}</strong> has invited you to join <strong>NexGen TMS</strong> as a <strong>${role}</strong>.</p>
        <p>Click the button below to set your password and access the platform. This link expires in <strong>72 hours</strong>.</p>
        <p><a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Accept Invitation</a></p>
        <p style="color:#6b7280;font-size:12px">If you didn't expect this, you can ignore this email.</p>
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Move Smarter. Deliver Better.</p>
      </div>`,
  });
}

async function sendShipperInviteEmail({ toEmail, firstName, companyName, inviteUrl, invitedBy }) {
  return sendMail({
    to: toEmail,
    subject: `${companyName} — Shipper Portal Access`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Shipper Portal Access</h2>
        <p>Hi ${firstName || 'there'},</p>
        <p><strong>${invitedBy}</strong> has set up a shipper portal account for <strong>${companyName}</strong>.</p>
        <p>You can track your shipments, view quotes, and manage your loads — all in one place.</p>
        <p>Click below to set your password and get started. This link expires in <strong>72 hours</strong>.</p>
        <p><a href="${inviteUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Access Shipper Portal</a></p>
        <p style="color:#6b7280;font-size:12px">Questions? Reply to this email.</p>
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Move Smarter. Deliver Better.</p>
      </div>`,
  });
}

async function sendCarrierInviteEmail({ toEmail, firstName, companyName, inviteUrl, invitedBy }) {
  return sendMail({
    to: toEmail,
    subject: `${companyName} — Carrier Portal Access`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Carrier Portal Access</h2>
        <p>Hi ${firstName || 'there'},</p>
        <p><strong>${invitedBy}</strong> has set up a carrier portal account for <strong>${companyName}</strong>.</p>
        <p>You can view assigned loads, download rate confirmations, submit PODs, and manage your company details — all in one place.</p>
        <p>Click below to set your password and get started. This link expires in <strong>72 hours</strong>.</p>
        <p><a href="${inviteUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Access Carrier Portal</a></p>
        <p style="color:#6b7280;font-size:12px">Questions? Reply to this email.</p>
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Move Smarter. Deliver Better.</p>
      </div>`,
  });
}

// ── Load change notifications ─────────────────────────────────────────────────

const STATUS_LABEL = {
  CREATED:'Open', BOOKED:'Booked', DISPATCHED:'Dispatched', DRIVER_ON_ROUTE:'Driver On Route',
  LOADING:'Loading', IN_TRANSIT:'In Transit', ON_ROUTE:'On Route', UNLOADING:'Unloading',
  DELIVERED:'Delivered', DELAYED:'Delayed', ON_HOLD:'On Hold', INVOICED:'Invoiced',
  PAYMENTS:'Payment Received', RECEIVED:'Received', COMPLETED:'Completed', CANCELLED:'Cancelled',
};

const STATUS_COLOR = {
  DISPATCHED:'#4338ca', DRIVER_ON_ROUTE:'#3730a3', LOADING:'#b45309', IN_TRANSIT:'#b45309',
  ON_ROUTE:'#b45309', UNLOADING:'#c2410c', DELIVERED:'#065f46', INVOICED:'#5b21b6',
  PAYMENTS:'#0e7490', RECEIVED:'#0f766e', COMPLETED:'#065f46', CANCELLED:'#b91c1c',
};

function loadRow(label, value) {
  return `<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;font-size:13px;color:#374151;width:140px">${label}</td><td style="padding:8px 12px;font-size:13px;color:#111827">${value}</td></tr>`;
}

function emailWrapper(title, accentColor, bodyHtml) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <div style="background:${accentColor};padding:20px 28px">
        <div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px">NexGen TMS</div>
        <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:2px">Move Smarter. Deliver Better.</div>
      </div>
      <div style="padding:28px">
        <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#111827">${title}</h2>
        ${bodyHtml}
        <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">
          This is an automated notification from NexGen TMS. Do not reply to this email.
        </div>
      </div>
    </div>`;
}

// Sent to customer + carrier when dispatcher changes load status
async function sendLoadStatusChangedEmail({ load, toEmail, toName, fromStatus, toStatus, changedBy, portalUrl }) {
  if (!toEmail) return;
  const label = STATUS_LABEL[toStatus] || toStatus.replace(/_/g, ' ');
  const color = STATUS_COLOR[toStatus] || '#1d4ed8';
  const fmt   = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
  const fmtM  = n => n ? `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:0})}` : '—';

  return sendMail({
    to: toEmail,
    subject: `Load ${load.loadNumber} is now ${label}`,
    html: emailWrapper(
      `Load ${load.loadNumber} — ${label}`,
      color,
      `<p style="color:#374151;font-size:14px;margin:0 0 16px">Hi ${toName || 'there'},</p>
       <p style="color:#374151;font-size:14px;margin:0 0 20px">
         Load <strong>${load.loadNumber}</strong> status has been updated from
         <strong>${STATUS_LABEL[fromStatus]||fromStatus}</strong> to
         <span style="background:${color}22;color:${color};padding:2px 10px;border-radius:20px;font-weight:700;font-size:13px">${label}</span>.
       </p>
       <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
         ${loadRow('Load #', load.loadNumber)}
         ${loadRow('Route', `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`)}
         ${loadRow('Equipment', load.equipment || '—')}
         ${loadRow('Pickup', fmt(load.pickupDate))}
         ${loadRow('Delivery', fmt(load.deliveryDate))}
         ${load.driverName ? loadRow('Driver', `${load.driverName}${load.driverPhone?' · '+load.driverPhone:''}`) : ''}
         ${changedBy ? loadRow('Updated by', changedBy) : ''}
       </table>
       ${portalUrl ? `<p><a href="${portalUrl}" style="background:#1d4ed8;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:700;font-size:13px">View Load</a></p>` : ''}`
    ),
  });
}

// Sent to carrier portal user when load is dispatched / assigned to them
async function sendCarrierDispatchedEmail({ load, toEmail, toName, carrierPortalUrl }) {
  if (!toEmail) return;
  const fmt  = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
  const fmtM = n => n ? `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:0})}` : '—';

  return sendMail({
    to: toEmail,
    subject: `New Load Assigned — ${load.loadNumber}`,
    html: emailWrapper(
      `You've been assigned a new load`,
      '#4338ca',
      `<p style="color:#374151;font-size:14px;margin:0 0 16px">Hi ${toName || 'there'},</p>
       <p style="color:#374151;font-size:14px;margin:0 0 20px">
         A load has been assigned to your carrier. Please review the details and confirm availability.
       </p>
       <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
         ${loadRow('Load #', load.loadNumber)}
         ${loadRow('Route', `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`)}
         ${loadRow('Equipment', load.equipment || '—')}
         ${loadRow('Pickup', fmt(load.pickupDate))}
         ${loadRow('Delivery', fmt(load.deliveryDate))}
         ${load.carrierRate ? loadRow('Your Rate', fmtM(load.carrierRate)) : ''}
         ${load.commodity ? loadRow('Commodity', load.commodity) : ''}
         ${load.weight ? loadRow('Weight', `${Number(load.weight).toLocaleString()} lbs`) : ''}
         ${load.specialInstructions ? loadRow('Special Instructions', load.specialInstructions) : ''}
       </table>
       <p style="color:#374151;font-size:13px;margin:0 0 20px">Log in to your carrier portal to view full details, track the shipment, and upload documents.</p>
       ${carrierPortalUrl ? `<p><a href="${carrierPortalUrl}" style="background:#f59e0b;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:700;font-size:13px">View in Carrier Portal</a></p>` : ''}`
    ),
  });
}

// Sent to carrier when their bid is accepted
async function sendBidAcceptedEmail({ load, toEmail, toName, bidAmount, carrierPortalUrl }) {
  if (!toEmail) return;
  const fmt  = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
  const fmtM = n => n ? `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:0})}` : '—';

  return sendMail({
    to: toEmail,
    subject: `✅ Your bid on Load ${load.loadNumber} was accepted!`,
    html: emailWrapper(
      `Bid Accepted — Load ${load.loadNumber}`,
      '#065f46',
      `<p style="color:#374151;font-size:14px;margin:0 0 16px">Hi ${toName || 'there'},</p>
       <p style="color:#374151;font-size:14px;margin:0 0 20px">
         Great news! Your bid on load <strong>${load.loadNumber}</strong> has been
         <span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:20px;font-weight:700;font-size:13px">Accepted</span>.
         The load is now assigned to your carrier.
       </p>
       <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
         ${loadRow('Load #', load.loadNumber)}
         ${loadRow('Route', `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`)}
         ${loadRow('Equipment', load.equipment || '—')}
         ${loadRow('Pickup', fmt(load.pickupDate))}
         ${loadRow('Delivery', fmt(load.deliveryDate))}
         ${bidAmount ? loadRow('Agreed Rate', `<strong style="font-size:15px">${fmtM(bidAmount)}</strong>`) : ''}
       </table>
       <p style="color:#374151;font-size:13px;margin:0 0 20px">Log in to your carrier portal to view full details and manage this shipment.</p>
       ${carrierPortalUrl ? `<p><a href="${carrierPortalUrl}" style="background:#f59e0b;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:700;font-size:13px">Open Carrier Portal</a></p>` : ''}`
    ),
  });
}

// Sent to carrier when their bid is rejected
async function sendBidRejectedEmail({ load, toEmail, toName }) {
  if (!toEmail) return;
  return sendMail({
    to: toEmail,
    subject: `Bid update on Load ${load.loadNumber}`,
    html: emailWrapper(
      `Bid Not Selected — Load ${load.loadNumber}`,
      '#6b7280',
      `<p style="color:#374151;font-size:14px;margin:0 0 16px">Hi ${toName || 'there'},</p>
       <p style="color:#374151;font-size:14px;margin:0 0 20px">
         Thank you for bidding on load <strong>${load.loadNumber}</strong>
         (${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}).
         Unfortunately, another carrier was selected for this shipment.
       </p>
       <p style="color:#374151;font-size:13px;margin:0 0 20px">Check the carrier portal for new available loads.</p>
       <p><a href="${BASE()}/carrier/available" style="background:#f59e0b;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:700;font-size:13px">Browse Available Loads</a></p>`
    ),
  });
}

// Sent to dispatcher when carrier updates load status
async function sendCarrierStatusUpdateEmail({ load, toEmail, toName, newStatus, note, carrierName }) {
  if (!toEmail) return;
  const label = STATUS_LABEL[newStatus] || newStatus.replace(/_/g, ' ');
  const color = STATUS_COLOR[newStatus] || '#1d4ed8';
  const appUrl = `${BASE()}/loads/${load.id}`;

  return sendMail({
    to: toEmail,
    subject: `Carrier update: Load ${load.loadNumber} is now ${label}`,
    html: emailWrapper(
      `Carrier Status Update — ${load.loadNumber}`,
      color,
      `<p style="color:#374151;font-size:14px;margin:0 0 16px">Hi ${toName || 'there'},</p>
       <p style="color:#374151;font-size:14px;margin:0 0 20px">
         The carrier <strong>${carrierName || 'carrier'}</strong> has updated load <strong>${load.loadNumber}</strong> to
         <span style="background:${color}22;color:${color};padding:2px 10px;border-radius:20px;font-weight:700;font-size:13px">${label}</span>.
       </p>
       ${note ? `<div style="background:#f8fafc;border-left:3px solid #e5e7eb;padding:12px 16px;margin-bottom:20px;border-radius:0 6px 6px 0;font-size:13px;color:#374151"><strong>Note:</strong> ${note}</div>` : ''}
       <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
         ${loadRow('Load #', load.loadNumber)}
         ${loadRow('Route', `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`)}
       </table>
       <p><a href="${appUrl}" style="background:#0f172a;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:700;font-size:13px">View Load</a></p>`
    ),
  });
}

// Sent to dispatcher when carrier uploads a POD
async function sendPODUploadedEmail({ load, toEmail, toName, podType, filename, carrierName }) {
  if (!toEmail) return;
  const appUrl = `${BASE()}/loads/${load.id}`;
  return sendMail({
    to: toEmail,
    subject: `POD uploaded for Load ${load.loadNumber}`,
    html: emailWrapper(
      `Document Uploaded — ${load.loadNumber}`,
      '#0e7490',
      `<p style="color:#374151;font-size:14px;margin:0 0 16px">Hi ${toName || 'there'},</p>
       <p style="color:#374151;font-size:14px;margin:0 0 20px">
         <strong>${carrierName || 'The carrier'}</strong> has uploaded a <strong>${podType}</strong> for load <strong>${load.loadNumber}</strong>.
       </p>
       <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
         ${loadRow('Load #', load.loadNumber)}
         ${loadRow('Route', `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`)}
         ${loadRow('Document', filename)}
         ${loadRow('Type', podType)}
       </table>
       <p><a href="${appUrl}" style="background:#0f172a;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:700;font-size:13px">View Load & Documents</a></p>`
    ),
  });
}

// Sent to dispatcher when carrier submits a bid
async function sendNewBidEmail({ load, toEmail, toName, carrierName, mcNumber, amount, notes }) {
  if (!toEmail) return;
  const appUrl = `${BASE()}/loads/${load.id}`;
  const fmtM   = n => n ? `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:0})}` : 'Not specified';
  return sendMail({
    to: toEmail,
    subject: `New carrier bid on Load ${load.loadNumber}`,
    html: emailWrapper(
      `New Bid — Load ${load.loadNumber}`,
      '#f59e0b',
      `<p style="color:#374151;font-size:14px;margin:0 0 16px">Hi ${toName || 'there'},</p>
       <p style="color:#374151;font-size:14px;margin:0 0 20px">
         <strong>${carrierName}</strong> (MC#${mcNumber}) has submitted a rate bid for load <strong>${load.loadNumber}</strong>.
       </p>
       <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
         ${loadRow('Load #', load.loadNumber)}
         ${loadRow('Route', `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`)}
         ${loadRow('Carrier', `${carrierName} (MC#${mcNumber})`)}
         ${loadRow('Bid Rate', `<strong style="font-size:15px;color:#065f46">${fmtM(amount)}</strong>`)}
         ${notes ? loadRow('Notes', notes) : ''}
       </table>
       <p><a href="${appUrl}" style="background:#f59e0b;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;display:inline-block;font-weight:700;font-size:13px">Review Bids</a></p>`
    ),
  });
}

module.exports = {
  sendInvoiceEmail, sendRateConfirmationEmail, sendLoadStatusUpdate,
  sendPasswordResetEmail, sendUserInviteEmail, sendShipperInviteEmail, sendCarrierInviteEmail,
  sendLoadStatusChangedEmail, sendCarrierDispatchedEmail,
  sendBidAcceptedEmail, sendBidRejectedEmail,
  sendCarrierStatusUpdateEmail, sendPODUploadedEmail, sendNewBidEmail,
};
