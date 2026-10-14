import { describe, it, expect, vi } from 'vitest';
import { NotificationService } from '../../src/services/NotificationService';
import { IMailProvider } from '../../src/providers/IMailProvider';

function fakeMailProvider(previewUrl: string | null = 'https://ethereal.email/message/x') {
  const sendMail = vi.fn().mockResolvedValue({ previewUrl });
  const provider: IMailProvider = { sendMail };
  return { provider, sendMail };
}

describe('NotificationService', () => {
  it('monta assunto, texto e html da confirmação e envia pelo provider', async () => {
    const { provider, sendMail } = fakeMailProvider();
    const service = new NotificationService(provider);

    await service.sendOrderConfirmation({
      customer: 'abacaxi123@ethereal.email',
      orderId: 7,
      total: 110,
      items: [{ name: 'O Programador Pragmático (Livro Físico)' }],
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toBe('abacaxi123@ethereal.email');
    expect(sent.subject).toBe('Confirmação do Pedido #7');
    expect(sent.text).toBe('Olá, seu pedido #7 no valor de R$ 110 foi confirmado.');
    expect(sent.html).toContain('<b>#7</b>');
    expect(sent.html).toContain('<strong>R$ 110</strong>');
    expect(sent.html).toContain('<li>O Programador Pragmático (Livro Físico)</li>');
  });

  it('lista todos os itens do pedido no html', async () => {
    const { provider, sendMail } = fakeMailProvider();

    await new NotificationService(provider).sendOrderConfirmation({
      customer: 'a@b.com',
      orderId: 1,
      total: 160,
      items: [{ name: 'Livro' }, { name: 'E-book' }],
    });

    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('<li>Livro</li><li>E-book</li>');
  });

  it('devolve o resultado do provider (link de preview)', async () => {
    const { provider } = fakeMailProvider('https://ethereal.email/message/abc');

    const result = await new NotificationService(provider).sendOrderConfirmation({
      customer: 'a@b.com',
      orderId: 1,
      total: 50,
      items: [{ name: 'E-book' }],
    });

    expect(result).toEqual({ previewUrl: 'https://ethereal.email/message/abc' });
  });
});
