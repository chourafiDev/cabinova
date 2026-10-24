// `pnpm billing:sweep`: runs the billing sweep once (trial ends, renewals,
// overdue) and exits — for a manual run or an external cron. The API also
// runs it hourly on its own. Runs from the compiled build (dist/).
import { NestFactory } from '@nestjs/core';

// Background schedulers stay off in this one-shot process (they check
// NODE_ENV === 'test'); set before AppModule is loaded.
process.env.NODE_ENV = 'test';
const { AppModule } = await import('../../app.module.js');
const { BillingService } = await import('../billing.service.js');

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});
const counts = await app.get(BillingService).sweep();
console.log(JSON.stringify(counts));
await app.close();
