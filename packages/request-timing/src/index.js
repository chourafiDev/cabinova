import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

/** The timing of the request being handled (none outside a request: startup, jobs). */
const storage = new AsyncLocalStorage();
/** Marks a method already wrapped, so instrumenting twice (tests, hot reload) counts once. */
const TIMED = Symbol("request-timing");

/**
 * Counts each request's database work. Pass the driver's own Client and Pool
 * classes (@neondatabase/serverless or pg), so the copy the app uses is the
 * one patched. Pool.query goes through pool.connect() then client.query(),
 * so these three cover every query:
 * - client.query: time in queries (summed: parallel queries can exceed the request);
 * - pool.connect: waiting for a pooled connection (includes opening a new one);
 * - client.connect: opening a new connection (WebSocket, TLS, login).
 */
export function instrumentDatabase({ Client, Pool }) {
	wrap(Client.prototype, "query", "query");
	wrap(Client.prototype, "connect", "open");
	wrap(Pool.prototype, "connect", "wait");
}

function wrap(proto, method, kind) {
	const original = proto[method];
	if (original[TIMED]) return;
	const timed = function (...args) {
		const timing = storage.getStore();
		// Cursors and other submittables report on their own; not counted.
		if (!timing || (args[0] && typeof args[0].submit === "function")) return original.apply(this, args);
		const start = performance.now();
		let counted = false;
		const done = () => {
			if (counted) return;
			counted = true;
			timing[kind].ms += performance.now() - start;
			timing[kind].count += 1;
		};
		const last = args.length - 1;
		if (typeof args[last] === "function") {
			const callback = args[last];
			args[last] = function (...result) {
				done();
				return callback.apply(this, result);
			};
			return original.apply(this, args);
		}
		const result = original.apply(this, args);
		if (result && typeof result.then === "function") result.then(done, done);
		return result;
	};
	timed[TIMED] = true;
	proto[method] = timed;
}

const ms = (n) => Math.round(n * 10) / 10;

/**
 * Express middleware, first in the chain. Adds a Server-Timing header to
 * every response (visible in the browser's Network tab) and calls `report`
 * for requests slower than `slowMs`, or for all of them with `all`.
 * Only the route pattern is reported, never the query string (search terms
 * can be patient names).
 */
export function requestTiming({ report, slowMs = 500, all = false }) {
	return (req, res, next) => {
		const timing = {
			start: performance.now(),
			query: { ms: 0, count: 0 },
			wait: { ms: 0, count: 0 },
			open: { ms: 0, count: 0 },
		};
		const writeHead = res.writeHead;
		res.writeHead = function (...args) {
			if (!res.headersSent) {
				const total = performance.now() - timing.start;
				res.setHeader(
					"Server-Timing",
					[
						`app;dur=${ms(total)}`,
						`db;dur=${ms(timing.query.ms)};desc="${timing.query.count} queries"`,
						`wait;dur=${ms(timing.wait.ms)};desc="waiting for a connection"`,
						`connect;dur=${ms(timing.open.ms)};desc="${timing.open.count} new connections"`,
					].join(", "),
				);
			}
			return writeHead.apply(this, args);
		};
		res.on("finish", () => {
			const total = performance.now() - timing.start;
			if (!all && total < slowMs) return;
			const path = req.route?.path ? `${req.baseUrl ?? ""}${req.route.path}` : (req.originalUrl ?? req.url).split("?")[0];
			report({
				method: req.method,
				path,
				status: res.statusCode,
				totalMs: Math.round(total),
				dbMs: Math.round(timing.query.ms),
				queries: timing.query.count,
				waitMs: Math.round(timing.wait.ms),
				newConnections: timing.open.count,
				connectMs: Math.round(timing.open.ms),
				slow: total >= slowMs,
			});
		});
		storage.run(timing, next);
	};
}

/** One line for the logs: "GET /patients 200 · 1240 ms · db 860 ms in 7 queries · waited 300 ms · 2 new connections (280 ms)". */
export function describe(t) {
	const parts = [`${t.method} ${t.path} ${t.status}`, `${t.totalMs} ms`, `db ${t.dbMs} ms in ${t.queries} ${t.queries === 1 ? "query" : "queries"}`];
	if (t.waitMs) parts.push(`waited ${t.waitMs} ms for a connection`);
	if (t.newConnections) parts.push(`${t.newConnections} new ${t.newConnections === 1 ? "connection" : "connections"} (${t.connectMs} ms)`);
	return parts.join(" · ");
}
