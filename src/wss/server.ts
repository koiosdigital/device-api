import { createServer, type IncomingMessage, type Server } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { prisma, redis, redisSub } from '@/shared/utils';
import { DeviceConnectionManager } from '@/wss/connection-manager';

export type ServerOptions = {
  port?: number;
};

export function startServer(options: ServerOptions = {}): Server {
  const port = options.port ?? 9091;
  const connectedDevices = new Set<string>();
  const connectionManager = new DeviceConnectionManager({ connectedDevices });

  const server = createServer();
  const wss = new WebSocketServer({
    server,
    maxPayload: 256 * 1024,
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    void connectionManager.handleConnection(ws, req);
  });

  server.on('request', (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          connectedDevices: connectedDevices.size,
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(port, '0.0.0.0');
  attachShutdownHandlers(server, wss);
  return server;
}

function attachShutdownHandlers(server: Server, wss: WebSocketServer): void {
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, starting graceful shutdown...`);

    server.close(() => {
      console.log('HTTP server closed');
    });

    wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
    console.log(`Closed ${wss.clients.size} WebSocket connections`);

    try {
      await Promise.all([redis.quit(), redisSub.quit()]);
      console.log('Redis connections closed');
    } catch (error) {
      console.error('Error closing Redis connections:', error);
    }

    try {
      await prisma.$disconnect();
      console.log('Prisma disconnected');
    } catch (error) {
      console.error('Error disconnecting Prisma:', error);
    }

    console.log('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}
