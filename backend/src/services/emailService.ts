import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'noreply@resend.dev';

function getClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error('Email not configured. Set RESEND_API_KEY environment variable.');
  }
  return new Resend(RESEND_API_KEY);
}

export async function sendInvoiceEmail(
  to: string,
  personName: string,
  competitionName: string,
  pdfBuffer: Buffer
): Promise<void> {
  const resend = getClient();
  const safeName = personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  await resend.emails.send({
    from: RESEND_FROM,
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
  const resend = getClient();
  const safeName = personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  await resend.emails.send({
    from: RESEND_FROM,
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
    }],
  });
}

export async function sendResultsEmail(
  to: string,
  personName: string,
  competitionName: string,
  pdfBuffer: Buffer
): Promise<void> {
  const resend = getClient();
  const safeName = personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  await resend.emails.send({
    from: RESEND_FROM,
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
    }],
  });
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}
