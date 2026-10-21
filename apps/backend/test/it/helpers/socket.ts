import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { io, type Socket } from 'socket.io-client';

export type TestSocket = Socket & {
  log: { newMessage: any[]; getNotification: any[]; userTyping: any[]; userStopTyping: any[]; accountBanned: any[] };
};

/** Starts the app on a free local port so real socket clients can connect. Returns the base URL. */
export async function listen(app: NestFastifyApplication): Promise<string> {
  await app.listen(0, '127.0.0.1');
  return (await app.getUrl()).replace('[::1]', '127.0.0.1');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Connects like the browser does (cookie header, websocket transport).
 * Resolves when connected, or with `connected: false` if the server refused.
 */
export function connectSocket(
  baseUrl: string,
  cookie: string,
): Promise<{ socket: TestSocket; connected: boolean }> {
  const socket = io(baseUrl, {
    extraHeaders: { cookie },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  }) as TestSocket;
  socket.log = { newMessage: [], getNotification: [], userTyping: [], userStopTyping: [], accountBanned: [] };
  for (const ev of Object.keys(socket.log) as Array<keyof TestSocket['log']>) {
    socket.on(ev, (data?: unknown) => socket.log[ev].push(data));
  }
  return new Promise((resolve) => {
    socket.on('connect', () => resolve({ socket, connected: true }));
    socket.on('connect_error', () => resolve({ socket, connected: false }));
    setTimeout(() => resolve({ socket, connected: socket.connected }), 3000);
  });
}
