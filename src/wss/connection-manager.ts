import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { fromBinary } from '@bufbuild/protobuf';
import { MatrxMessageSchema } from '../protobufs/generated/ts/kd/v1/matrx_pb';
import { WebSocketAdapter } from '../types';
import { handleConnect } from '../shared/handler';
import { lanternMessageHandler, lanternQueueHandler } from '../lantern/handler';
import {
  matrxMessageHandler,
  matrxQueueHandler,
  sendMatrxDeviceConfigOnBoot,
} from '../matrx/handler';
import { getDefaultTypeSettings, getDeviceTypeFromCN, prisma, redisSub } from '../shared/utils';

export class DeviceConnectionManager {
  private readonly connectedDevices: Set<string>;

  constructor(deps: { connectedDevices: Set<string> }) {
    this.connectedDevices = deps.connectedDevices;
  }

  public async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    let cn = this.extractCN(req);

    if (!cn) {
      cn = 'MATRX-B43A45B0C418';
    }

    const wsAdapter = new WebSocketAdapter(ws, { certificate_cn: cn });
    const type = getDeviceTypeFromCN(cn);
    this.connectedDevices.add(cn);

    const channel = `device:${cn}`;
    const messageHandler = this.createRedisMessageHandler(type, channel, wsAdapter);

    try {
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
              typeSettings: defaultTypeSettings,
            },
          },
        },
        update: {
          online: true,
        },
      });

      redisSub.on('message', messageHandler);
      await redisSub.subscribe(channel);

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
    return async (receivedChannel: string, message: string) => {
      if (receivedChannel !== channel) return;

      try {
        const msg = JSON.parse(message);
        if (type === 'LANTERN') {
          await lanternQueueHandler(wsAdapter, msg);
        } else if (type === 'MATRX') {
          await matrxQueueHandler(wsAdapter, msg);
        }
      } catch (error) {
        console.error(`Error processing Redis message for ${wsAdapter.getDeviceID()}:`, error);
      }
    };
  }

  private setupSocketLifecycle(
    wsAdapter: WebSocketAdapter,
    channel: string,
    messageHandler: (channel: string, message: string) => Promise<void>,
    deviceType: string
  ): void {
    const deviceId = wsAdapter.getDeviceID();
    const ws = wsAdapter.native;

    ws.on('message', async (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      if (!isBinary) {
        return;
      }

      try {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        const payload = new Uint8Array(buffer);

        if (deviceType === 'MATRX') {
          const matrxMessage = fromBinary(MatrxMessageSchema, payload);
          await matrxMessageHandler(wsAdapter, matrxMessage);
        } else if (deviceType === 'LANTERN') {
          await lanternMessageHandler(wsAdapter, payload);
        } else {
          wsAdapter.close();
        }
      } catch (error) {
        console.error(`Error processing message from ${deviceId}:`, error);
      }
    });

    ws.on('close', async () => {
      this.connectedDevices.delete(deviceId);

      try {
        await prisma.device.update({
          where: { id: deviceId },
          data: { online: false },
        });
      } catch (error) {
        console.error(`Error updating device ${deviceId} offline status:`, error);
      }

      redisSub.off('message', messageHandler);
      await redisSub.unsubscribe(channel);
    });

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for device ${deviceId}:`, error);
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
