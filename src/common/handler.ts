import { WebSocket } from "uWebSockets.js";
import { UserData } from "../types";
import { ClaimDevice, ErrorResponseSchema, Join, JoinResponseSchema, KDGlobalMessage, KDGlobalMessageSchema, OKResponseSchema, UploadCoreDump } from "../protobufs/kd_global_pb";
import { PrismaClient } from "../generated/prisma";
import { create, toBinary } from "@bufbuild/protobuf";
import { validateToken } from "./auth";

const handleJoinMessage = async (ws: WebSocket<UserData>, message: Join, prisma: PrismaClient) => {
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

    const joinResponse = create(KDGlobalMessageSchema);
    joinResponse.message.case = 'joinResponse';
    joinResponse.message.value = create(JoinResponseSchema);
    joinResponse.message.value.success = true;
    joinResponse.message.value.needsClaimed = needsClaimed;

    ws.send(toBinary(KDGlobalMessageSchema, joinResponse), true);
}

const handleClaimDeviceMessage = async (ws: WebSocket<UserData>, message: ClaimDevice, prisma: PrismaClient) => {
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
        const claimResponse = create(KDGlobalMessageSchema);
        claimResponse.message.case = 'okResponse';
        claimResponse.message.value = create(OKResponseSchema);
        claimResponse.message.value.success = true;
        ws.send(toBinary(KDGlobalMessageSchema, claimResponse), true);
    } catch (e) {
        console.error('Claim error', e);

        const claimResponse = create(KDGlobalMessageSchema);
        claimResponse.message.case = 'errorResponse';
        claimResponse.message.value = create(ErrorResponseSchema);
        claimResponse.message.value.errorMessage = 'Claim Error';
        ws.send(toBinary(KDGlobalMessageSchema, claimResponse), true);
        return;
    }
}

const handleCoreDumpMessage = async (ws: WebSocket<UserData>, message: UploadCoreDump, prisma: PrismaClient) => {

}

export const commonMessageHandler = async (ws: WebSocket<UserData>, message: KDGlobalMessage, prisma: PrismaClient) => {
    if (message.message.case === 'join') {
        handleJoinMessage(ws, message.message.value, prisma);
    } else if (message.message.case === 'claimDevice') {
        handleClaimDeviceMessage(ws, message.message.value, prisma);
    } else if (message.message.case === 'uploadCoreDump') {
        handleCoreDumpMessage(ws, message.message.value, prisma);
    }
};