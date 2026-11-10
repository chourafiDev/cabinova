import {
  describe,
  instrumentDatabase,
  requestTiming,
} from '@cabinova/request-timing';
import { Client, Pool } from '@neondatabase/serverless';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './config/env.js';

/** HTTP setup shared by main.ts and the tests. No CORS: only the clinic app's proxy calls this API. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService<Env, true>);

  // Behind the Next.js proxy: req.hostname (the cabinet) and req.ip come from X-Forwarded-*.
  app.set('trust proxy', config.get('TRUST_PROXY'));
  // First, so it times everything after it: a Server-Timing header on every
  // response, and a log line for slow requests with their database time.
  instrumentDatabase({ Client, Pool });
  const timing = new Logger('Timing');
  app.use(
    requestTiming({
      slowMs: config.get('SLOW_REQUEST_MS'),
      all: config.get('LOG_ALL_REQUESTS'),
      report: (t) =>
        t.slow ? timing.warn(describe(t)) : timing.log(describe(t)),
    }),
  );
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  return config;
}
