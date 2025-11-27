import WebSocket from 'ws';

export interface UserData {
    certificate_cn: string;
}

// WebSocket adapter to make ws compatible with uWebSockets.js interface
export class WebSocketAdapter {
    private ws: WebSocket;
    private userData: UserData;

    constructor(ws: WebSocket, userData: UserData) {
        this.ws = ws;
        this.userData = userData;
    }

    getUserData(): UserData {
        return this.userData;
    }

    send(data: ArrayBuffer | Uint8Array, isBinary: boolean = true): void {
        this.ws.send(data, { binary: isBinary });
    }

    close(code?: number, message?: string): void {
        this.ws.close(code, message);
    }

    // Expose the original WebSocket for event handling
    get native(): WebSocket {
        return this.ws;
    }
}