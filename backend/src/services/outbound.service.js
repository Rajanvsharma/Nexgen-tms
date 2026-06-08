const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const FROM = () => process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@nexgentms.com';
const BASE = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

async function sendMail(options) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('[Outbound Email - SMTP not configured]', options.subject, '→', options.to);
    return { simulated: true };
  }
  return transporter.sendMail({ from: FROM(), ...options });
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
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Transportation Management System</p>
      </div>`,
    attachments: pdfBuffer ? [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }] : [],
  });
}

async function sendRateConfirmationEmail({ load, carrier, signUrl, pdfBuffer }) {
  const rate = `$${Number(load.carrierRate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return sendMail({
    to: carrier.email,
    subject: `Rate Confirmation — Load ${load.loadNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Rate Confirmation — ${load.loadNumber}</h2>
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
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Transportation Management System</p>
      </div>`,
    attachments: pdfBuffer ? [{ filename: `rate-confirmation-${load.loadNumber}.pdf`, content: pdfBuffer }] : [],
  });
}

async function sendLoadStatusUpdate({ load, toEmail, toName, status, message }) {
  return sendMail({
    to: toEmail,
    subject: `Load ${load.loadNumber} — Status: ${status}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#1e40af">Load Update — ${load.loadNumber}</h2>
        <p>Dear ${toName},</p>
        <p>Load <strong>${load.loadNumber}</strong> status has been updated to <strong>${status}</strong>.</p>
        ${message ? `<p>${message}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Route</td><td style="padding:8px">${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}</td></tr>
          ${load.driverName ? `<tr><td style="padding:8px;background:#f3f4f6;font-weight:600">Driver</td><td style="padding:8px">${load.driverName}${load.driverPhone ? ` · ${load.driverPhone}` : ''}</td></tr>` : ''}
        </table>
        <p style="color:#6b7280;font-size:12px">NexGen TMS · Transportation Management System</p>
      </div>`,
  });
}

async function sendPasswordResetEmail({ toEmail, firstName, resetUrl }) {
  return sendMail({
    to: toEmail,
    subject: 'NexGen TMS — Password Reset',
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

module.exports = { sendInvoiceEmail, sendRateConfirmationEmail, sendLoadStatusUpdate, sendPasswordResetEmail };
