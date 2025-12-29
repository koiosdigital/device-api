import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import mjml2html from 'mjml';
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface EmailTemplateData {
  title: string;
  preview: string;
  appName: string;
  heading: string;
  body: string;
  buttonUrl?: string;
  buttonText?: string;
  secondaryText?: string;
  footerText: string;
  year: number;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  templateData: EmailTemplateData;
}

class EmailService {
  private transporter: Transporter | null = null;
  private baseTemplate: HandlebarsTemplateDelegate | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpSecure = process.env.SMTP_SECURE === 'true';

      if (!smtpHost || !smtpUser || !smtpPass) {
        throw new Error('SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
      }

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }
    return this.transporter;
  }

  private getBaseTemplate(): HandlebarsTemplateDelegate {
    if (!this.baseTemplate) {
      const templatePath = join(__dirname, 'templates', 'base.mjml');
      const mjmlContent = readFileSync(templatePath, 'utf-8');
      this.baseTemplate = Handlebars.compile(mjmlContent);
    }
    return this.baseTemplate;
  }

  private renderTemplate(data: EmailTemplateData): string {
    const template = this.getBaseTemplate();
    const mjmlWithData = template(data);
    const { html, errors } = mjml2html(mjmlWithData);

    if (errors && errors.length > 0) {
      console.warn('MJML compilation warnings:', errors);
    }

    return html;
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const html = this.renderTemplate(options.templateData);
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || options.templateData.appName;

    await this.getTransporter().sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html,
    });
  }

  async sendDeviceShareInvite(params: {
    toEmail: string;
    inviterName: string;
    deviceName: string;
    inviteUrl: string;
  }): Promise<void> {
    const appName = 'Koios Digital';

    await this.sendEmail({
      to: params.toEmail,
      subject: `${params.inviterName} invited you to access their ${params.deviceName}`,
      templateData: {
        title: 'Device Share Invitation',
        preview: `You've been invited to access a device on ${appName}`,
        appName,
        heading: 'You\'ve been invited!',
        body: `<strong>${params.inviterName}</strong> has invited you to access their device <strong>"${params.deviceName}"</strong>. Click the button below to accept the invitation and start using the device.`,
        buttonUrl: params.inviteUrl,
        buttonText: 'Accept Invitation',
        secondaryText: 'This invitation link will expire in 24 hours. If you didn\'t expect this invitation, you can safely ignore this email.',
        footerText: 'You received this email because someone invited you to access a device.',
        year: new Date().getFullYear(),
      },
    });
  }
}

export const emailService = new EmailService();
