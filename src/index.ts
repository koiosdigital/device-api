
import { App as uWSApp, SHARED_COMPRESSOR, WebSocket } from 'uWebSockets.js';
import { UserData } from './types';
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
const app = uWSApp().ws('/', {
  compression: SHARED_COMPRESSOR,
  maxPayloadLength: 256 * 1024, // 256KB
  idleTimeout: 15,
  upgrade: (res, req, context) => {
    let cn = "";

    // Use DEBUG_CN in non-production environments if set
    if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_CN) {
      cn = process.env.DEBUG_CN;
    } else {
      // Existing certificate parsing logic
      let mtlsCert = decodeURIComponent(req.getHeader('x-forwarded-tls-client-cert-info'));
      if (mtlsCert === "") {
        cn = decodeURIComponent(req.getHeader('x-common-name'));
      }

      if (mtlsCert === "" && cn === "") {
        res.end('No mtlsCert found', true);
        return;
      }

      if (cn === "") {
        const cnRes = mtlsCert.match(/CN=([a-zA-Z-_0-9]*)/);
        if (!cnRes) {
          res.end('CN not found in mtlsCert', true);
          return;
        }
        cn = cnRes[1];
      }
    }

    console.log(`WebSocket connection request from ${cn}`);

    /* This immediately calls open handler, you must not use res after this call */
    res.upgrade<UserData>({
      certificate_cn: cn,
    },
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context
    );

  },
  open: async (ws: WebSocket<UserData>) => {
    const cn = ws.getUserData().certificate_cn;
    const type = getDeviceTypeFromCN(cn);

    console.log(`Device ${cn} connected (${type})`);

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
          await lanternQueueHandler(ws, msg, prisma, redis);
        } else if (type === 'MATRX') {
          await matrxQueueHandler(ws, msg, prisma, redis);
        }
      } catch (error) {
        console.error(`Error processing Redis message for ${cn}:`, error);
      }
    });

    await handleConnect(ws, prisma);
  },
  message: async (ws: WebSocket<UserData>, message, isBinary) => {
    if (!isBinary) {
      return;
    }

    const device_api_message = fromBinary(DeviceAPIMessageSchema, new Uint8Array(message));
    if (!device_api_message) {
      console.error('Failed to parse message');
      return;
    }

    if (device_api_message.message.case === 'kdGlobalMessage') {
      await commonMessageHandler(ws, device_api_message.message.value, prisma, redis);
    } else if (device_api_message.message.case === 'kdMatrxMessage') {
      await matrxMessageHandler(ws, device_api_message.message.value, prisma, redis);
    } else if (device_api_message.message.case === 'kdLanternMessage') {
      await lanternMessageHandler(ws, device_api_message.message.value, prisma, redis);
    } else {
      ws.close();
    }
  },
  close: async (ws: WebSocket<UserData>, code, message) => {
    const cn = ws.getUserData().certificate_cn;
    const type = getDeviceTypeFromCN(cn);

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
  }
})

app.listen("0.0.0.0", port, (token) => {
  if (token) {
    redis.connect();
    console.log('Listening to port ' + port);
  } else {
    console.log('Failed to listen to port ' + port);
  }
});