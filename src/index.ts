
import { createClient as createRedisClient } from 'redis';
import { App as uWSApp, SHARED_COMPRESSOR, WebSocket } from 'uWebSockets.js';
import { UserData } from './types';
import { fromBinary } from '@bufbuild/protobuf';
import { DeviceAPIMessageSchema } from './protobufs/device-api_pb';
import { commonMessageHandler } from './common/handler';
import { DeviceType, PrismaClient } from './generated/prisma';
import { amqp } from './amqp';
import { lanternMessageHandler, lanternQueueHandler } from './lantern/handler';
import { matrxMessageHandler, matrxQueueHandler } from './matrx/handler';

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
    connections.set(cn, ws);

    const type = cn.split("-")[0].toUpperCase();

    await prisma.device.upsert({
      where: {
        id: cn
      },
      create: {
        id: cn,
        type: type as DeviceType,
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
      amqp.registerQueueCallback(`lantern.${cn}`, async (msg) => {
        if (!msg) {
          return;
        }

        try {
          await lanternQueueHandler(ws, msg, prisma, amqp);
          await amqp.channel.ack(msg);
        } catch (error) {
          await amqp.channel.nack(msg);
        }
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

      amqp.registerQueueCallback(`matrx.${cn}`, async (msg) => {
        if (!msg) {
          return;
        }

        try {
          await matrxQueueHandler(ws, msg, prisma, amqp);
          await amqp.channel.ack(msg);
        } catch (error) {
          await amqp.channel.nack(msg);
        }
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
      await matrxMessageHandler(ws, device_api_message.message.value, prisma, amqp);
    } else if (device_api_message.message.case === 'kdLanternMessage') {
      await lanternMessageHandler(ws, device_api_message.message.value, prisma, amqp);
    } else {
      console.error(`Unknown message type: ${device_api_message.message.case}`);
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