/** What one request spent, for `report` and `describe`. */
export type RequestTiming = {
	method: string;
	/** The route pattern ("/patients/:id"), never the query string. */
	path: string;
	status: number;
	totalMs: number;
	/** Summed time in queries (parallel queries can add up to more than the request). */
	dbMs: number;
	queries: number;
	/** Waiting for a pooled connection, including opening new ones. */
	waitMs: number;
	newConnections: number;
	/** Time opening those new connections (WebSocket, TLS, login). */
	connectMs: number;
	/** At or over `slowMs`. */
	slow: boolean;
};

/** Counts each request's database work. Pass the driver's own Client and Pool classes. */
export function instrumentDatabase(driver: { Client: { prototype: object }; Pool: { prototype: object } }): void;

/** Server-Timing on every response; `report` for slow requests (or all of them with `all`). */
// Typed without Express itself, which this package doesn't depend on: app.use() accepts it.
export function requestTiming(options: { report: (timing: RequestTiming) => void; slowMs?: number; all?: boolean }): (req: any, res: any, next: (err?: unknown) => void) => void;

/** One log line for a request's timing. */
export function describe(timing: RequestTiming): string;
