import nodemailer, { type Transporter } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<void>;
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send(options: SendEmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Assessment Platform" <noreply@example.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
    });
  }
}

export class MockEmailProvider implements EmailProvider {
  async send(options: SendEmailOptions): Promise<void> {
    console.log('--- MOCK EMAIL PROVIDER ---');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    // Avoid logging full tokens if they appear in URL params
    const sanitizedHtml = options.html.replace(/token=([a-zA-Z0-9_-]{8})[a-zA-Z0-9_-]+/g, 'token=$1***');
    console.log(`HTML: ${sanitizedHtml}`);
    console.log('---------------------------');
  }
}
