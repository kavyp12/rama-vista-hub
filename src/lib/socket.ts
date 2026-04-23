// src/lib/socket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

interface LeadAssignedPayload {
  leadId: string | null;
  leadName: string;
  assignedByName: string;
  message: string;
}

interface UseLeadSocketOptions {
  userId: string | undefined;
  token: string | undefined | null;
  onAssigned: (data: LeadAssignedPayload) => void;
}

export function useLeadAssignmentSocket({ userId, token, onAssigned }: UseLeadSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId || !token) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', userId);
      console.log('[Socket] Connected → joined room user:', userId);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    socket.on('lead_assigned', (data: LeadAssignedPayload) => {
      onAssigned(data);

      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification('📋 New Lead Assigned', {
          body: data.message,
          icon: '/rama_R_logo.png',
          badge: '/rama_R_logo.png',
          tag: `lead-${data.leadId || Date.now()}`,
          data: { leadId: data.leadId }
        });

        notif.onclick = () => {
          window.focus();
          window.location.href = data.leadId
            ? `/leads?highlight=${data.leadId}`
            : '/leads';
        };
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, token]);
}