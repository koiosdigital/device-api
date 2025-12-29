import { createServer, type IncomingMessage, type Server } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { prisma, redis, redisSub } from '@/shared/utils';
import { DeviceConnectionManager } from '@/wss/connection-manager';
import { LoggerService } from '@/shared/logger';

export type ServerOptions = {
  port?: number;
  logger?: LoggerService;
};

export function startServer(options: ServerOptions = {}): Server {
  const port = options.port ?? 9091;
  const logger = options.logger ?? new LoggerService();
  logger.setServerType('SocketServer');
  logger.setContext('WebSocket');

  const connectedDevices = new Set<string>();
  const connectionManager = new DeviceConnectionManager({ connectedDevices, logger });

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
  logger.log(`WebSocket server listening on port ${port}`);
  attachShutdownHandlers(server, wss, logger);
  return server;
}

function attachShutdownHandlers(server: Server, wss: WebSocketServer, logger: LoggerService): void {
  const shutdown = async (signal: string) => {
    logger.log(`${signal} received, starting graceful shutdown...`);

    server.close(() => {
      logger.log('HTTP server closed');
    });

    wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
    logger.log(`Closed ${wss.clients.size} WebSocket connections`);

    try {
      await Promise.all([redis.quit(), redisSub.quit()]);
      logger.log('Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections', error instanceof Error ? error.stack : String(error));
    }

    try {
      await prisma.$disconnect();
      logger.log('Prisma disconnected');
    } catch (error) {
      logger.error('Error disconnecting Prisma', error instanceof Error ? error.stack : String(error));
    }

    logger.log('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}
