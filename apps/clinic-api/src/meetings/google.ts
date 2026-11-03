import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

// Google OAuth and Calendar over plain fetch: the few calls team meetings
// need (connect, refresh, create / update / delete an event with a Meet
// link). No SDK.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TIMEOUT_MS = 10_000;
const STATE_TTL_MS = 10 * 60 * 1000;

export type GoogleClient = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** Google refused the account's access (revoked, expired): connect again. */
export class GoogleAuthError extends Error {}
/** Google answered with an error, or didn't answer. */
export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// ── State: which cabinet and owner a callback belongs to ──────────────────

export type ConnectState = {
  tenantId: string;
  subdomain: string;
  userId: string;
};

/**
 * Google returns to one address for every cabinet, so the state says which
 * one: signed (a forged or edited state is refused) and short-lived.
 */
export function signState(key: Buffer, state: ConnectState, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      ...state,
      exp: now + STATE_TTL_MS,
      nonce: randomBytes(8).toString('hex'),
    }),
  ).toString('base64url');
  return `${payload}.${mac(key, payload)}`;
}

export function verifyState(
  key: Buffer,
  value: string,
  now = Date.now(),
): ConnectState | null {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(mac(key, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  try {
    const data = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as ConnectState & { exp: number };
    if (typeof data.exp !== 'number' || data.exp < now) return null;
    return {
      tenantId: data.tenantId,
      subdomain: data.subdomain,
      userId: data.userId,
    };
  } catch {
    return null;
  }
}

const mac = (key: Buffer, payload: string) =>
  createHmac('sha256', key)
    .update(`google-connect:${payload}`)
    .digest('base64url');

// ── OAuth ─────────────────────────────────────────────────────────────────

/** Consent screen: calendar events only, and a refresh token (offline). */
export function authorizationUrl(client: GoogleClient, state: string) {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: 'code',
    scope: `openid email ${CALENDAR_SCOPE}`,
    access_type: 'offline',
    // Always asks, so Google always returns a refresh token.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

/** The callback's code: the account's e-mail, its refresh token and what it granted. */
export async function exchangeCode(client: GoogleClient, code: string) {
  const tokens = await tokenRequest({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: client.redirectUri,
    grant_type: 'authorization_code',
  });
  return {
    refreshToken: tokens.refresh_token ?? null,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    email: tokens.id_token ? emailOf(tokens.id_token) : null,
    calendarGranted: (tokens.scope ?? '').split(' ').includes(CALENDAR_SCOPE),
  };
}

export async function refreshAccessToken(
  client: GoogleClient,
  refreshToken: string,
) {
  const tokens = await tokenRequest({
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: 'refresh_token',
  });
  return {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

/** Disconnecting: Cabinova's access is withdrawn on Google's side too. */
export async function revoke(token: string) {
  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function tokenRequest(body: Record<string, string>) {
  const res = await call(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse & {
    error?: string;
  };
  // invalid_grant: the refresh token was revoked or expired.
  if (data.error === 'invalid_grant') throw new GoogleAuthError(data.error);
  if (!res.ok || !data.access_token) {
    throw new GoogleError(data.error ?? `token ${res.status}`, res.status);
  }
  return data;
}

/**
 * The e-mail in the ID token. It comes straight from Google's token
 * endpoint over TLS, so its payload is read without checking the signature.
 */
function emailOf(idToken: string) {
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString(),
    ) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

// ── Calendar events with a Meet link ──────────────────────────────────────

export type EventInput = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  attendees: { email: string; name: string }[];
};

/** What Google is sent to create the event (exported for tests). */
export function eventBody(input: EventInput, requestId: string = randomUUID()) {
  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.startsAt.toISOString(), timeZone: input.timeZone },
    end: { dateTime: input.endsAt.toISOString(), timeZone: input.timeZone },
    attendees: input.attendees.map((a) => ({
      email: a.email,
      displayName: a.name,
    })),
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
}

type GoogleEvent = {
  id: string;
  hangoutLink?: string;
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } };
    entryPoints?: { entryPointType: string; uri: string }[];
  };
};

const meetUrlOf = (event: GoogleEvent) =>
  event.hangoutLink ??
  event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
    ?.uri ??
  null;

/** A new event; guests get Google's invitation e-mail. Returns its Meet link. */
export async function createEvent(accessToken: string, input: EventInput) {
  const event = await calendar<GoogleEvent>(
    accessToken,
    `${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`,
    { method: 'POST', body: JSON.stringify(eventBody(input)) },
  );
  let meetUrl = meetUrlOf(event);
  // The Meet link is usually there at once; otherwise Google is still making it.
  for (let i = 0; !meetUrl && i < 3; i++) {
    await new Promise((r) => setTimeout(r, 700));
    meetUrl = meetUrlOf(
      await calendar<GoogleEvent>(
        accessToken,
        `${EVENTS_URL}/${encodeURIComponent(event.id)}`,
      ),
    );
  }
  if (!meetUrl) throw new GoogleError('no Meet link');
  return { eventId: event.id, meetUrl };
}

/** The full guest list; the ones added get an invitation. */
export async function setAttendees(
  accessToken: string,
  eventId: string,
  attendees: { email: string; name: string }[],
) {
  await calendar(
    accessToken,
    `${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        attendees: attendees.map((a) => ({
          email: a.email,
          displayName: a.name,
        })),
      }),
    },
  );
}

/** Cancels it for everyone (Google e-mails the guests). Already gone is fine. */
export async function deleteEvent(accessToken: string, eventId: string) {
  try {
    await calendar(
      accessToken,
      `${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: 'DELETE' },
    );
  } catch (err) {
    if (
      err instanceof GoogleError &&
      (err.status === 404 || err.status === 410)
    ) {
      return;
    }
    throw err;
  }
}

async function calendar<T = unknown>(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await call(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
  });
  if (res.status === 401) throw new GoogleAuthError('unauthorized');
  if (!res.ok) throw new GoogleError(`calendar ${res.status}`, res.status);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function call(url: string, init: RequestInit) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new GoogleError(err instanceof Error ? err.message : 'network');
  }
}
