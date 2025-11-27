
import WebSocket from 'ws';
import { createServer, IncomingMessage } from 'http';
import { WebSocketAdapter, UserData } from './types';
import { fromBinary } from '@bufbuild/protobuf';
import { DeviceAPIMessageSchema } from './protobufs/device-api_pb';
import { commonMessageHandler, handleConnect } from './common/handler';
import { DeviceType, PrismaClient } from './generated/prisma';
import { redis } from './redis';
import { lanternMessageHandler, lanternQueueHandler } from './lantern/handler';
import { matrxMessageHandler, matrxQueueHandler } from './matrx/handler';
import { getDefaultTypeSettings, getDeviceTypeFromCN } from './common/utils';

const prisma = new PrismaClient();
const port = 9091;


//MARK: WebSocket Server
const server = createServer();
const wss = new WebSocket.Server({
  server,
  maxPayload: 256 * 1024 // 256KB
});

// Helper function to extract CN from headers
function extractCN(req: IncomingMessage): string | null {
  // Use DEBUG_CN in non-production environments if set
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_CN) {
    return process.env.DEBUG_CN;
  }

  // Extract from headers
  const mtlsCert = decodeURIComponent(req.headers['x-forwarded-tls-client-cert-info'] as string || '');
  let cn = decodeURIComponent(req.headers['x-common-name'] as string || '');

  if (mtlsCert === "" && cn === "") {
    return null;
  }

  if (cn === "" && mtlsCert !== "") {
    const cnRes = mtlsCert.match(/CN=([a-zA-Z-_0-9]*)/);
    if (!cnRes) {
      return null;
    }
    cn = cnRes[1];
  }

  return cn;
}

wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const cn = extractCN(req);

  if (!cn) {
    console.log('No CN found in request, closing connection');
    ws.close(1008, 'No CN found');
    return;
  }

  // Create WebSocket adapter with user data
  const wsAdapter = new WebSocketAdapter(ws, { certificate_cn: cn });

  const type = getDeviceTypeFromCN(cn);
  console.log(`Device ${cn} connected (${type})`);

  try {
    // Create or update device with unified settings
    const defaultTypeSettings = getDefaultTypeSettings(type);

    await prisma.device.upsert({
      where: { id: cn },
      create: {
        id: cn,
        type,
        online: true,
        settings: {
          create: {
            displayName: cn,
            typeSettings: defaultTypeSettings
          }
        }
      },
      update: {
        online: true
      }
    });

    // Subscribe to device-specific Redis channel
    const channel = `device:${cn}`;
    await redis.subscribe(channel, async (message) => {
      try {
        const msg = JSON.parse(message);
        if (type === 'LANTERN') {
          await lanternQueueHandler(wsAdapter, msg, prisma, redis);
        } else if (type === 'MATRX') {
          await matrxQueueHandler(wsAdapter, msg, prisma, redis);
        }
      } catch (error) {
        console.error(`Error processing Redis message for ${cn}:`, error);
      }
    });

    await handleConnect(wsAdapter, prisma);
  } catch (error) {
    console.error(`Error during connection setup for ${cn}:`, error);
    ws.close(1011, 'Server error during setup');
    return;
  }

  // Handle incoming messages
  ws.on('message', async (data: Buffer, isBinary: boolean) => {
    if (!isBinary) {
      return;
    }

    try {
      const device_api_message = fromBinary(DeviceAPIMessageSchema, new Uint8Array(data));
      if (!device_api_message) {
        console.error('Failed to parse message');
        return;
      }

      if (device_api_message.message.case === 'kdGlobalMessage') {
        await commonMessageHandler(wsAdapter, device_api_message.message.value, prisma, redis);
      } else if (device_api_message.message.case === 'kdMatrxMessage') {
        await matrxMessageHandler(wsAdapter, device_api_message.message.value, prisma, redis);
      } else if (device_api_message.message.case === 'kdLanternMessage') {
        await lanternMessageHandler(wsAdapter, device_api_message.message.value, prisma, redis);
      } else {
        wsAdapter.close();
      }
    } catch (error) {
      console.error(`Error processing message from ${cn}:`, error);
    }
  });

  // Handle connection close
  ws.on('close', async (code: number, reason: Buffer) => {
    console.log(`Device ${cn} disconnected`);

    try {
      await prisma.device.update({
        where: { id: cn },
        data: { online: false }
      });
    } catch (error) {
      console.error(`Error updating device ${cn} offline status:`, error);
    }

    // Unsubscribe from Redis channel
    const channel = `device:${cn}`;
    await redis.unsubscribe(channel);
  });

  // Handle errors
  ws.on('error', (error: Error) => {
    console.error(`WebSocket error for device ${cn}:`, error);
  });
});

server.listen(port, '0.0.0.0', () => {
  redis.connect();
  console.log('Listening to port ' + port);
});