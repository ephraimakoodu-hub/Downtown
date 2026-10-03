
import nodemailer from 'nodemailer';
import { logger } from './logger.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASSWORD,
    MAIL_FROM,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !MAIL_FROM) {
    throw new Error('Email is not configured. Check SMTP environment variables.');
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error('Email recipient, subject and message are required.');
  }

  const mailer = getTransporter();

  const result = await mailer.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  logger.info('mail_sent', {
    messageId: result.messageId,
    hasRecipient: true,
  });

  return { sent: true, messageId: result.messageId };
}
export async function verifyMailConnection() {
  const mailer = getTransporter();
  return await mailer.verify();
}