import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

function isConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export async function sendInvoiceEmail(
  to: string,
  personName: string,
  competitionName: string,
  pdfBuffer: Buffer
): Promise<void> {
  if (!isConfigured()) {
    throw new Error('Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const safeName = personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `Invoice - ${competitionName}`,
    text: [
      `Hi ${personName},`,
      '',
      `Please find your invoice attached for ${competitionName}.`,
      '',
      'Thank you!',
    ].join('\n'),
    attachments: [
      {
        filename: `invoice-${safeName}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

export async function sendHeatSheetEmail(
  to: string,
  personName: string,
  competitionName: string,
  pdfBuffer: Buffer
): Promise<void> {
  if (!isConfigured()) {
    throw new Error('Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const safeName = personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `Heat Sheet - ${competitionName}`,
    text: [
      `Hi ${personName},`,
      '',
      `Please find your heat sheet attached for ${competitionName}.`,
      '',
      'Good luck!',
    ].join('\n'),
    attachments: [{
      filename: `heatsheet-${safeName}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
}

export async function sendResultsEmail(
  to: string,
  personName: string,
  competitionName: string,
  pdfBuffer: Buffer
): Promise<void> {
  if (!isConfigured()) {
    throw new Error('Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const safeName = personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `Results - ${competitionName}`,
    text: [
      `Hi ${personName},`,
      '',
      `Please find your results attached for ${competitionName}.`,
      '',
      'Thank you for participating!',
    ].join('\n'),
    attachments: [{
      filename: `results-${safeName}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
}

export function isEmailConfigured(): boolean {
  return isConfigured();
}
