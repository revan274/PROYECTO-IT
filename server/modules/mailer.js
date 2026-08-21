// Envío de correo transaccional vía SMTP (nodemailer). Diseñado para fallar en silencio:
// si no hay credenciales configuradas, o el envío falla, NUNCA debe romper el flujo que lo dispara
// (ej. creación de un ticket). El llamador decide si loguea el resultado.
import nodemailer from 'nodemailer';

const SMTP_HOST = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
const SMTP_PORT = Math.max(1, Math.trunc(Number(process.env.SMTP_PORT || 465)));
const SMTP_SECURE = String(process.env.SMTP_SECURE ?? (SMTP_PORT === 465 ? 'true' : 'false'))
  .trim()
  .toLowerCase() !== 'false';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const MAIL_FROM = String(process.env.MAIL_FROM || SMTP_USER).trim();
const NOTIFY_TICKET_EMAIL = String(process.env.NOTIFY_TICKET_EMAIL || '').trim();

const MAIL_ENABLED = Boolean(SMTP_USER && SMTP_PASS && MAIL_FROM);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidRecipient(value) {
  const raw = String(value || '').trim();
  return raw.length > 0 && raw.length <= 254 && EMAIL_PATTERN.test(raw);
}

let transporterInstance = null;

function getTransporter() {
  if (!MAIL_ENABLED) return null;
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporterInstance;
}

export function isMailEnabled() {
  return MAIL_ENABLED;
}

export function getNotifyTicketEmail() {
  return NOTIFY_TICKET_EMAIL;
}

export function dedupeRecipients(addresses) {
  const seen = new Set();
  const result = [];
  for (const raw of addresses) {
    const value = String(raw || '').trim().toLowerCase();
    if (!isValidRecipient(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

// Nunca lanza: cualquier fallo de SMTP o de configuración se resuelve como { sent: false }.
export async function sendMail({ to, subject, text, html }) {
  try {
    const transporter = getTransporter();
    if (!transporter) return { sent: false, reason: 'MAIL_DISABLED' };

    const recipients = dedupeRecipients(Array.isArray(to) ? to : [to]);
    if (recipients.length === 0) return { sent: false, reason: 'NO_VALID_RECIPIENTS' };

    await transporter.sendMail({
      from: MAIL_FROM,
      to: recipients.join(', '),
      subject,
      text,
      html,
    });
    return { sent: true, recipients };
  } catch (error) {
    return { sent: false, reason: 'SEND_ERROR', error };
  }
}
