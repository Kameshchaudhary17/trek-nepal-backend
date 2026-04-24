import nodemailer from 'nodemailer';
import { OTP_EXPIRY_MINUTES } from '../config/env.js';

let cachedTransporter = null;

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in .env');
  }
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });
  return cachedTransporter;
}

function fromAddress() {
  const user = process.env.EMAIL_USER;
  return process.env.EMAIL_FROM || `"TrekDirect Nepal" <${user}>`;
}

/* Shared dark-mode shell. `preheader` is inbox-preview text. */
function renderShell({ eyebrow, title, bodyHtml, preheader = '' }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#05080f;font-family:'Segoe UI',sans-serif;">
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#05080f;padding:40px 20px;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#141828,#0a0e1c);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:16px;font-weight:700;color:#f5ead0;">TrekDirect<span style="color:#e0b874;">Nepal</span></span>
      </td></tr>
      <tr><td style="padding:36px 40px 32px;">
        <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.18em;color:#e0b874;font-weight:500;">${eyebrow}</p>
        <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f5ead0;line-height:1.2;">${title}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);">
        <p style="margin:0;font-size:12px;color:#3a5048;text-align:center;">
          &copy; ${year} TrekDirect Nepal &middot; Connecting trekkers with verified Himalayan guides
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function bookingSummaryBlock(booking) {
  const cost = Number(booking.totalCost || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(224,184,116,0.06);border:1px solid rgba(224,184,116,0.2);border-radius:12px;margin:16px 0 24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#9ab0a0;">Route</p>
        <p style="margin:0 0 16px;font-size:15px;color:#f5ead0;font-weight:600;">${booking.route || '—'}</p>
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#9ab0a0;">Start date</p>
        <p style="margin:0 0 16px;font-size:15px;color:#f5ead0;">${formatDate(booking.startDate)} &middot; ${booking.days} day${booking.days === 1 ? '' : 's'}</p>
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#9ab0a0;">Total cost</p>
        <p style="margin:0;font-size:20px;color:#e0b874;font-weight:700;">Rs. ${cost}</p>
      </td></tr>
    </table>`;
}

async function sendMail({ to, subject, html }) {
  try {
    await getTransporter().sendMail({ from: fromAddress(), to, subject, html });
  } catch (err) {
    // Transactional emails should never fail the caller's request.
    console.error('[email] failed:', subject, to, err.message);
  }
}

/* ── OTP ─────────────────────────────────────────────────────────── */
const OTP_COPY = {
  register: {
    eyebrow: 'Verification Code',
    title:   'Verify your email address',
    intro:   'Use the code below to complete your TrekDirect Nepal registration.',
    subject: (otp) => `${otp} — your TrekDirect Nepal verification code`,
    disclaimer: "If you didn't create an account on TrekDirect Nepal, you can safely ignore this email.",
  },
  reset: {
    eyebrow: 'Password Reset',
    title:   'Reset your password',
    intro:   'Use the code below to reset your TrekDirect Nepal password.',
    subject: (otp) => `${otp} — your TrekDirect Nepal password reset code`,
    disclaimer: "If you didn't request a password reset, you can safely ignore this email.",
  },
};

export async function sendOtpEmail(to, otp, { purpose = 'register' } = {}) {
  const copy = OTP_COPY[purpose] || OTP_COPY.register;
  const html = renderShell({
    eyebrow: copy.eyebrow,
    title: copy.title,
    preheader: `Your TrekDirect Nepal code: ${otp}`,
    bodyHtml: `
      <p style="margin:0 0 32px;font-size:15px;color:#9ab0a0;line-height:1.6;">
        ${copy.intro} It expires in
        <strong style="color:#f0e4c8;">${OTP_EXPIRY_MINUTES} minutes</strong>.
      </p>
      <div style="background:rgba(224,184,116,0.08);border:1px solid rgba(224,184,116,0.25);border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
        <span style="font-size:40px;font-weight:700;letter-spacing:0.25em;color:#e0b874;font-family:'Courier New',monospace;">${otp}</span>
      </div>
      <p style="margin:0 0 12px;font-size:13px;color:#6a8878;line-height:1.6;">${copy.disclaimer}</p>
      <p style="margin:0;font-size:13px;color:#6a8878;">Do not share this code with anyone.</p>`,
  });

  await getTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: copy.subject(otp),
    html,
  });
}

/* ── New-booking notice to the guide ─────────────────────────────── */
export async function sendNewBookingNotice({ to, guideName, trekkerName, booking }) {
  const html = renderShell({
    eyebrow: 'New booking request',
    title: `${trekkerName} wants to book you`,
    preheader: `${trekkerName} → ${booking.route}`,
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:15px;color:#9ab0a0;line-height:1.6;">Hi ${guideName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:#9ab0a0;line-height:1.6;">
        <strong style="color:#f0e4c8;">${trekkerName}</strong> has just requested a trek with you. Review and respond from your guide dashboard.
      </p>
      ${bookingSummaryBlock(booking)}
      <p style="margin:0 0 12px;font-size:13px;color:#6a8878;line-height:1.6;">Please confirm or decline within 24 hours so the trekker can plan onwards.</p>`,
  });
  await sendMail({ to, subject: `New booking request from ${trekkerName}`, html });
}

