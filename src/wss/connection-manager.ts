import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { fromBinary } from '@bufbuild/protobuf';
import { MatrxMessageSchema } from '@/protobufs/generated/ts/kd/v1/matrx_pb';
import { WebSocketAdapter } from '@/shared/types';
import { handleConnect } from '@/shared/handler';
import { lanternMessageHandler, lanternQueueHandler } from '@/wss/lantern/handler';
import {
  matrxMessageHandler,
  matrxQueueHandler,
  sendMatrxDeviceConfigOnBoot,
} from '@/wss/matrx/handler';
import { getDefaultTypeSettings, getDeviceTypeFromCN, prisma, redisSub } from '@/shared/utils';

export class DeviceConnectionManager {
  private readonly connectedDevices: Set<string>;
  private readonly deviceHandlers: Map<string, (channel: string, message: string) => void>;

  constructor(deps: { connectedDevices: Set<string> }) {
    this.connectedDevices = deps.connectedDevices;
    this.deviceHandlers = new Map();
  }

  public async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    let cn = this.extractCN(req);

    if (!cn) {
      cn = 'MATRX-B43A45B0C418';
    }

    const wsAdapter = new WebSocketAdapter(ws, { certificate_cn: cn });
    const type = getDeviceTypeFromCN(cn);

    const channel = `device:${cn}`;

    // If device already connected, clean up old handler first
    if (this.connectedDevices.has(cn)) {
      console.log(`[ws] cleaning up stale connection device=${cn}`);
      const oldHandler = this.deviceHandlers.get(cn);
      if (oldHandler) {
        redisSub.off('message', oldHandler);
        this.deviceHandlers.delete(cn);
      }
      await redisSub.unsubscribe(channel).catch(() => {});
    }

    this.connectedDevices.add(cn);

    const messageHandler = this.createRedisMessageHandler(type, channel, wsAdapter);
    this.deviceHandlers.set(cn, messageHandler);

    console.log(`[ws] new connection device=${cn} type=${type}`);

    try {
      const defaultTypeSettings = getDefaultTypeSettings(type);

      await prisma.device.upsert({
        where: { id: cn },
        create: {
          id: cn,
          type,
          lastSeenAt: new Date(),
          settings: {
            create: {
              displayName: cn,
              typeSettings: defaultTypeSettings,
            },
          },
        },
        update: {
          lastSeenAt: new Date(),
        },
      });

      redisSub.on('message', messageHandler);
      await redisSub.subscribe(channel);
      console.log(`[redis] subscribed to ${channel}`);

      const ownerClaim = await prisma.deviceClaims.findFirst({
        where: { deviceId: cn, claimType: 'OWNER' },
      });

      await handleConnect(wsAdapter, {
        deviceType: type,
        isClaimed: Boolean(ownerClaim),
      });

      if (type === 'MATRX') {
        await sendMatrxDeviceConfigOnBoot(wsAdapter);
      }

      this.setupSocketLifecycle(wsAdapter, channel, messageHandler, type);
    } catch (error) {
      console.error(`Error during connection setup for ${cn}:`, error);
      ws.close(1011, 'Server error during setup');
      this.connectedDevices.delete(cn);
    }
  }

  private createRedisMessageHandler(type: string, channel: string, wsAdapter: WebSocketAdapter) {
    // Fire-and-forget handler for concurrent message processing
    return (receivedChannel: string, message: string) => {
      if (receivedChannel !== channel) return;

      // Skip if socket is already closed
      if (!wsAdapter.isOpen()) {
        console.log(`[redis] skipped (socket closed) channel=${channel}`);
        return;
      }

      // Process message without awaiting - allows concurrent handling
      (async () => {
        try {
          // Double-check socket is still open before processing
          if (!wsAdapter.isOpen()) {
            console.log(`[redis] skipped (socket closed during async) channel=${channel}`);
            return;
          }

          const msg = JSON.parse(message);
          if (type === 'LANTERN') {
            await lanternQueueHandler(wsAdapter, msg);
          } else if (type === 'MATRX') {
            await matrxQueueHandler(wsAdapter, msg);
          }
        } catch (error) {
          // Only log if socket is still open (otherwise it's expected)
          if (wsAdapter.isOpen()) {
            console.error(`Error processing Redis message for ${wsAdapter.getDeviceID()}:`, error);
          }
        }
      })();
    };
  }

  private setupSocketLifecycle(
    wsAdapter: WebSocketAdapter,
    channel: string,
    messageHandler: (channel: string, message: string) => void,
    deviceType: string
  ): void {
    const deviceId = wsAdapter.getDeviceID();
    const ws = wsAdapter.native;

    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      if (!isBinary) {
        return;
      }

      // Fire-and-forget for concurrent message processing
      (async () => {
        try {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          const payload = new Uint8Array(buffer);

          // Update lastSeenAt without blocking message processing
          prisma.device
            .update({
              where: { id: deviceId },
              data: { lastSeenAt: new Date() },
            })
            .catch(() => {});

          if (deviceType === 'MATRX') {
            const matrxMessage = fromBinary(MatrxMessageSchema, payload);
            console.log(`[ws] received device=${deviceId} type=${matrxMessage.message.case}`);
            await matrxMessageHandler(wsAdapter, matrxMessage);
          } else if (deviceType === 'LANTERN') {
            await lanternMessageHandler(wsAdapter, payload);
          } else {
            wsAdapter.close();
          }
        } catch (error) {
          // Only log if socket is still open (otherwise disconnect during processing is expected)
          if (wsAdapter.isOpen()) {
            console.error(`Error processing message from ${deviceId}:`, error);
          }
        }
      })();
    });

    ws.on('ping', async () => {
      // Update lastSeenAt on ping frames (device keepalive)
      try {
        await prisma.device.update({
          where: { id: deviceId },
          data: { lastSeenAt: new Date() },
        });
      } catch (error) {
        console.error(`Error updating lastSeenAt on ping for ${deviceId}:`, error);
      }
    });

    const cleanup = async () => {
      this.connectedDevices.delete(deviceId);
      this.deviceHandlers.delete(deviceId);
      redisSub.off('message', messageHandler);
      try {
        await redisSub.unsubscribe(channel);
        console.log(`[ws] cleanup complete device=${deviceId}`);
      } catch (error) {
        console.error(`[ws] cleanup error device=${deviceId}:`, error);
      }
    };

    ws.on('close', cleanup);

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for device ${deviceId}:`, error);
      cleanup();
    });
  }

  private extractCN(req: IncomingMessage): string | null {
    if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_CN) {
      return process.env.DEBUG_CN;
    }

    const mtlsCert = decodeURIComponent(
      (req.headers['x-forwarded-tls-client-cert-info'] as string) || ''
    );
    let cn = decodeURIComponent((req.headers['x-common-name'] as string) || '');

    if (mtlsCert === '' && cn === '') {
      return null;
    }

    if (cn === '' && mtlsCert !== '') {
      const cnRes = mtlsCert.match(/CN=([a-zA-Z-_0-9]*)/);
      if (!cnRes) {
        return null;
      }
      cn = cnRes[1];
    }

    return cn;
  }
}
