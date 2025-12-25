import dotenv from 'dotenv';
import { startRestServer } from '@/rest/rest-server';
import { startServer } from '@/wss/server';

dotenv.config();

async function bootstrap(): Promise<void> {
  const websocketPort = Number.parseInt(process.env.PORT ?? '9091', 10);
  const restPort = Number.parseInt(process.env.REST_PORT ?? '9090', 10);

  startServer({ port: websocketPort });
  await startRestServer({ port: restPort });
}

void bootstrap().catch((error) => {
  console.error('Failed to bootstrap services', error);
  process.exit(1);
});
