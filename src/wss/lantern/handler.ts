import type { WebSocketAdapter } from '../types';

// TODO: Re-implement once the Lantern protobuf contract is finalized.
export const lanternMessageHandler = async (
  ws: WebSocketAdapter,
  _message: unknown
): Promise<void> => {
  void ws;
};

export const lanternQueueHandler = async (
  _ws: WebSocketAdapter,
  _message: unknown
): Promise<void> => {
  return;
};
