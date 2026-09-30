import nodemailer, { Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

export const getMailerTransport = async (): Promise<Transporter> => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.ethereal.email';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === undefined
    ? smtpPort === 465
    : process.env.SMTP_SECURE.toLowerCase() === 'true';
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    return cachedTransporter;
  }

  const account = await nodemailer.createTestAccount();

  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });

  return cachedTransporter;
};

export const sendEmail = async ({
  to,
  subject,
  body,
  from,
  attachments = [],
}: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  attachments?: Array<{ filename: string; path: string; contentType: string }>;
}) => {
  const transporter = await getMailerTransport();
  const info = await transporter.sendMail({
    from: from || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@outbox.local',
    to,
    subject,
    text: body,
    html: `<p>${body.replace(/\n/g, '<br />')}</p>`,
    attachments,
  });

  return {
    messageId: info.messageId,
    response: info.response,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
};
