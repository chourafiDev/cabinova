import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

/**
 * Global Neon driver setup, once per process: WebSocket transport (not
 * HTTP), needed for interactive transactions. With NEON_WS_PROXY set
 * (tests and CI only), every connection goes through Neon's wsproxy in
 * front of a plain Postgres instead — see test/docker-compose.yml.
 */
export function configureNeon(wsProxy = process.env.NEON_WS_PROXY) {
  neonConfig.webSocketConstructor = ws;
  if (!wsProxy) return;
  neonConfig.wsProxy = () => `${wsProxy}/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}
