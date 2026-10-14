import nodemailer from 'nodemailer';
import { getMailClient } from '../lib/mail';
import { IMailProvider, MailMessage, MailResult } from './IMailProvider';

/** Apenas o que o provider precisa do transporter do Nodemailer (facilita o teste com um fake). */
export type MailTransport = Pick<nodemailer.Transporter, 'sendMail'>;

const DEFAULT_FROM = '"DevStore" <noreply@devstore.com>';

/**
 * Implementação de IMailProvider com Nodemailer + Ethereal.
 * Reaproveita a configuração existente em lib/mail.ts (getMailClient).
 */
export class EtherealMailProvider implements IMailProvider {
  constructor(
    private readonly getClient: () => Promise<MailTransport> = getMailClient,
    private readonly from: string = DEFAULT_FROM,
  ) {}

  async sendMail(message: MailMessage): Promise<MailResult> {
    const mailer = await this.getClient();

    const info = await mailer.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    return { previewUrl: previewUrl || null };
  }
}
