import { WebSocketAdapter } from "../types";
import { ErrorResponseSchema, JoinResponseSchema, KDGlobalMessage, KDGlobalMessageSchema, OKResponseSchema, UploadCoreDump } from "../protobufs/kd_global_pb";
import { PrismaClient } from "../generated/prisma";
import { create, toBinary } from "@bufbuild/protobuf";
import { DeviceAPIMessageSchema } from "../protobufs/device-api_pb";
import { RedisConnection } from "../redis";

export const handleConnect = async (ws: WebSocketAdapter, prisma: PrismaClient) => {
    const cn = ws.getUserData().certificate_cn;

    const apiResponse = create(DeviceAPIMessageSchema);
    apiResponse.message.case = 'kdGlobalMessage';
    apiResponse.message.value = create(KDGlobalMessageSchema);
    apiResponse.message.value.message.case = 'joinResponse';
    apiResponse.message.value.message.value = create(JoinResponseSchema);
    apiResponse.message.value.message.value.success = true;
    apiResponse.message.value.message.value.isClaimed = false; // No claiming system

    const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
    ws.send(resp, true);
}

const handleCoreDumpMessage = async (ws: WebSocketAdapter, message: UploadCoreDump, prisma: PrismaClient, redis: RedisConnection) => {
    console.log('Core dump received from device:', ws.getUserData().certificate_cn);
    // TODO: Process core dump data
}

export const commonMessageHandler = async (ws: WebSocketAdapter, message: KDGlobalMessage, prisma: PrismaClient, redis: RedisConnection) => {
    console.log(`Received global message: ${message.message.case}`);

    if (message.message.case === 'uploadCoreDump') {
        await handleCoreDumpMessage(ws, message.message.value, prisma, redis);
    } else {
        console.warn(`Unhandled global message type: ${message.message.case}`);
    }
};