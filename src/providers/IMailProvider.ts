export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  /** Link para visualizar o e-mail (Ethereal). null quando o provedor não oferece preview. */
  previewUrl: string | null;
}

/** Contrato de envio de e-mail: a regra de negócio não conhece o Nodemailer (DIP/ISP). */
export interface IMailProvider {
  sendMail(message: MailMessage): Promise<MailResult>;
}
