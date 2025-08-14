import { WebSocket } from "uWebSockets.js";
import { UserData } from "../types";
import { KDGlobalMessageSchema, OKResponseSchema } from "../protobufs/kd_global_pb";
import { PrismaClient } from "../generated/prisma";
import { create, toBinary } from "@bufbuild/protobuf";
import { DeviceAPIMessageSchema } from "../protobufs/device-api_pb";
import { KDLanternMessage, KDLanternMessageSchema, SetColorSchema, TouchEvent } from "../protobufs/kd_lantern_pb";
import { ConsumeMessage } from "amqplib";
import { AMQPConnection } from "../amqp";

const handleTouchEventMessage = async (ws: WebSocket<UserData>, message: TouchEvent, prisma: PrismaClient, amqp: AMQPConnection) => {
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
            device_id: ws.getUserData().certificate_cn
        },
    });

    if (!query2) {
        return;
    }

    //for each group, get all devices in that group
    const groupDevices = await prisma.lanternGroupDevices.findMany({
        where: {
            group_id: {
                in: query2.map((groupDevice) => groupDevice.group_id)
            }
        },
    });

    //for each group device, send the amqp message
    groupDevices.forEach(async (groupDevice) => {
        const deviceId = groupDevice.device_id;

        const thisGroupDevice = query2.find((gd) => gd.device_id === deviceId);
        if (!thisGroupDevice) {
            return;
        }

        // Parse the triggered_set_color hex string (e.g., "#RRGGBB")
        let r = 0, g = 0, b = 0;
        if (typeof thisGroupDevice.triggered_set_color === "string" && /^#?[0-9A-Fa-f]{6}$/.test(thisGroupDevice.triggered_set_color)) {
            const hex = thisGroupDevice.triggered_set_color.replace(/^#/, "");
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        }

        const amqpPayload = {
            type: "set_color",
            red: r,
            green: g,
            blue: b,
            effect: thisGroupDevice.triggered_set_effect || "none",
            speed: 10,
            brightness: 127,
            timeout_seconds: 300,
        }

        await amqp.sendToQueue(`lantern.${deviceId}`, JSON.stringify(amqpPayload));
    });
}

export const lanternMessageHandler = async (ws: WebSocket<UserData>, message: KDLanternMessage, prisma: PrismaClient, amqp: AMQPConnection) => {
    if (message.message.case === 'touchEvent') {
        await handleTouchEventMessage(ws, message.message.value, prisma, amqp);
    }
};

export const lanternQueueHandler = async (ws: WebSocket<UserData>, message: ConsumeMessage, prisma: PrismaClient, amqp: AMQPConnection) => {
    const msg = JSON.parse(message.content.toString());

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