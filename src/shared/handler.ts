import type { WebSocketAdapter } from '../types';
import type { DeviceType } from '../generated/prisma/enums';
import { create, toBinary } from '@bufbuild/protobuf';
import { MatrxMessageSchema } from '../protobufs/generated/ts/kd/v1/matrx_pb';
import { JoinResponseSchema, type UploadCoreDump } from '../protobufs/generated/ts/kd/v1/common_pb';

type JoinResponseOptions = {
  isClaimed: boolean;
  success?: boolean;
};

export const sendJoinResponse = (ws: WebSocketAdapter, options: JoinResponseOptions): void => {
  const apiResponse = create(MatrxMessageSchema);
  apiResponse.message.case = 'joinResponse';
  apiResponse.message.value = create(JoinResponseSchema);
  apiResponse.message.value.success = options.success ?? true;
  apiResponse.message.value.isClaimed = options.isClaimed;
  apiResponse.message.value.needsClaimed = !options.isClaimed;

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  ws.send(resp, true);
};

export const handleConnect = async (
  ws: WebSocketAdapter,
  params: { deviceType: DeviceType; isClaimed: boolean }
): Promise<void> => {
  if (params.deviceType === 'MATRX') {
    sendJoinResponse(ws, { isClaimed: params.isClaimed });
    return;
  }
};

export const handleUploadCoreDump = async (
  ws: WebSocketAdapter,
  message: UploadCoreDump
): Promise<void> => {
  console.log('Core dump received from device:', ws.getDeviceID());
  console.log('Firmware info:', {
    project: message.firmwareProject,
    version: message.firmwareVersion,
    variant: message.firmwareVariant,
  });
};
