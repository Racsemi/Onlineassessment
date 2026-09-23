import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getInterviewSocket(): Socket {
  if (!socket) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
    socket = io(wsUrl, {
      path: '/ws/interview',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function disconnectInterviewSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
