import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

let _socket: Socket | null = null;

export function getSocket() { return _socket; }

export function useSocket(handlers?: Record<string, (data: unknown) => void>) {
  const { user } = useAuthStore();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!user?.organizationId) return;

    if (!_socket || _socket.disconnected) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      _socket = io(apiUrl, {
        query: { orgId: user.organizationId },
        withCredentials: true,
        transports: ['websocket', 'polling'],
        path: '/socket.io',
      });
    }

    const socket = _socket;

    if (handlersRef.current) {
      for (const [event, handler] of Object.entries(handlersRef.current)) {
        socket.on(event, handler as (data: unknown) => void);
      }
    }

    return () => {
      if (handlersRef.current) {
        for (const event of Object.keys(handlersRef.current)) {
          socket.off(event);
        }
      }
    };
  }, [user?.organizationId]);
}
