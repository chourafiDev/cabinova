/**
 * Every pool of clinic-api: room for one page's queries at once (/auth/me
 * runs 5 together). Idle connections are kept a minute (each new one costs
 * a WebSocket, TLS and login handshake), not longer: one dropped while idle (sleep, network
 * change) can look alive, and a query on it waits forever. A query with no
 * answer is stopped after 30 s, which discards its connection; waiting for
 * a free one gives up after 30 s (time for Neon to wake a suspended database).
 */
export const POOL = {
  max: 10,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 30_000,
  query_timeout: 30_000,
};
