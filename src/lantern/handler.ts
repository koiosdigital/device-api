import { WebSocketAdapter } from "../types";
import { KDGlobalMessageSchema, OKResponseSchema } from "../protobufs/kd_global_pb";
import { PrismaClient } from "../generated/prisma/client";
import { create, toBinary } from "@bufbuild/protobuf";
import { DeviceAPIMessageSchema } from "../protobufs/device-api_pb";
import { KDLanternMessage, KDLanternMessageSchema, SetColorSchema, TouchEvent } from "../protobufs/kd_lantern_pb";
import { RedisConnection } from "../redis";

const handleTouchEventMessage = async (ws: WebSocketAdapter, message: TouchEvent, prisma: PrismaClient, redis: RedisConnection) => {
    const apiResponse = create(DeviceAPIMessageSchema);
    apiResponse.message.case = 'kdGlobalMessage';
    apiResponse.message.value = create(KDGlobalMessageSchema);
    apiResponse.message.value.message.case = 'okResponse';
    apiResponse.message.value.message.value = create(OKResponseSchema);
    apiResponse.message.value.message.value.success = true;
    const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
    ws.send(resp, true);

    //Get all groups this device is in, and get all devices in those groups
    const query2 = await prisma.lanternGroupDevices.findMany({
        where: {
            deviceId: ws.getUserData().certificate_cn
        },
    });

    if (!query2) {
        return;
    }

    //for each group, get all devices in that group
    const groupDevices = await prisma.lanternGroupDevices.findMany({
        where: {
            groupId: {
                in: query2.map((groupDevice) => groupDevice.groupId)
            }
        },
    });

    //for each group device, send the amqp message
    groupDevices.forEach(async (groupDevice) => {
        const deviceId = groupDevice.deviceId;

        const thisGroupDevice = query2.find((gd) => gd.deviceId === deviceId);
        if (!thisGroupDevice) {
            return;
        }

        // Parse the triggeredSetColor hex string (e.g., "#RRGGBB")
        let r = 0, g = 0, b = 0;
        if (typeof thisGroupDevice.triggeredSetColor === "string" && /^#?[0-9A-Fa-f]{6}$/.test(thisGroupDevice.triggeredSetColor)) {
            const hex = thisGroupDevice.triggeredSetColor.replace(/^#/, "");
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        }

        const amqpPayload = {
            type: "set_color",
            red: r,
            green: g,
            blue: b,
            effect: thisGroupDevice.triggeredSetEffect || "none",
            speed: 10,
            brightness: 127,
            timeout_seconds: 300,
        }

        await redis.publish(`device:${deviceId}`, JSON.stringify(amqpPayload));
    });
}

export const lanternMessageHandler = async (ws: WebSocketAdapter, message: KDLanternMessage, prisma: PrismaClient, redis: RedisConnection) => {
    if (message.message.case === 'touchEvent') {
        await handleTouchEventMessage(ws, message.message.value, prisma, redis);
    }
};

export const lanternQueueHandler = async (ws: WebSocketAdapter, message: any, prisma: PrismaClient, redis: RedisConnection) => {
    const msg = message; // Already parsed JSON from Redis

    if (msg.type === 'set_color') {
        const apiResponse = create(DeviceAPIMessageSchema);
        apiResponse.message.case = 'kdLanternMessage';
        apiResponse.message.value = create(KDLanternMessageSchema);
        apiResponse.message.value.message.case = 'setColor';
        apiResponse.message.value.message.value = create(SetColorSchema);
        apiResponse.message.value.message.value.blue = msg.blue;
        apiResponse.message.value.message.value.green = msg.green;
        apiResponse.message.value.message.value.red = msg.red;
        apiResponse.message.value.message.value.effect = msg.effect;
        apiResponse.message.value.message.value.effectSpeed = msg.speed;
        apiResponse.message.value.message.value.effectBrightness = msg.brightness;
        apiResponse.message.value.message.value.timeoutSeconds = msg.timeout_seconds;
        const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
        ws.send(resp, true);
    }
}