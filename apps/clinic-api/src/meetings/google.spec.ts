import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authorizationUrl,
  CALENDAR_SCOPE,
  createEvent,
  deleteEvent,
  eventBody,
  exchangeCode,
  GoogleAuthError,
  refreshAccessToken,
  signState,
  verifyState,
} from './google.js';

const key = Buffer.alloc(32, 7);
const state = { tenantId: 't1', subdomain: 'gueliz', userId: 'u1' };
const client = {
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:4100/integrations/google/callback',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => vi.unstubAllGlobals());

describe('connect state', () => {
  it('comes back as signed', () => {
    expect(verifyState(key, signState(key, state))).toEqual(state);
  });

  it('refuses an edited one', () => {
    const [payload, signature] = signState(key, state).split('.');
    const edited = Buffer.from(
      Buffer.from(payload, 'base64url').toString().replace('gueliz', 'atlas'),
    ).toString('base64url');
    expect(verifyState(key, `${edited}.${signature}`)).toBeNull();
  });

  it('refuses another key, an expired one and garbage', () => {
    const now = Date.now();
    expect(verifyState(Buffer.alloc(32, 8), signState(key, state))).toBeNull();
    expect(
      verifyState(key, signState(key, state, now), now + 11 * 60_000),
    ).toBeNull();
    expect(verifyState(key, 'nope')).toBeNull();
    expect(verifyState(key, '')).toBeNull();
  });
});

describe('authorizationUrl', () => {
  it('asks for calendar events offline, every time', () => {
    const url = new URL(authorizationUrl(client, 'abc'));
    expect(url.searchParams.get('scope')).toBe(
      `openid email ${CALENDAR_SCOPE}`,
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('redirect_uri')).toBe(client.redirectUri);
    expect(url.searchParams.get('state')).toBe('abc');
  });
});

describe('exchangeCode', () => {
  const idToken = (email: string) =>
    `x.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.y`;

  it('reads the e-mail and whether the calendar was granted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          access_token: 'at',
          expires_in: 3600,
          refresh_token: 'rt',
          id_token: idToken('dr@cabinet.ma'),
          scope: `openid ${CALENDAR_SCOPE} email`,
        }),
      ),
    );
    await expect(exchangeCode(client, 'code')).resolves.toMatchObject({
      refreshToken: 'rt',
      email: 'dr@cabinet.ma',
      calendarGranted: true,
    });
  });

  it('notices the calendar box left unticked', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ access_token: 'at', expires_in: 3600, scope: 'openid email' }),
        ),
    );
    await expect(exchangeCode(client, 'code')).resolves.toMatchObject({
      calendarGranted: false,
      refreshToken: null,
    });
  });
});

describe('refreshAccessToken', () => {
  it('turns a revoked grant into GoogleAuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ error: 'invalid_grant' }, 400)),
    );
    await expect(refreshAccessToken(client, 'rt')).rejects.toBeInstanceOf(
      GoogleAuthError,
    );
  });
});

describe('events', () => {
  const input = {
    title: 'Réunion d’équipe',
    description: 'd',
    startsAt: new Date('2026-11-03T09:00:00Z'),
    endsAt: new Date('2026-11-03T09:30:00Z'),
    timeZone: 'Africa/Casablanca',
    attendees: [{ email: 'nadia@cabinet.ma', name: 'Nadia' }],
  };

  it('asks Google for a Meet link and invites the guests', () => {
    expect(eventBody(input, 'req-1')).toMatchObject({
      summary: 'Réunion d’équipe',
      start: {
        dateTime: '2026-11-03T09:00:00.000Z',
        timeZone: 'Africa/Casablanca',
      },
      attendees: [{ email: 'nadia@cabinet.ma', displayName: 'Nadia' }],
      guestsCanInviteOthers: false,
      conferenceData: {
        createRequest: {
          requestId: 'req-1',
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    });
  });

  it('returns the event and its Meet link, e-mailing the guests', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        json({
          id: 'ev1',
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
        }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(createEvent('at', input)).resolves.toEqual({
      eventId: 'ev1',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('conferenceDataVersion=1');
    expect(url).toContain('sendUpdates=all');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer at',
    );
  });

  it('takes an event already deleted as cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 410)));
    await expect(deleteEvent('at', 'ev1')).resolves.toBeUndefined();
  });
});
