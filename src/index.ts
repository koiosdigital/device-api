
import { createClient as createRedisClient } from 'redis';
import { App as uWSApp, SHARED_COMPRESSOR, WebSocket } from 'uWebSockets.js';
import { UserData } from './types';
import { fromBinary } from '@bufbuild/protobuf';
import { DeviceAPIMessageSchema } from './protobufs/device-api_pb';
import { commonMessageHandler } from './common/handler';
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();
const port = 9091;

const connections = new Map<string, WebSocket<UserData>>();

const app = uWSApp().ws('/', {
  compression: SHARED_COMPRESSOR,
  maxPayloadLength: 256 * 1024, // 256KB
  idleTimeout: 10,
  upgrade: (res, req, context) => {
    console.log('An Http connection wants to become WebSocket, URL: ' + req.getUrl() + '!');

    const mtlsCert = req.getHeader('X-Forwarded-Tls-Client-Cert-Info');
    if (mtlsCert === "") {
      res.end('mtlsCert is empty', true);
      return;
    }

    const cnRes = mtlsCert.match(/CN=([a-zA-Z-_0-9]*)/);
    if (!cnRes) {
      res.end('CN not found in mtlsCert', true);
      return;
    }

    /* This immediately calls open handler, you must not use res after this call */
    res.upgrade<UserData>({
      certificate_cn: cnRes[1],
    },
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context
    );

  },
  open: (ws: WebSocket<UserData>) => {
    const cn = ws.getUserData().certificate_cn;
    console.log('WebSocket connection opened, CN: ' + cn);
    connections.set(cn, ws);

    const type = cn.includes('LANTERN') ? 'LANTERN' : 'MATRX';

    prisma.device.upsert({
      where: {
        id: cn
      },
      create: {
        id: cn,
        type,
        online: true,
        deviceSettingsCommon: {
          create: {
            displayName: cn,
          }
        },
      },
      update: {
        online: true
      }
    })
  },
  message: async (ws: WebSocket<UserData>, message, isBinary) => {
    if (!isBinary) {
      return;
    }

    const device_api_message = fromBinary(DeviceAPIMessageSchema, new Uint8Array(message));
    if (!device_api_message) {
      return;
    }

    if (device_api_message.message.case === 'kdGlobalMessage') {
      await commonMessageHandler(ws, device_api_message.message.value, prisma);
    } else if (device_api_message.message.case === 'kdMatrxMessage') {
      console.log('Received KDMatrxMessage');
    } else if (device_api_message.message.case === 'kdLanternMessage') {
      console.log('Received KDLanternMessage');
    } else {
      ws.close();
    }
  },
  drain: (ws: WebSocket<UserData>) => {
    console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws: WebSocket<UserData>, code, message) => {
    console.log('WebSocket closed');
    const cn = ws.getUserData().certificate_cn;
    connections.delete(cn);

    prisma.device.update({
      where: {
        id: cn
      },
      data: {
        online: false
      }
    })
  }
})

app.listen(port, (token) => {
  if (token) {
    console.log('Listening to port ' + port);
  } else {
    console.log('Failed to listen to port ' + port);
  }
});