import { describe, it, expect, vi } from 'vitest';
import { EtherealMailProvider, MailTransport } from '../../src/providers/EtherealMailProvider';

// Evita carregar lib/mail.ts (e o logger Winston, que cria app.log) durante os testes.
vi.mock('../../src/lib/mail', () => ({ getMailClient: vi.fn() }));

const message = { to: 'cliente@ethereal.email', subject: 'Assunto', text: 'texto', html: '<p>html</p>' };

function transportReturning(info: unknown) {
  const sendMail = vi.fn().mockResolvedValue(info);
  return { transport: { sendMail } as unknown as MailTransport, sendMail };
}

describe('EtherealMailProvider', () => {
  it('envia remetente, destinatário, assunto, texto e html ao transporter', async () => {
    const { transport, sendMail } = transportReturning({ response: '250 Accepted' });
    const provider = new EtherealMailProvider(async () => transport);

    await provider.sendMail(message);

    expect(sendMail).toHaveBeenCalledWith({
      from: '"DevStore" <noreply@devstore.com>',
      to: 'cliente@ethereal.email',
      subject: 'Assunto',
      text: 'texto',
      html: '<p>html</p>',
    });
  });

  it('devolve o link de preview do Ethereal quando a resposta do SMTP o contém', async () => {
    const { transport } = transportReturning({ response: '250 Accepted [STATUS=new MSGID=abc123]' });
    const provider = new EtherealMailProvider(async () => transport);

    await expect(provider.sendMail(message)).resolves.toEqual({ previewUrl: 'https://ethereal.email/message/abc123' });
  });

  it('devolve previewUrl null quando não há link de preview', async () => {
    const { transport } = transportReturning({ response: '250 Accepted' });
    const provider = new EtherealMailProvider(async () => transport);

    await expect(provider.sendMail(message)).resolves.toEqual({ previewUrl: null });
  });

  it('propaga o erro quando o envio falha', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('SMTP indisponível'));
    const provider = new EtherealMailProvider(async () => ({ sendMail }) as unknown as MailTransport);

    await expect(provider.sendMail(message)).rejects.toThrow('SMTP indisponível');
  });
});
