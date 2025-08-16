import { WebSocket } from "uWebSockets.js";
import { UserData } from "../types";
import { PrismaClient } from "../generated/prisma";
import { create, toBinary } from "@bufbuild/protobuf";
import { DeviceAPIMessageSchema } from "../protobufs/device-api_pb";
import { ConsumeMessage } from "amqplib";
import { AMQPConnection } from "../amqp";
import { KDMatrxMessage, KDMatrxMessageSchema, RenderResponseSchema, RequestRender, RequestSchedule, ScheduleResponseSchema } from "../protobufs/kd_matrx_pb";
import { uuidBytesToString, uuidStringToBytes } from "./helpers";

const handleScheduleRequestMessage = async (ws: WebSocket<UserData>, message: RequestSchedule, prisma: PrismaClient, amqp: AMQPConnection) => {
    //get this device's applets
    const query = await prisma.matrxApplets.findMany({
        where: {
            deviceId: ws.getUserData().certificate_cn
        },
        orderBy: {
            sortOrder: 'asc' // Order by sortOrder field
        }
    });

    const apiResponse = create(DeviceAPIMessageSchema);
    apiResponse.message.case = 'kdMatrxMessage';
    apiResponse.message.value = create(KDMatrxMessageSchema);
    apiResponse.message.value.message.case = 'scheduleResponse';
    apiResponse.message.value.message.value = create(ScheduleResponseSchema);

    apiResponse.message.value.message.value.scheduleItems = query.map((applet) => {
        return {
            $typeName: 'kd.ScheduleItem',
            uuid: uuidStringToBytes(applet.id),
            appletData: applet.appletData,
            enabled: applet.enabled,
            skippedByUser: applet.skipped_by_user,
            skippedByServer: false, // This can be set based on server logic
            pinned: applet.pinned_by_user,
            displayTime: applet.displayTime,
        };
    });

    const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
    ws.send(resp, true);
}

const handleRequestRenderMessage = async (ws: WebSocket<UserData>, message: RequestRender, prisma: PrismaClient, amqp: AMQPConnection) => {
    const uuid = uuidBytesToString(message.uuid);

    //get the applet data from the database
    const applet = await prisma.matrxApplets.findUnique({
        where: {
            id: uuid,
            deviceId: ws.getUserData().certificate_cn
        },
    });

    if (!applet) {
        return;
    }

    const appletData = applet.appletData as any;

    const requestPayload = {
        type: 'render_request',
        app_id: appletData.app_id,
        uuid: uuid,
        device: {
            id: ws.getUserData().certificate_cn,
            width: message.width,
            height: message.height,
        },
        params: appletData.params || {},
    }

    await amqp.sendToQueue('matrx.render_requests', JSON.stringify(requestPayload));
}

export const matrxMessageHandler = async (ws: WebSocket<UserData>, message: KDMatrxMessage, prisma: PrismaClient, amqp: AMQPConnection) => {
    if (message.message.case === 'requestRender') {
        await handleRequestRenderMessage(ws, message.message.value, prisma, amqp);
    } else if (message.message.case === 'requestSchedule') {
        await handleScheduleRequestMessage(ws, message.message.value, prisma, amqp);
    } else if (message.message.case === 'pinScheduleItem') {
        //  await handlePinScheduleItemMessage(ws, message.message.value, prisma, amqp);
    }
};

export const matrxQueueHandler = async (ws: WebSocket<UserData>, message: ConsumeMessage, prisma: PrismaClient, amqp: AMQPConnection) => {
    const msg = JSON.parse(message.content.toString());
    if (msg.type === 'render_result') {
        const apiResponse = create(DeviceAPIMessageSchema);
        apiResponse.message.case = 'kdMatrxMessage';
        apiResponse.message.value = create(KDMatrxMessageSchema);
        apiResponse.message.value.message.case = 'renderResponse';
        apiResponse.message.value.message.value = create(RenderResponseSchema);
        apiResponse.message.value.message.value.uuid = uuidStringToBytes(msg.uuid);

        // Convert base64-encoded render_output to Uint8Array, handle empty data
        if (msg.render_output && msg.render_output.length > 0) {
            try {
                // Decode base64 string to binary data
                const binaryString = atob(msg.render_output);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                apiResponse.message.value.message.value.spriteData = bytes;
                apiResponse.message.value.message.value.renderError = false;
            } catch (error) {
                apiResponse.message.value.message.value.spriteData = new Uint8Array(0);
                apiResponse.message.value.message.value.renderError = true;
            }
        } else {
            apiResponse.message.value.message.value.spriteData = new Uint8Array(0);
            apiResponse.message.value.message.value.renderError = true;
        }

        const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
        ws.send(resp, true);

    }
}