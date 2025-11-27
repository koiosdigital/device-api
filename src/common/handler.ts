import type { WebSocketAdapter } from '../types';
import {
  JoinResponseSchema,
  type KDGlobalMessage,
  KDGlobalMessageSchema,
  type UploadCoreDump,
} from '../protobufs/kd_global_pb';
import { create, toBinary } from '@bufbuild/protobuf';
import { DeviceAPIMessageSchema } from '../protobufs/device-api_pb';

export const handleConnect = async (ws: WebSocketAdapter) => {
  const cn = ws.getDeviceID();

  const apiResponse = create(DeviceAPIMessageSchema);
  apiResponse.message.case = 'kdGlobalMessage';
  apiResponse.message.value = create(KDGlobalMessageSchema);
  apiResponse.message.value.message.case = 'joinResponse';
  apiResponse.message.value.message.value = create(JoinResponseSchema);
  apiResponse.message.value.message.value.success = true;
  apiResponse.message.value.message.value.isClaimed = false; // No claiming system

  const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
  ws.send(resp, true);
};

const handleCoreDumpMessage = async (ws: WebSocketAdapter, message: UploadCoreDump) => {
  console.log('Core dump received from device:', ws.getDeviceID());
  // TODO: Process core dump data
};

export const commonMessageHandler = async (ws: WebSocketAdapter, message: KDGlobalMessage) => {
  console.log(`Received global message: ${message.message.case}`);

  if (message.message.case === 'uploadCoreDump') {
    await handleCoreDumpMessage(ws, message.message.value);
  } else {
    console.warn(`Unhandled global message type: ${message.message.case}`);
  }
};
