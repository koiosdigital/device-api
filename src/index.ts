
import { createClient as createRedisClient } from 'redis';
import { App as uWSApp, SHARED_COMPRESSOR, WebSocket } from 'uWebSockets.js';
import { UserData } from './types';
import { fromBinary } from '@bufbuild/protobuf';
import { DeviceAPIMessageSchema } from './protobufs/device-api_pb';
import { commonMessageHandler } from './common/handler';
import { PrismaClient } from './generated/prisma';
import { amqp } from './amqp';
import { lanternMessageHandler, lanternQueueHandler } from './lantern/handler';

const prisma = new PrismaClient();
const port = 9091;

const connections = new Map<string, WebSocket<UserData>>();
const tlsHeaderName = process.env.NODE_ENV === 'production' ? 'x-forwarded-tls-client-cert-info' : 'x-common-name';

//MARK: RabbitMQ

//MARK: WebSocket Server
const app = uWSApp().ws('/', {
  compression: SHARED_COMPRESSOR,
  maxPayloadLength: 256 * 1024, // 256KB
  idleTimeout: 10,
  upgrade: (res, req, context) => {
    let mtlsCert = decodeURIComponent(req.getHeader('x-forwarded-tls-client-cert-info'));
    let cn = "";
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
    connections.set(cn, ws);

    const type = cn.includes('LANTERN') ? 'LANTERN' : 'MATRX';

    await prisma.device.upsert({
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

    if (type === 'LANTERN') {
      //create lantern settings
      await prisma.deviceSettingsLantern.upsert({
        where: {
          deviceId: cn
        },
        create: {
          deviceId: cn,
          brightness: 100,
        },
        update: {
        }
      })

      //subscribe to AMQP channels for lantern
      await amqp.registerQueueCallback(`lantern.${cn}`, async (msg) => {
        if (!msg) {
          return;
        }
        await lanternQueueHandler(ws, msg, prisma, amqp);
      });
    } else if (type === 'MATRX') {
      //create matrx settings
      await prisma.deviceSettingsMatrx.upsert({
        where: {
          deviceId: cn
        },
        create: {
          deviceId: cn,
          brightness: 100,
        },
        update: {}
      });

      //subscribe to AMQP channels for matrx
      await amqp.registerQueueCallback(`matrx.${cn}`, async (msg) => {
        //await matrxQueueHandler(ws, msg, prisma);
      });
    }
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
      await commonMessageHandler(ws, device_api_message.message.value, prisma, amqp);
    } else if (device_api_message.message.case === 'kdMatrxMessage') {
      console.log('Received KDMatrxMessage');
    } else if (device_api_message.message.case === 'kdLanternMessage') {
      await lanternMessageHandler(ws, device_api_message.message.value, prisma, amqp);
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

    //deregister AMQP channels for device
    if (cn.includes('LANTERN')) {
      amqp.deregisterQueueCallback(`lantern.${cn}`);
    }
    else if (cn.includes('MATRX')) {
      amqp.deregisterQueueCallback(`matrx.${cn}`);
    }
  }
})

app.listen("0.0.0.0", port, (token) => {
  if (token) {
    amqp.connect();
    console.log('Listening to port ' + port);
  } else {
    console.log('Failed to listen to port ' + port);
  }
});