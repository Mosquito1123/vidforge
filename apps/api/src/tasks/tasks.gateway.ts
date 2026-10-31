import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

interface WsConnection {
  socket: Socket;
  userId: string | null;
  rooms: Set<string>;
}

@Injectable()
export class TasksGateway implements OnModuleInit {
  private readonly logger = new Logger(TasksGateway.name);
  private readonly connections = new Set<WsConnection>();
  private readonly rooms = new Map<string, Set<WsConnection>>();

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onModuleInit() {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
      const url = req.url || '';
      if (!url.startsWith('/ws')) {
        socket.destroy();
        return;
      }
      this.handleUpgrade(req, socket);
    });
  }

  private handleUpgrade(req: IncomingMessage, socket: Socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key || Array.isArray(key)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n` +
        '\r\n',
    );

    const conn: WsConnection = { socket, userId: null, rooms: new Set() };
    this.connections.add(conn);

    const params = new URLSearchParams((req.url || '').split('?')[1] || '');
    const userId = params.get('userId');
    if (userId) {
      conn.userId = userId;
      this.joinRoom(conn, this.userRoom(userId));
    }

    let buffer: Buffer = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]) as Buffer;
      this.processFrames(conn, buffer, (remaining) => {
        buffer = remaining;
      });
    });
    socket.on('close', () => this.removeConnection(conn));
    socket.on('error', () => this.removeConnection(conn));
  }

  private processFrames(conn: WsConnection, buffer: Buffer, setRemaining: (b: Buffer) => void) {
    let offset = 0;
    while (offset < buffer.length) {
      if (buffer.length - offset < 2) break;
      const first = buffer[offset];
      const second = buffer[offset + 1];
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let len = second & 0x7f;
      let headerLen = 2;
      if (len === 126) {
        if (buffer.length - offset < 4) break;
        len = buffer.readUInt16BE(offset + 2);
        headerLen = 4;
      } else if (len === 127) {
        if (buffer.length - offset < 10) break;
        len = Number(buffer.readBigUInt64BE(offset + 2));
        headerLen = 10;
      }
      const maskLen = masked ? 4 : 0;
      const total = headerLen + maskLen + len;
      if (buffer.length - offset < total) break;

      let payloadOffset = offset + headerLen;
      let maskKey: Buffer | null = null;
      if (masked) {
        maskKey = buffer.slice(payloadOffset, payloadOffset + 4);
        payloadOffset += 4;
      }
      const payload = Buffer.from(buffer.slice(payloadOffset, payloadOffset + len));
      if (maskKey) {
        for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4];
      }

      offset += total;

      if (opcode === 0x8) {
        this.removeConnection(conn);
        conn.socket.end();
        setRemaining(Buffer.alloc(0));
        return;
      }
      if (opcode === 0x9) {
        this.sendFrame(conn.socket, 0xa, payload);
        continue;
      }
      if (opcode === 0xa) continue;
      if (opcode === 0x1) {
        try {
          const msg = JSON.parse(payload.toString('utf8'));
          this.handleMessage(conn, msg);
        } catch {
          // ignore
        }
      }
    }
    setRemaining(buffer.slice(offset));
  }

  private handleMessage(conn: WsConnection, msg: any) {
    if (msg?.type === 'join' && msg.userId) {
      conn.userId = String(msg.userId);
      this.joinRoom(conn, this.userRoom(conn.userId));
    }
    if (msg?.type === 'subscribe' && msg.room) {
      this.joinRoom(conn, String(msg.room));
    }
    if (msg?.type === 'leave' && msg.room) {
      this.leaveRoom(conn, String(msg.room));
    }
  }

  private joinRoom(conn: WsConnection, room: string) {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set());
    this.rooms.get(room)!.add(conn);
    conn.rooms.add(room);
  }

  private leaveRoom(conn: WsConnection, room: string) {
    this.rooms.get(room)?.delete(conn);
    conn.rooms.delete(room);
  }

  private removeConnection(conn: WsConnection) {
    this.connections.delete(conn);
    for (const room of conn.rooms) {
      this.rooms.get(room)?.delete(conn);
    }
    conn.rooms.clear();
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    const room = this.userRoom(userId);
    const conns = this.rooms.get(room);
    if (!conns || conns.size === 0) return;
    const message = JSON.stringify({ type: event, ...((payload as any) || {}) });
    const data = Buffer.from(message, 'utf8');
    for (const conn of conns) {
      try {
        this.sendFrame(conn.socket, 0x1, data);
      } catch {
        this.removeConnection(conn);
      }
    }
  }

  emitProgress(userId: string, payload: unknown) {
    this.emitToUser(userId, 'task:progress', payload);
  }

  // Aliases
  sendProgress(userId: string, payload: unknown) {
    this.emitProgress(userId, payload);
  }

  emitTaskProgress(userId: string, payload: unknown) {
    this.emitProgress(userId, payload);
  }

  broadcast(event: string, payload: unknown) {
    const message = JSON.stringify({ type: event, ...((payload as any) || {}) });
    const data = Buffer.from(message, 'utf8');
    for (const conn of this.connections) {
      try {
        this.sendFrame(conn.socket, 0x1, data);
      } catch {
        this.removeConnection(conn);
      }
    }
  }

  private sendFrame(socket: Socket, opcode: number, data: Buffer) {
    const payload = data;
    let header: Buffer;
    if (payload.length < 126) {
      header = Buffer.alloc(2);
      header[1] = payload.length;
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    header[0] = 0x80 | opcode;
    socket.write(Buffer.concat([header, payload]));
  }
}