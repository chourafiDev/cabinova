import { describe, expect, it, vi } from 'vitest';
import type { PlatformConfigService } from '../settings/platform-config.service.js';
import { DEFAULTS } from '../settings/platform-config.service.js';
import { EmailService } from './email.service.js';

/** EmailService with a fake Resend and the given configuration. */
function setup(overrides: Partial<typeof DEFAULTS> = {}) {
  const all = { ...structuredClone(DEFAULTS), ...overrides };
  const platform = {
    all: () => Promise.resolve(all),
    branding: () =>
      Promise.resolve({
        platformName: all.general.platformName,
        primaryColor: all.branding.primaryColor,
        logoUrl: all.branding.logo ? '/branding/logo?v=abc' : null,
      }),
  } as unknown as PlatformConfigService;
  const config = {
    get: (key: string) =>
      ({
        RESEND_API_KEY: 're_test',
        EMAIL_FROM: 'Cabinova <notifications@cabinova.ma>',
        WEB_ORIGIN: 'https://admin.cabinova.ma',
      })[key],
  };
  const service = new EmailService(config as never, platform);
  const send = vi.fn().mockResolvedValue({ error: null });
  (service as unknown as { resend: unknown }).resend = { emails: { send } };
  return { service, send };
}

describe('EmailService with the global configuration', () => {
  it('applies sender, reply-to, brand, signature and support contact', async () => {
    const { service, send } = setup({
      general: {
        ...DEFAULTS.general,
        platformName: 'MediDesk',
        supportEmail: 'aide@medidesk.ma',
        supportPhone: '+212 5 22 00 00 00',
      },
      email: {
        senderName: 'MediDesk Support',
        senderAddress: null,
        replyTo: 'support@medidesk.ma',
        signature: 'L’équipe MediDesk',
      },
      branding: { primaryColor: '#0f766e', logo: 'data:image/png;base64,AAAA' },
    });
    await service.sendTest('admin@medidesk.ma');
    const msg = send.mock.calls[0][0];
    expect(msg.from).toBe('MediDesk Support <notifications@cabinova.ma>');
    expect(msg.replyTo).toBe('support@medidesk.ma');
    expect(msg.subject).toBe('E-mail de test — MediDesk');
    expect(msg.html).toContain('border-top:4px solid #0f766e');
    expect(msg.html).toContain(
      'src="https://admin.cabinova.ma/api/branding/logo?v=abc"',
    );
    expect(msg.html).toContain('L’équipe MediDesk');
    expect(msg.html).toContain('aide@medidesk.ma · +212 5 22 00 00 00');
    expect(msg.html).not.toContain('{{');
  });

  it('uses the defaults and no reply-to when nothing is configured', async () => {
    const { service, send } = setup();
    await service.sendTest('admin@cabinova.ma');
    const msg = send.mock.calls[0][0];
    expect(msg.from).toBe('Cabinova <notifications@cabinova.ma>');
    expect(msg).not.toHaveProperty('replyTo');
    expect(msg.html).toContain('background:#613f75');
  });

  it('sends team alerts without the cabinet footer', async () => {
    const { service, send } = setup({
      general: { ...DEFAULTS.general, supportEmail: 'aide@cabinova.ma' },
    });
    await service.sendTeamAlert({
      to: ['ops@cabinova.ma', 'cto@cabinova.ma'],
      subject: 'Incident T-000002',
      lines: ['Cabinet : toute la plateforme'],
      path: '/support/123',
    });
    expect(send).toHaveBeenCalledTimes(2);
    const msg = send.mock.calls[0][0];
    expect(msg.subject).toBe('[Alerte] Incident T-000002');
    expect(msg.html).toContain('https://admin.cabinova.ma/support/123');
    expect(msg.html).not.toContain('aide@cabinova.ma');
  });
});