/* ── Trekker confirmation (own request submitted) ────────────────── */
export async function sendBookingSubmitted({ to, trekkerName, guideName, booking }) {
  const html = renderShell({
    eyebrow: 'Request sent',
    title: 'Your booking request is in',
    preheader: `Waiting on ${guideName} to accept your ${booking.route} booking`,
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:15px;color:#9ab0a0;line-height:1.6;">Hi ${trekkerName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:#9ab0a0;line-height:1.6;">
        We've forwarded your request to <strong style="color:#f0e4c8;">${guideName}</strong>. You'll get another email the moment they respond.
      </p>
      ${bookingSummaryBlock(booking)}
      <p style="margin:0;font-size:13px;color:#6a8878;line-height:1.6;">Track status any time at ${process.env.APP_URL || 'http://localhost:5174'}/bookings</p>`,
  });
  await sendMail({ to, subject: `Booking request submitted — ${booking.route}`, html });
}

/* ── Guide rejected notice ───────────────────────────────────────── */
export async function sendGuideRejected({ to, guideName, reason }) {
  const html = renderShell({
    eyebrow: 'Application update',
    title: 'Your guide application needs attention',
    preheader: 'Your TrekDirect Nepal application was not approved',
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:15px;color:#9ab0a0;line-height:1.6;">Hi ${guideName || 'there'},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#9ab0a0;line-height:1.6;">
        Thanks for applying to join TrekDirect Nepal. After review, your application wasn't approved. The team's note is below — you can address it and re-apply from your dashboard.
      </p>
      <div style="background:rgba(224,184,116,0.08);border:1px solid rgba(224,184,116,0.25);border-radius:12px;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#e0b874;font-weight:600;">Reason</p>
        <p style="margin:0;font-size:14px;color:#f5ead0;line-height:1.6;white-space:pre-wrap;">${reason || 'No reason provided.'}</p>
      </div>
      <p style="margin:0;font-size:13px;color:#6a8878;line-height:1.6;">
        Once you've addressed the points above, sign in and press <strong style="color:#f0e4c8;">Re-apply</strong> on your guide dashboard.
      </p>`,
  });
  await sendMail({ to, subject: 'TrekDirect Nepal — application update', html });
}

/* ── Status change (confirmed/rejected/cancelled/completed) ──────── */
export async function sendBookingStatusChange({ to, recipientName, status, otherPartyName, booking }) {
  const titles = {
    confirmed: 'Your booking is confirmed',
    rejected:  'Your booking was declined',
    cancelled: 'A booking was cancelled',
    completed: 'Trek marked as completed',
  };
  const intros = {
    confirmed: `Great news — <strong style="color:#f0e4c8;">${otherPartyName}</strong> has confirmed your trek.`,
    rejected:  `Unfortunately <strong style="color:#f0e4c8;">${otherPartyName}</strong> couldn't take this booking. Feel free to request another guide.`,
    cancelled: `The booking with <strong style="color:#f0e4c8;">${otherPartyName}</strong> has been cancelled.`,
    completed: `<strong style="color:#f0e4c8;">${otherPartyName}</strong> has marked the trek as completed. Please leave a review — it helps future trekkers.`,
  };
  const title = titles[status] || 'Booking update';
  const intro = intros[status] || 'There is an update on your booking.';

  const html = renderShell({
    eyebrow: `Booking ${status}`,
    title,
    preheader: `${booking.route} — status ${status}`,
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:15px;color:#9ab0a0;line-height:1.6;">Hi ${recipientName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:#9ab0a0;line-height:1.6;">${intro}</p>
      ${bookingSummaryBlock(booking)}
      <p style="margin:0;font-size:13px;color:#6a8878;line-height:1.6;">View full details at ${process.env.APP_URL || 'http://localhost:5174'}/bookings</p>`,
  });
  await sendMail({ to, subject: `${title} — ${booking.route}`, html });
}
