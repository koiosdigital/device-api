import type { WebSocket } from 'ws';

export interface UserData {
  certificate_cn: string;
}

// WebSocket adapter to make ws compatible with uWebSockets.js interface
export class WebSocketAdapter {
  private readonly ws: WebSocket;
  private readonly userData: UserData;

  constructor(ws: WebSocket, userData: UserData) {
    this.ws = ws;
    this.userData = userData;
  }

  getDeviceID(): string {
    return this.userData.certificate_cn;
  }

  send(data: ArrayBuffer | Uint8Array, isBinary = true): boolean {
    if (this.ws.readyState !== 1) {
      // WebSocket.OPEN = 1
      return false;
    }
    this.ws.send(data, { binary: isBinary });
    return true;
  }

  isOpen(): boolean {
    return this.ws.readyState === 1; // WebSocket.OPEN
  }

  close(code?: number, message?: string): void {
    this.ws.close(code, message);
  }

  // Expose the original WebSocket for event handling
  get native(): WebSocket {
    return this.ws;
  }
}
