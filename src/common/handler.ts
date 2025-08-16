import { WebSocket } from "uWebSockets.js";
import { UserData } from "../types";
import { ClaimDevice, ErrorResponseSchema, Join, JoinResponseSchema, KDGlobalMessage, KDGlobalMessageSchema, OKResponseSchema, UploadCoreDump } from "../protobufs/kd_global_pb";
import { PrismaClient } from "../generated/prisma";
import { create, toBinary } from "@bufbuild/protobuf";
import { validateToken } from "./auth";
import { DeviceAPIMessageSchema } from "../protobufs/device-api_pb";
import { AMQPConnection } from "../amqp";

const handleJoinMessage = async (ws: WebSocket<UserData>, message: Join, prisma: PrismaClient, amqp: AMQPConnection) => {
    const cn = ws.getUserData().certificate_cn;
    const device = await prisma.device.findUnique({
        where: {
            id: cn
        },
        include: {
            claims: true
        }
    });

    if (!device) {
        ws.close();
        return;
    }

    const needsClaimed = device.claims.length === 0;

    const apiResponse = create(DeviceAPIMessageSchema);
    apiResponse.message.case = 'kdGlobalMessage';
    apiResponse.message.value = create(KDGlobalMessageSchema);
    apiResponse.message.value.message.case = 'joinResponse';
    apiResponse.message.value.message.value = create(JoinResponseSchema);
    apiResponse.message.value.message.value.success = true;
    apiResponse.message.value.message.value.needsClaimed = needsClaimed;

    const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
    ws.send(resp, true);
}

const handleClaimDeviceMessage = async (ws: WebSocket<UserData>, message: ClaimDevice, prisma: PrismaClient, amqp: AMQPConnection) => {
    const claimToken = message.claimToken;
    const cn = ws.getUserData().certificate_cn;

    //ensure device is not already claimed (by an owner)
    const claim = await prisma.deviceClaims.findFirst({
        where: {
            role: 'DEVICE_OWNER',
            deviceId: cn
        }
    });

    if (claim) {
        ws.close();
        return;
    }

    //ensure claim token is valid
    try {
        const subject = await validateToken(claimToken);

        //claim the device
        await prisma.deviceClaims.create({
            data: {
                deviceId: cn,
                role: 'DEVICE_OWNER',
                user_id: subject
            }
        });

        //send success message
        const apiResponse = create(DeviceAPIMessageSchema);
        apiResponse.message.case = 'kdGlobalMessage';
        apiResponse.message.value = create(KDGlobalMessageSchema);
        apiResponse.message.value.message.case = 'okResponse';
        apiResponse.message.value.message.value = create(OKResponseSchema);
        apiResponse.message.value.message.value.success = true;
        const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
        ws.send(resp, true);
    } catch (e) {
        console.error('Claim error', e);

        //send error message
        const apiResponse = create(DeviceAPIMessageSchema);
        apiResponse.message.case = 'kdGlobalMessage';
        apiResponse.message.value = create(KDGlobalMessageSchema);
        apiResponse.message.value.message.case = 'errorResponse';
        apiResponse.message.value.message.value = create(ErrorResponseSchema);
        apiResponse.message.value.message.value.errorMessage = 'Invalid claim token';
        const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
        ws.send(resp, true);
        return;
    }
}

const handleCoreDumpMessage = async (ws: WebSocket<UserData>, message: UploadCoreDump, prisma: PrismaClient, amqp: AMQPConnection) => {

}

export const commonMessageHandler = async (ws: WebSocket<UserData>, message: KDGlobalMessage, prisma: PrismaClient, amqp: AMQPConnection) => {
    console.log(message);
    if (message.message.case === 'join') {
        handleJoinMessage(ws, message.message.value, prisma, amqp);
    } else if (message.message.case === 'claimDevice') {
        handleClaimDeviceMessage(ws, message.message.value, prisma, amqp);
    } else if (message.message.case === 'uploadCoreDump') {
        handleCoreDumpMessage(ws, message.message.value, prisma, amqp);
    }
};