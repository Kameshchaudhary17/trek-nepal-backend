import nodemailer from 'nodemailer';

export async function sendOtpEmail(to, otp) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in .env');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });

  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#05080f;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#05080f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(160deg,#141828,#0a0e1c);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:16px;font-weight:700;color:#f5ead0;">TrekDirect<span style="color:#e0b874;">Nepal</span></span>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 32px;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.18em;color:#e0b874;font-weight:500;">Verification Code</p>
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f5ead0;line-height:1.2;">Verify your email address</h1>
            <p style="margin:0 0 32px;font-size:15px;color:#9ab0a0;line-height:1.6;">
              Use the code below to complete your TrekDirect Nepal registration. It expires in <strong style="color:#f0e4c8;">10 minutes</strong>.
            </p>
            <div style="background:rgba(224,184,116,0.08);border:1px solid rgba(224,184,116,0.25);border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
              <span style="font-size:40px;font-weight:700;letter-spacing:0.25em;color:#e0b874;font-family:'Courier New',monospace;">${otp}</span>
            </div>
            <p style="margin:0 0 12px;font-size:13px;color:#6a8878;line-height:1.6;">If you didn't create an account on TrekDirect Nepal, you can safely ignore this email.</p>
            <p style="margin:0;font-size:13px;color:#6a8878;">Do not share this code with anyone.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);">
            <p style="margin:0;font-size:12px;color:#3a5048;text-align:center;">
              &copy; ${year} TrekDirect Nepal &middot; Connecting trekkers with verified Himalayan guides
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"TrekDirect Nepal" <${user}>`,
    to,
    subject: `${otp} \u2014 your TrekDirect Nepal verification code`,
    html,
  });
}
